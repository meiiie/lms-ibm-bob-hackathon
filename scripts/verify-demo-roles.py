"""Real hosted UI login, role portals and read-only RBAC acceptance.

Run only after the demo accounts are deployed. Credentials stay in the ignored
secrets file and browser memory. No API login, injected storage, route mock,
auth-state export, account changes or application-data writes are used.
"""

import argparse
import asyncio
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

from playwright.async_api import async_playwright, expect


ROOT = Path(__file__).resolve().parents[1]
ORIGIN = "https://neko-core-lms-demo.pages.dev"
COURSE_ID = "70d479ea-5444-47ca-848d-6edcc20d43d9"
ROLES = {
    "student": ("learner@demo.invalid", "DEMO_STUDENT_PASSWORD", "/student/courses"),
    "teacher": ("teacher@demo.invalid", "DEMO_TEACHER_PASSWORD", "/teacher/courses"),
    "org_admin": ("orgadmin@demo.invalid", "DEMO_ORG_ADMIN_PASSWORD", "/org-admin/dashboard"),
    "admin": ("admin@demo.invalid", "DEMO_ADMIN_PASSWORD", "/admin/dashboard"),
}


def items(data):
    return data.get("content", []) if isinstance(data, dict) else data


async def api(page, path, expected=200):
    """Read real API through the UI's own token without returning it to Python."""
    assert path.startswith("/api/v3/")
    result = await page.evaluate("""async path => {
        const token = localStorage.getItem('lms_access_token');
        if (!token) return {status: 0};
        const response = await fetch(new URL(path, location.origin), {
            headers: {Authorization: `Bearer ${token}`, 'ngsw-bypass': 'true'},
            cache: 'no-store', signal: AbortSignal.timeout(30000)
        });
        return {status: response.status, data: response.ok ? (await response.json()).data : null};
    }""", path)
    assert result["status"] == expected, (
        f"GET {path.split('?')[0]} expected HTTP {expected}, got {result['status']}"
    )
    return result["data"]


async def capture(page, output, name, label):
    if "/auth/" in urlparse(page.url).path:
        return
    await page.evaluate("""label => {
        const el = document.createElement('div'); el.id = 'role-acceptance-evidence';
        el.textContent = 'REAL HOSTED LMS / SYNTHETIC DEMO ACCOUNTS — ' + label;
        el.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483647;' +
            'padding:6px 12px;background:#172554;color:white;font:12px sans-serif;pointer-events:none';
        document.body.append(el);
    }""", label)
    try:
        await page.screenshot(path=str(output / name), full_page=False,
                              mask=[page.locator('input[type="password"]')])
    finally:
        await page.evaluate("document.getElementById('role-acceptance-evidence')?.remove()")


async def verify_role(browser, role, secrets, output):
    email, secret_key, home = ROLES[role]
    password = secrets[secret_key]
    result = {"role": role, "email": email, "result": "FAIL", "checks": [], "uiApiFailures": [],
              "pageErrors": []}
    context = await browser.new_context(viewport={"width": 1440, "height": 1000},
                                        locale="vi-VN", service_workers="block")
    page = await context.new_page()
    page.set_default_timeout(30000)
    page.set_default_navigation_timeout(90000)
    phase = "ui"
    step = "real UI login"

    def response_observed(response):
        parsed = urlparse(response.url)
        if phase == "ui" and parsed.path.startswith("/api/") and response.status >= 400:
            result["uiApiFailures"].append({"path": parsed.path, "status": response.status})

    page.on("response", response_observed)
    page.on("pageerror", lambda error: result["pageErrors"].append(str(error)[:300]))

    def passed(check, **details):
        result["checks"].append({"check": check, "result": "PASS", **details})
        print(f"PASS {role}: {check}", flush=True)

    try:
        await page.goto(ORIGIN + "/auth/login", wait_until="networkidle")
        await page.locator("#email").fill(email)
        await page.get_by_role("button", name="Tiếp tục với email", exact=True).click()
        await page.locator("#password").fill(password)
        await page.get_by_role("button", name="Đăng nhập", exact=True).click()
        await page.wait_for_url(ORIGIN + home, timeout=90000)
        await page.wait_for_load_state("networkidle")
        phase = "api"
        identity = await api(page, "/api/v3/auth/me")
        assert identity["email"] == email
        assert identity["role"].lower() == role
        result["identity"] = {k: identity.get(k) for k in ("id", "role", "organizationId")}
        passed(step, portal=home)

        step = "real role dashboard"
        phase = "ui"
        if role in ("admin", "org_admin"):
            selector = "app-admin-system-dashboard" if role == "admin" else "app-admin-org-dashboard"
            await expect(page.locator(selector)).to_be_visible()
            await expect(page.locator(selector + " h1")).to_be_visible()
            await expect(page.get_by_text("Không thể tải dữ liệu bảng điều khiển", exact=True)).to_have_count(0)
        else:
            await expect(page.locator("h1").first).to_be_visible()
        await capture(page, output, f"{role}-home.png", role.upper() + " HOME")
        passed(step, route=urlparse(page.url).path)

        phase = "api"
        step = "real scoped course data"
        if role == "student":
            course_list = items(await api(page, "/api/v3/student/courses/enrolled?page=0&size=100"))
        elif role == "teacher":
            course_list = items(await api(page, "/api/v3/teacher/courses/my-courses?page=0&size=100"))
        else:
            course_list = items(await api(page, "/api/v3/admin/courses/all?search=STCW&page=0&size=100"))
            analytics = await api(page, "/api/v3/admin/courses/analytics")
            assert analytics["totalCourses"] >= 1
            passed("real dashboard analytics", totalCourses=analytics["totalCourses"])
            approved = items(await api(page, "/api/v3/admin/courses/all?status=APPROVED&search=STCW&page=0&size=100"))
            assert any(c["id"] == COURSE_ID for c in approved)
            await api(page, "/api/v3/admin/courses/all?status=PENDING&page=0&size=100")
            passed("title search, approved search and pending review filters")
        course = next((c for c in course_list if c["id"] == COURSE_ID), None)
        assert course, "Expected real SAF-101 course is absent from scoped list"
        passed(step, courseId=course["id"], courseTitle=course["title"])

        step = "real course list UI"
        phase = "ui"
        path = {"student": "/student/courses/library", "teacher": "/teacher/courses",
                "org_admin": "/org-admin/courses", "admin": "/admin/courses"}[role]
        await page.goto(ORIGIN + path, wait_until="networkidle")
        assert urlparse(page.url).path == path, "Role portal redirected from intended course list"
        if role in ("org_admin", "admin"):
            search = page.get_by_placeholder(re.compile("Tìm kiếm khóa học"))
            await search.fill("STCW")
        await expect(page.get_by_text(course["title"], exact=True).first).to_be_visible()
        await capture(page, output, f"{role}-courses.png", role.upper() + " REAL SAF-101 COURSE")
        passed(step, route=path)

        phase = "api"
        step = "role membership and boundaries"
        if role == "teacher":
            students = items(await api(page, f"/api/v3/teacher/students?courseId={COURSE_ID}&size=100"))
            assert any(s["email"] == ROLES["student"][0] for s in students)
            passed("real enrolled learner visible to course teacher")
            phase = "ui"
            await page.goto(ORIGIN + "/teacher/students", wait_until="networkidle")
            await page.locator('input[aria-label="Tìm khóa học"]').fill("SAF-101")
            card = page.locator(".course-card").filter(has_text=course["title"]).first
            await expect(card).to_be_visible()
            await card.click()
            await expect(page.get_by_text(ROLES["student"][0], exact=True)).to_be_visible()
            await capture(page, output, "teacher-students.png", "TEACHER REAL ENROLLED LEARNER")
            passed("teacher learner-management UI")
            phase = "api"
        if role in ("student", "teacher"):
            await api(page, "/api/v3/admin/courses/analytics", expected=403)
            await api(page, "/api/v3/organizations/stats", expected=403)
            passed("system administration denied", expectedStatus=403)
        else:
            organizations = await api(page, "/api/v3/organizations")
            assert isinstance(organizations, list) and organizations
            if role == "org_admin":
                assert len(organizations) == 1
                assert str(organizations[0]["id"]) == str(identity["organizationId"])
                await api(page, "/api/v3/organizations/stats", expected=403)
                passed("organization scope and system-statistics denial", organizations=1)
            else:
                stats = await api(page, "/api/v3/organizations/stats")
                assert isinstance(stats, dict)
                passed("system organization statistics available", organizations=len(organizations))
        step = "portal API and runtime errors"
        assert not result["pageErrors"], "Role portal emitted browser runtime errors"
        assert not result["uiApiFailures"], "Role portal UI emitted failing API requests; inspect local summary"
        passed(step)
        result["result"] = "PASS"
    except Exception as error:
        result["failedStep"] = step
        result["error"] = re.sub(r"eyJ[A-Za-z0-9_.-]+", "[REDACTED JWT]", str(error).replace(password, "[REDACTED]"))[:1500]
        print(f"FAIL {role}: {step}", flush=True)
        if "/auth/" not in urlparse(page.url).path:
            await capture(page, output, f"{role}-failure.png", role.upper() + " FAILED — " + step)
    finally:
        await context.close()
    return result


async def main(args):
    output = (ROOT / args.output).resolve()
    assert output.is_relative_to((ROOT / ".tools").resolve()), "Evidence must stay under ignored .tools"
    output.mkdir(parents=True, exist_ok=True)
    secrets = json.loads((ROOT / args.secrets_file).read_text(encoding="utf-8-sig"))
    report = {"startedAt": datetime.now(timezone.utc).isoformat(), "origin": ORIGIN, "mocks": False,
              "scope": "Read-only role portals and RBAC using real UI login and separate fresh contexts",
              "limits": ["Headless desktop Chrome; physical mobile not tested",
                         "Service workers blocked for this online-only role test; offline acceptance separate",
                         "No account-management, course-authoring or financial mutation tested"], "roles": []}
    async with async_playwright() as p:
        browser = await p.chromium.launch(channel="chrome", headless=True)
        report["chromeVersion"] = browser.version
        try:
            for role in args.roles:
                report["roles"].append(await verify_role(browser, role, secrets, output))
        finally:
            await browser.close()
    report["result"] = "PASS" if all(r["result"] == "PASS" for r in report["roles"]) else "FAIL"
    report["finishedAt"] = datetime.now(timezone.utc).isoformat()
    serialized = json.dumps(report, ensure_ascii=False, indent=2)
    for key, value in secrets.items():
        if key == "APP_BASE_URL":
            continue
        if isinstance(value, str) and len(value) >= 20:
            serialized = serialized.replace(value, "[REDACTED]")
    (output / "summary.local.json").write_text(serialized, encoding="utf-8")
    print(f"RESULT {report['result']}: {output / 'summary.local.json'}", flush=True)
    return 0 if report["result"] == "PASS" else 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", default=".tools/demo-roles")
    parser.add_argument("--secrets-file", default=".tools/free-demo-secrets.local.json")
    parser.add_argument("--roles", nargs="+", choices=list(ROLES), default=list(ROLES))
    sys.exit(asyncio.run(main(parser.parse_args())))
