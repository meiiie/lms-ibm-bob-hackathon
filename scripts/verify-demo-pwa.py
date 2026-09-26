"""Real deployed-demo PWA acceptance; no mocked routes, API login or seeded storage.

This completes one previously incomplete TEXT lesson for the isolated demo learner.
It never uses a persistent browser profile, exports authentication, or runs a server.
Run --help before use. Deployment and the ignored secrets file must already exist.
"""

import argparse
import asyncio
import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

from playwright.async_api import async_playwright, expect


ORIGIN = "https://neko-core-lms-demo.pages.dev"
EMAIL = "learner@demo.invalid"
ROOT = Path(__file__).resolve().parents[1]


async def until(description, predicate, seconds=60):
    deadline = asyncio.get_running_loop().time() + seconds
    while True:
        value = await predicate()
        if value:
            return value
        if asyncio.get_running_loop().time() >= deadline:
            raise AssertionError(f"Timed out waiting for {description}")
        await asyncio.sleep(1)


async def api_get(page, path):
    """Real read-only API, with the genuine UI session kept inside the page."""
    assert path.startswith("/api/v3/")
    result = await page.evaluate("""async path => {
        const token = localStorage.getItem('lms_access_token');
        if (!token) return {status: 0};
        const url = new URL(path, location.origin);
        url.searchParams.set('ngsw-bypass', 'true');
        const response = await fetch(url, {
            headers: {Authorization: `Bearer ${token}`, 'ngsw-bypass': 'true'},
            cache: 'no-store', signal: AbortSignal.timeout(30000)
        });
        return {status: response.status,
                data: response.ok ? (await response.json()).data : null};
    }""", path)
    assert result["status"] == 200, f"Real GET {path.split('?')[0]} returned HTTP {result['status']}"
    return result["data"]


async def read_offline(page, fixture):
    """Read only a safe projection from the active database; never inject fixtures."""
    return await page.evaluate("""async f => {
        const dbName = localStorage.getItem('lms_offline_active_db_name') || 'lms-maritime-offline';
        if (!(await indexedDB.databases()).some(d => d.name === dbName)) return null;
        const db = await new Promise((resolve, reject) => {
            const r = indexedDB.open(dbName);
            r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
        });
        try {
            const read = name => new Promise((resolve, reject) => {
                if (!db.objectStoreNames.contains(name)) return resolve([]);
                const r = db.transaction(name, 'readonly').objectStore(name).getAll();
                r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
            });
            const [courses, lessons, progress, queue, checkpoints] = await Promise.all(
                ['courses', 'lessons', 'progress', 'syncQueue', 'downloadCheckpoints'].map(read));
            const own = r => r.userId === f.userId;
            const course = courses.find(r => own(r) && r.id === f.courseId);
            const lesson = lessons.find(r => own(r) && r.id === f.lessonId);
            const current = progress.filter(r => own(r) && r.lessonId === f.lessonId)
                .sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];
            const relevant = queue.filter(r => own(r) && r.entityType === 'progress' &&
                (r.entityId === f.lessonId || r.payload?.lessonId === f.lessonId ||
                 r.endpoint?.includes(f.lessonId)));
            return {
                dbName,
                course: course ? {id: course.id, totalLessons: course.totalLessons,
                    sizeBytes: course.sizeBytes, videoQuality: course.downloadOptions?.videoQuality} : null,
                lesson: lesson ? {id: lesson.id, sectionIds: (lesson.sections || []).map(s => s.id),
                    hasText: !!lesson.contentHtml || (lesson.sections || []).some(s =>
                        !!s.content || !!s.contentBlocks?.length)} : null,
                checkpoint: checkpoints.some(r => own(r) && r.courseId === f.courseId),
                progress: current ? {completedSectionIds: current.completedSectionIds || [],
                    completed: !!current.completedAt, syncStatus: current.syncStatus,
                    progressPercent: current.progressPercent} : null,
                queue: relevant.map(r => ({entityType: r.entityType, syncStatus: r.syncStatus})),
                pendingProgress: relevant.filter(r => r.syncStatus !== 'synced').length
            };
        } finally { db.close(); }
    }""", fixture)


async def discover_lesson(page):
    user = await api_get(page, "/api/v3/auth/me")
    assert user.get("email") == EMAIL, "Refusing to modify any account except the isolated demo learner"
    assert str(user.get("role", "")).lower() == "student", "Demo identity must be a student"
    enrolled = await api_get(page, "/api/v3/student/courses/enrolled?page=0&size=100")
    courses = enrolled.get("content", []) if isinstance(enrolled, dict) else enrolled
    for course in courses:
        details = await api_get(page, f"/api/v3/courses/{course['id']}")
        if details.get("code", course.get("code")) != "SAF-101":
            continue
        assert details.get("allowOfflineDownload", True), "SAF-101 does not allow offline downloads"
        chapters = await api_get(page, f"/api/v3/courses/{course['id']}/content")
        completed = set(await api_get(page, f"/api/v3/student/progress/courses/{course['id']}/completed-ids"))
        for chapter in chapters:
            for lesson in chapter.get("lessons", []):
                sections = lesson.get("sections") or []
                if lesson["id"] in completed or lesson.get("locked") is True or not sections:
                    continue
                if any(str(s.get("type", "")).upper() != "TEXT" for s in sections):
                    continue
                return {
                    "userId": user["id"], "courseId": course["id"],
                    "courseTitle": course["title"], "chapterTitle": chapter["title"],
                    "lessonId": lesson["id"], "lessonTitle": lesson["title"],
                    "sectionIds": [s["id"] for s in sections],
                }
    raise AssertionError("No incomplete unlocked TEXT-only SAF-101 lesson; do not reset shared demo progress")


async def capture(page, output, name, label):
    if "/auth/" in urlparse(page.url).path:
        return
    await page.evaluate("""label => {
        const old = document.getElementById('pwa-acceptance-evidence'); old?.remove();
        const el = document.createElement('div'); el.id = 'pwa-acceptance-evidence';
        el.textContent = 'REAL DEPLOYED LMS / SYNTHETIC DEMO LEARNER — ' + label;
        el.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483647;' +
            'padding:6px 12px;background:#172554;color:white;font:12px sans-serif;pointer-events:none';
        document.body.append(el);
    }""", label)
    try:
        await page.screenshot(path=str(output / name), full_page=False,
                              mask=[page.locator('input[type="password"]')])
    finally:
        await page.evaluate("document.getElementById('pwa-acceptance-evidence')?.remove()")


def is_complete(snapshot, fixture):
    progress = (snapshot or {}).get("progress") or {}
    return progress.get("completed") and set(fixture["sectionIds"]).issubset(progress.get("completedSectionIds", []))


async def main(args):
    output = (ROOT / args.output).resolve()
    tools_dir = (ROOT / ".tools").resolve()
    assert output.is_relative_to(tools_dir), "Evidence must stay under the repository's ignored .tools directory"
    output.mkdir(parents=True, exist_ok=True)
    password = json.loads((ROOT / args.secrets_file).read_text(encoding="utf-8-sig"))["DEMO_STUDENT_PASSWORD"]
    assert isinstance(password, str) and password, "Demo password is missing"
    report = {
        "startedAt": datetime.now(timezone.utc).isoformat(), "origin": ORIGIN,
        "identity": "Isolated synthetic demo learner; real backend and real course data",
        "mocks": False, "steps": [], "result": "FAIL",
        "limits": ["Headless desktop Chrome; no physical mobile or install-dialog test",
                   "Browser-context offline mode; host networking remains enabled",
                   "One text lesson; offline video and fresh-profile offline first visit are not tested"],
    }
    step = "launch"
    logged_in = False
    browser = None
    page = None
    def passed(name, **data):
        report["steps"].append({"step": name, "result": "PASS", **data})
        print(f"PASS {name}", flush=True)
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(channel="chrome", headless=True)
            context = await browser.new_context(viewport={"width": 1440, "height": 1000},
                                                service_workers="allow", locale="vi-VN")
            page = await context.new_page()
            page.set_default_timeout(30000)
            page.set_default_navigation_timeout(90000)
            report["chromeVersion"] = browser.version
            try:
                step = "real UI login"
                await page.goto(ORIGIN + "/auth/login", wait_until="networkidle")
                await page.locator("#email").fill(EMAIL)
                await page.get_by_role("button", name="Tiếp tục với email", exact=True).click()
                await page.locator("#password").fill(password)
                await page.get_by_role("button", name="Đăng nhập", exact=True).click()
                await page.wait_for_url(re.compile(r"/student(?:/|$)"), timeout=90000)
                fixture = await discover_lesson(page)
                logged_in = True
                report["fixture"] = fixture
                passed(step, lessonTitle=fixture["lessonTitle"])

                step = "download real SAF-101 text course"
                await page.goto(ORIGIN + "/student/courses/library", wait_until="networkidle")
                card = page.locator(".course-card-outer").filter(has_text=fixture["courseTitle"]).first
                await expect(card).to_be_visible()
                await card.locator("app-course-download-button button").first.click()
                await expect(page.get_by_role("heading", name=re.compile(r"Tải về:"))).to_be_visible()
                await page.locator('input[name="videoQuality"][value="none"]').check()
                await page.get_by_role("button", name="Tải về", exact=True).click()
                async def downloaded():
                    value = await read_offline(page, fixture)
                    return value if (value and value["course"] and value["lesson"] and
                                     value["lesson"]["hasText"] and not value["checkpoint"]) else None
                snapshot = await until(step, downloaded, 180)
                assert snapshot["course"]["videoQuality"] == "none", "Download should exclude videos"
                assert set(fixture["sectionIds"]).issubset(snapshot["lesson"]["sectionIds"])
                await capture(page, output, "01-downloaded-course.png", "COURSE DOWNLOAD COMPLETE")
                passed(step, storage=snapshot)

                step = "active controlling service worker"
                lesson_url = f"{ORIGIN}/student/learn/course/{fixture['courseId']}/lesson/{fixture['lessonId']}"
                await page.goto(lesson_url, wait_until="networkidle")
                await expect(page.locator("app-lesson-content")).to_be_visible()
                prose = page.locator("app-lesson-content .lesson-prose").first
                await expect(prose).to_be_visible()
                online_text = " ".join((await prose.inner_text()).split())
                assert len(online_text) >= 80, "Online text lesson is empty or too short for this acceptance"
                await page.wait_for_function("navigator.serviceWorker.controller?.state === 'activated'", timeout=180000)
                worker = await page.evaluate("""async () => {
                    const registration = await navigator.serviceWorker.ready;
                    return {controller: navigator.serviceWorker.controller?.scriptURL,
                            active: registration.active?.state,
                            caches: await caches.keys()};
                }""")
                assert worker["controller"].endswith("/sw-wrapper.js"), "Expected the deployed PWA wrapper"
                assert worker["active"] == "activated"
                assert any(name.startswith("ngsw:") for name in worker["caches"]), "Angular SW caches missing"
                passed(step, serviceWorker=worker,
                       onlineTextSha256=hashlib.sha256(online_text.encode("utf-8")).hexdigest())

                step = "offline reload served by service worker"
                cdp = await context.new_cdp_session(page)
                await cdp.send("Network.enable")
                await cdp.send("Network.setCacheDisabled", {"cacheDisabled": True})
                await context.set_offline(True)
                response = await page.reload(wait_until="domcontentloaded")
                assert response and response.ok and response.from_service_worker, "Offline document did not come from the service worker"
                await expect(page.locator("app-lesson-content")).to_be_visible(timeout=60000)
                await expect(page.locator("#lesson-heading")).to_have_text(fixture["lessonTitle"])
                assert not await page.get_by_text("Lỗi tải bài học", exact=True).count()
                assert not await page.evaluate("navigator.onLine")
                await expect(prose).to_be_visible()
                lesson_text = " ".join((await prose.inner_text()).split())
                assert lesson_text == online_text, "Offline prose does not match the actual online lesson text"
                await capture(page, output, "02-offline-reloaded-lesson.png", "OFFLINE RELOAD / REAL SW CACHE")
                passed(step, fromServiceWorker=True, bodyCharacters=len(lesson_text), httpCacheDisabled=True,
                       offlineTextSha256=hashlib.sha256(lesson_text.encode("utf-8")).hexdigest())

                step = "complete text lesson offline"
                for index in range(len(fixture["sectionIds"])):
                    existing = await read_offline(page, fixture)
                    if is_complete(existing, fixture):
                        break
                    assert f"/lesson/{fixture['lessonId']}" in page.url, "Navigated away before target completion"
                    button = page.locator('[data-wiii-id="mark-lesson-complete"]')
                    await expect(button).to_be_enabled(timeout=30000)
                    await button.click()
                    async def section_saved():
                        value = await read_offline(page, fixture)
                        count = len(((value or {}).get("progress") or {}).get("completedSectionIds", []))
                        return count >= index + 1
                    await until("offline section saved", section_saved, 40)
                async def completed_offline():
                    value = await read_offline(page, fixture)
                    return value if is_complete(value, fixture) and value["pendingProgress"] > 0 else None
                offline_progress = await until(step, completed_offline, 60)
                passed(step, storage=offline_progress)

                step = "offline completion survives reload"
                if page.url != lesson_url:
                    await page.goto(lesson_url, wait_until="domcontentloaded")
                response = await page.reload(wait_until="domcontentloaded")
                assert response and response.ok and response.from_service_worker
                await expect(page.locator("app-lesson-content")).to_be_visible(timeout=60000)
                assert is_complete(await read_offline(page, fixture), fixture)
                await capture(page, output, "03-offline-progress-persisted.png", "OFFLINE PROGRESS PERSISTED AFTER RELOAD")
                passed(step, fromServiceWorker=True)

                step = "reconnect and sync to real backend"
                await context.set_offline(False)
                await page.goto(ORIGIN + "/student/storage", wait_until="networkidle")
                sync = page.get_by_role("button", name="Đồng bộ ngay", exact=True)
                await expect(sync).to_be_enabled(timeout=60000)
                await sync.click()
                async def server_completed():
                    value = await api_get(page, f"/api/v3/student/lessons/{fixture['lessonId']}/progress")
                    local = await read_offline(page, fixture)
                    if (value.get("status") == "COMPLETED" and
                        set(fixture["sectionIds"]).issubset(value.get("completedSections") or []) and
                        local and local["pendingProgress"] == 0):
                        return {"status": value["status"], "completedSections": value["completedSections"],
                                "pendingProgress": local["pendingProgress"]}
                    return None
                server = await until(step, server_completed, 120)
                await capture(page, output, "04-reconnected-synced.png", "RECONNECTED / SERVER PROGRESS CONFIRMED")
                passed(step, backend=server)
                report["result"] = "PASS"
            except Exception:
                if logged_in and page and not page.is_closed():
                    try:
                        await capture(page, output, "failure.png", f"FAILED: {step.upper()}")
                    except Exception:
                        pass
                raise
            finally:
                await context.close()
                await browser.close()
    except Exception as error:
        message = str(error).replace(password, "[REDACTED]")
        message = re.sub(r"eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+", "[REDACTED JWT]", message)
        report["failure"] = {"step": step, "type": type(error).__name__, "message": message[:2000]}
        print(f"FAIL {step}: {type(error).__name__}: {message[:2000]}", flush=True)
    finally:
        report["finishedAt"] = datetime.now(timezone.utc).isoformat()
        (output / "summary.local.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"Evidence: {output}", flush=True)
    return 0 if report["result"] == "PASS" else 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--secrets-file", default=".tools/free-demo-secrets.local.json",
                        help="Ignored JSON containing DEMO_STUDENT_PASSWORD; no value is printed")
    parser.add_argument("--output", default=".tools/demo-pwa", help="Evidence directory under ignored .tools")
    arguments = parser.parse_args()
    sys.exit(asyncio.run(main(arguments)))
