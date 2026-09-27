"""Real hosted demo write acceptance. Uses UI login; no mock APIs or injected auth.

baseline confirms the old profile restriction without changing values.
write edits/restores the four profiles, checks role mutations and creates one
disposable learner plus a synthetic PDF. verify-restart checks persistence, removes
the stored fixture bytes and deactivates its learner. Attachment metadata is retained
by the existing deletion API. Private state stays under .tools.
"""
import argparse
import asyncio
import json
import secrets
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from playwright.async_api import async_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = 'https://neko-core-lms-demo.pages.dev'
ROLES = {
    'student': ('learner@demo.invalid', 'DEMO_STUDENT_PASSWORD', '/student/courses'),
    'teacher': ('teacher@demo.invalid', 'DEMO_TEACHER_PASSWORD', '/teacher/courses'),
    'org_admin': ('orgadmin@demo.invalid', 'DEMO_ORG_ADMIN_PASSWORD', '/org-admin/dashboard'),
    'admin': ('admin@demo.invalid', 'DEMO_ADMIN_PASSWORD', '/admin/dashboard'),
}


async def login(browser, email, password, home='/student/courses'):
    context = await browser.new_context(service_workers='block', viewport={'width': 1440, 'height': 1000})
    page = await context.new_page()
    page.set_default_timeout(30000)
    await page.goto(ORIGIN + '/auth/login', wait_until='networkidle')
    await page.locator('#email').fill(email)
    await page.get_by_role('button', name='Tiếp tục với email', exact=True).click()
    await page.locator('#password').fill(password)
    await page.get_by_role('button', name='Đăng nhập', exact=True).click()
    await page.wait_for_url(ORIGIN + home, timeout=90000)
    await page.wait_for_load_state('networkidle')
    return context, page


async def api(page, path, method='GET', body=None, expected=200):
    assert path.startswith('/api/v3/')
    value = await page.evaluate('''async p => {
      const token = localStorage.getItem('lms_access_token');
      const response = await fetch(p.path, {method:p.method, cache:'no-store',
        headers:{'Content-Type':'application/json', ...(token ? {Authorization:'Bearer '+token} : {})},
        ...(p.body === null ? {} : {body:JSON.stringify(p.body)})});
      let payload; try { payload=await response.json(); } catch { payload={}; }
      return {status:response.status, payload};
    }''', {'path': path, 'method': method, 'body': body})
    assert value['status'] == expected, f'{method} {path.split("?")[0]} returned {value["status"]}, expected {expected}'
    if expected >= 400:
        return value['payload']
    assert value['payload'].get('success') is not False, f'{method} {path} reported failure'
    return value['payload'].get('data')


async def profile_ui(page, role, identity, output):
    prefix = 'org-admin' if role == 'org_admin' else role
    await page.goto(ORIGIN + f'/{prefix}/profile', wait_until='networkidle')
    original = {key: identity.get(key) for key in ('fullName', 'email', 'avatarUrl')}
    changed = identity['fullName'] + ' QA'
    try:
        await page.get_by_role('button', name='Chỉnh sửa', exact=True).click()
        await page.locator('#editName').fill(changed)
        async with page.expect_response(lambda r: r.url.endswith('/api/v3/auth/profile') and r.request.method == 'PUT') as response:
            await page.get_by_role('button', name='Lưu thay đổi', exact=True).click()
        assert (await response.value).status == 200, f'{role} profile UI save failed'
        assert (await api(page, '/api/v3/auth/me'))['fullName'] == changed
        await page.reload(wait_until='networkidle')
        await expect(page.get_by_text(changed, exact=True).first).to_be_visible()
        await page.screenshot(path=str(output / f'{role}-profile-saved.png'))
    finally:
        await api(page, '/api/v3/auth/profile', 'PUT', original)


async def main(args):
    output = (ROOT / args.output).resolve()
    assert output.is_relative_to(ROOT / '.tools'), 'Keep private state in ignored .tools'
    output.mkdir(parents=True, exist_ok=True)
    state_file = output / 'state.private.json'
    if args.phase == 'write':
        assert not state_file.exists(), 'Use a new output directory; do not overwrite fixture cleanup state'
    state = json.loads(state_file.read_text('utf8')) if state_file.exists() else {}
    credentials = json.loads((ROOT / '.tools/free-demo-secrets.local.json').read_text('utf-8-sig'))
    checks = []
    def passed(name):
        checks.append(name)
        print('PASS ' + name, flush=True)
    def save():
        state_file.write_text(json.dumps(state, indent=2), encoding='utf8')
    report = {'phase':args.phase, 'startedAt':datetime.now(timezone.utc).isoformat(), 'checks':checks}
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(channel='chrome', headless=True)
            try:
                if args.phase in ('baseline', 'write'):
                    for role, (email, key, home) in ROLES.items():
                        context, page = await login(browser, email, credentials[key], home)
                        try:
                            identity = await api(page, '/api/v3/auth/me')
                            if args.phase == 'baseline':
                                result = await api(page, '/api/v3/auth/profile', 'PUT',
                                    {k:identity.get(k) for k in ('fullName','email','avatarUrl')}, expected=403)
                                assert result.get('code') == 'demo_restricted'
                                passed(role + ': reproduced demo-specific write denial')
                                continue
                            await profile_ui(page, role, identity, output)
                            passed(role + ': real UI profile edit, reload and restore')
                            if role == 'teacher':
                                categories = await api(page, '/api/v3/course-categories')
                                category = categories[0]
                                while category.get('children'):
                                    category = category['children'][0]
                                course = await api(page, '/api/v3/teacher/courses', 'POST', {
                                    'categoryId': category['id'], 'title':'Disposable full-access acceptance',
                                    'description':'Synthetic test draft; removed by acceptance.',
                                    'deliveryMode':'SELF_PACED', 'priceType':'FREE', 'price':0})
                                course_id = course['id'] if isinstance(course, dict) else course
                                state['courseId'] = course_id
                                save()
                                await api(page, '/api/v3/teacher/courses/' + course_id, 'PUT', {'title':'Disposable full-access acceptance updated'})
                                await api(page, '/api/v3/teacher/courses/' + course_id, 'DELETE')
                                state.pop('courseId')
                                save()
                                passed('teacher: create, edit and delete a new draft course')
                            elif role == 'org_admin':
                                path = '/api/v3/organizations/' + identity['organizationId']
                                org = await api(page, path)
                                await api(page, path, 'PUT', {k:org[k] for k in ('name','description','tokenExpiryDays')})
                                passed('organization admin: save own organization settings')
                            elif role == 'admin':
                                settings = await api(page, '/api/v3/admin/settings')
                                await api(page, '/api/v3/admin/settings', 'PUT', settings)
                                passed('admin: save system settings without demo restriction')
                        finally:
                            await context.close()

                if args.phase == 'write':
                    state['email'] = 'acceptance-' + secrets.token_hex(5) + '@demo.invalid'
                    state['password'] = secrets.token_urlsafe(26)
                    state['changedPassword'] = secrets.token_urlsafe(26)
                    save()
                    context, page = await login(browser, ROLES['admin'][0], credentials['DEMO_ADMIN_PASSWORD'], ROLES['admin'][2])
                    try:
                        registration = await api(page, '/api/v3/auth/register', 'POST', {
                            'username':state['email'].split('@')[0], 'email':state['email'],
                            'password':state['password'], 'fullName':'Disposable persistence learner', 'role':'STUDENT'}, expected=201)
                        state['userId'] = registration['user']['id']
                        save()
                    finally:
                        await context.close()
                    context, page = await login(browser, state['email'], state['password'])
                    try:
                        identity = await api(page, '/api/v3/auth/me')
                        assert state['userId'] == identity['id']
                        await api(page, '/api/v3/auth/password', 'PUT', {
                            'currentPassword':state['password'], 'newPassword':state['changedPassword']})
                        passed('new learner: registration, UI login and password change')
                        upload = await page.evaluate('''async () => {
                          const text = '%PDF-1.4\\n% Synthetic persistence test\\n' + '%' + 'x'.repeat(1100000) + '\\n%%EOF';
                          const form = new FormData(); form.append('file', new Blob([text],{type:'application/pdf'}),'acceptance.pdf');
                          form.append('category','document');
                          const response = await fetch('/api/v3/files/upload',{method:'POST',body:form,
                            headers:{Authorization:'Bearer '+localStorage.getItem('lms_access_token')}});
                          return {status:response.status, body:await response.json()};
                        }''')
                        assert upload['status'] == 200 and upload['body']['success'], 'Real multipart upload failed'
                        state['upload'] = upload['body']['data']
                        save()
                        assert state['upload']['size'] > 1048576
                        response = await page.request.get(state['upload']['url'])
                        assert response.ok and len(await response.body()) == state['upload']['size']
                        passed('learner: upload and download a synthetic PDF larger than 1 MB')
                    finally:
                        await context.close()

                if args.phase == 'verify-restart':
                    context, page = await login(browser, state['email'], state['changedPassword'])
                    try:
                        assert (await api(page, '/api/v3/auth/me'))['id'] == state['userId']
                        passed('after restart: newly registered learner and changed password preserved')
                        response = await page.request.get(state['upload']['url'])
                        assert response.ok and len(await response.body()) == state['upload']['size']
                        passed('after restart: uploaded file preserved on persistent volume')
                    finally:
                        await context.close()
                    context, page = await login(browser, ROLES['admin'][0], credentials['DEMO_ADMIN_PASSWORD'], ROLES['admin'][2])
                    try:
                        await api(page, '/api/v3/files?' + urlencode({'storageKey':state['upload']['fileName']}), 'DELETE')
                        passed('admin: remove the disposable uploaded file')
                        assert state['email'].startswith('acceptance-') and state['userId'] != 'd3000000-0000-4000-8000-000000000001'
                        await api(page, '/api/v3/users/' + state['userId'] + '/status', 'PATCH',
                                  {'status':'BLOCKED','reason':'Disposable acceptance complete'})
                        state['cleanedUp'] = True
                        state['retainedMetadata'] = 'Existing file deletion API retains attachment metadata; fixture learner is BLOCKED, not deleted.'
                        save()
                        passed('admin: deactivate only the newly created acceptance learner')
                    finally:
                        await context.close()
            finally:
                await browser.close()
        report['result'] = 'PASS'
    except Exception as error:
        report['result'] = 'FAIL'
        message = str(error)
        for value in list(credentials.values()) + [state.get('password'),state.get('changedPassword')]:
            if isinstance(value,str) and len(value)>10:
                message = message.replace(value,'[REDACTED]')
        report['error'] = message[:1200]
        print('FAIL ' + report['error'], flush=True)
    report['finishedAt'] = datetime.now(timezone.utc).isoformat()
    (output / (args.phase + '-summary.json')).write_text(json.dumps(report, indent=2), encoding='utf8')
    return 0 if report['result'] == 'PASS' else 1


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--phase', choices=['baseline','write','verify-restart'], required=True)
    parser.add_argument('--output', default='.tools/demo-writes')
    sys.exit(asyncio.run(main(parser.parse_args())))
