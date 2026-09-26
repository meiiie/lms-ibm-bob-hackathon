"""Real Chrome UI acceptance with synthetic LMS identity and provider responses.

Start the Angular development server separately, then run:
    python scripts/verify-ai-sidebar.py --base-url http://127.0.0.1:4311

This does not contact ChatGPT or perform consent. --real-local explicitly tests
one question with the already-running Ollama server and gemma3:4b model.
It never opens a persistent browser profile. Artifacts default to ignored .tools/.
Requires the team's existing Python Playwright installation and Google Chrome.
"""

import argparse
import asyncio
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse

from playwright.async_api import async_playwright, expect


USER = {
    "id": "00000000-0000-4000-8000-000000000026",
    "email": "qa@example.invalid",
    "username": "qa",
    "fullName": "Synthetic sidebar QA",
    "role": "student",
    "enabled": True,
}
PREFIX = "/api/v3/ai/chatgpt/"
ANSWER = "Synthetic study answer: <img src=x onerror=alert(1)> is plain text."


class Fixture:
    def __init__(self, *, enabled=False, wiii=True, real_local=False):
        self.enabled = enabled
        self.wiii = wiii
        self.offline = False
        self.cloud_blocked = False
        self.real_local = real_local
        self.local_calls = []
        self.local_delay = 0.2
        self.local_failure = False
        self.connection = "disconnected"
        self.allow_connection = False
        self.ask_failure = False
        self.calls = []
        self.errors = []
        self.expiry = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()

    def status(self):
        data = {
            "enabled": self.enabled,
            "status": self.connection,
            "expiresAt": self.expiry if self.connection != "disconnected" else None,
            "attemptId": None,
            "verificationUri": None,
            "userCode": None,
            "intervalSeconds": 5,
        }
        if self.connection == "pending":
            data.update(
                attemptId="00000000-0000-4000-8000-000000000099",
                verificationUri="https://auth.openai.com/codex/device",
                userCode="QA-FIXTURE",
            )
        return data

    def count(self, suffix, method=None):
        return sum(
            call["path"].endswith(suffix) and (method is None or call["method"] == method)
            for call in self.calls
        )

    def mutations(self):
        return [call for call in self.calls if call["path"].startswith(PREFIX) and call["method"] != "GET"]

    async def handle(self, route):
        request = route.request
        url = urlparse(request.url)
        if url.hostname == "127.0.0.1" and url.port in (11434, 1234):
            headers = await request.all_headers()
            self.local_calls.append({
                "path": url.path, "port": url.port, "method": request.method,
                "body": request.post_data, "headers": headers,
            })
            if self.real_local and url.port == 11434:
                await route.continue_()
                return
            cors = {
                "Access-Control-Allow-Origin": headers.get("origin", "*"),
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "Accept, Content-Type",
            }
            if request.method == "OPTIONS":
                await route.fulfill(status=204, headers=cors)
            elif self.local_failure:
                await route.abort("connectionrefused")
            elif url.path == "/api/tags":
                await route.fulfill(headers=cors, json={"models": [
                    {"name": "qa-local-model:latest"}, {"name": "qa-second:latest"},
                    {"name": "qa-cloud:latest"}, {"name": "qa-remote:latest", "remote_host": "https://example.invalid"},
                ]})
            elif url.path == "/v1/models":
                await route.fulfill(headers=cors, json={"data": [{"id": "qa-lmstudio-model"}]})
            else:
                await asyncio.sleep(self.local_delay)
                data = {"message": {"content": ANSWER}} if url.port == 11434 else {"choices": [{"message": {"content": ANSWER}}]}
                await route.fulfill(headers=cors, json=data)
            return
        if url.path.startswith("/api/"):
            self.calls.append({"path": url.path, "method": request.method, "body": request.post_data})
        if self.offline or (self.cloud_blocked and (url.path.startswith("/api/") or url.path == "/health")):
            await route.abort("internetdisconnected")
            return
        if url.hostname == "localhost" and url.port == 8000:
            await route.fulfill(content_type="text/html", body="<p>Synthetic Wiii iframe fixture</p>")
            return
        if url.hostname not in ("127.0.0.1", "localhost"):
            await route.abort()
            return
        if url.path == "/health":
            await route.fulfill(body="OK")
            return
        if not url.path.startswith("/api/"):
            await route.continue_()
            return
        data = []
        if url.path.endswith("/auth/me"):
            data = USER
        elif url.path.endswith("/ai/health"):
            data = {"status": "healthy", "aiServiceStatus": "configured" if self.wiii else "unknown", "webhookEnabled": self.wiii}
        elif url.path.endswith("/unread-count"):
            data = 0
        elif url.path.endswith("/ai/token"):
            await asyncio.sleep(0.2)
            data = {"access_token": "synthetic-ai-token", "refresh_token": "synthetic-refresh", "token_type": "Bearer"}
        elif url.path.startswith(PREFIX):
            endpoint = url.path.removeprefix(PREFIX)
            if endpoint == "device":
                await asyncio.sleep(0.2)
                self.connection = "pending"
            elif endpoint == "poll":
                if self.allow_connection:
                    self.connection = "connected"
            elif endpoint == "connection" and request.method == "DELETE":
                self.connection = "disconnected"
            elif endpoint == "ask":
                await asyncio.sleep(0.2)
                if self.ask_failure:
                    await route.fulfill(status=429, json={"success": False, "message": "ChatGPT is busy. Try again shortly.", "code": "rate_limited"})
                    return
                data = {"answer": ANSWER}
            if endpoint != "ask":
                data = self.status()
        await route.fulfill(headers={"Cache-Control": "no-store"}, json={"success": True, "data": data})


async def create_page(browser, fixture, base_url, *, mobile=False, cold_offline=False):
    context = await browser.new_context(
        viewport={"width": 375, "height": 812} if mobile else {"width": 1440, "height": 1000},
        is_mobile=mobile, has_touch=mobile, device_scale_factor=1, service_workers="block",
    )
    await context.add_init_script(
        "localStorage.setItem('lms_access_token','test-fixture-only');"
        "localStorage.setItem('lms_refresh_token','fixture.'+btoa(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600}))+'.not-a-signature');"
        "localStorage.setItem('lms_user'," + json.dumps(json.dumps(USER)) + ");"
    )
    if cold_offline:
        fixture.cloud_blocked = True
        await context.add_init_script("Object.defineProperty(navigator, 'onLine', {get: () => false, configurable: true});")
    page = await context.new_page()
    page.on("pageerror", lambda error: fixture.errors.append(str(error)))
    await context.route("**/*", fixture.handle)
    await page.goto(base_url + "/student/storage")
    await page.wait_for_load_state("networkidle")
    await page.evaluate("""realLocal => {
      const note = document.createElement('div');
      note.textContent = realLocal
        ? 'QA: synthetic LMS; REAL local Ollama response. Cloud blocked; loopback allowed. No ChatGPT consent.'
        : 'SYNTHETIC QA: LMS identity + provider responses are fixtures. No live ChatGPT consent.';
      note.style.cssText = 'position:fixed;bottom:4px;left:4px;max-width:min(660px,calc(100vw - 8px));padding:6px 10px;background:#111827;color:white;font:11px sans-serif;z-index:2147483647;pointer-events:none';
      document.body.appendChild(note);
    }""", fixture.real_local)
    return context, page


async def open_panel(page):
    await page.get_by_role("button", name="Mở trợ lý AI", exact=True).click()
    panel = page.locator("app-chat-panel")
    # Mobile uses a fixed child, so its Angular host can legitimately have zero height.
    await expect(panel.locator(".chat-panel")).to_be_visible()
    return panel


async def queue_entries(page):
    return await page.evaluate("""async () => {
      const results = [];
      for (const info of await indexedDB.databases()) {
        const db = await new Promise((resolve, reject) => {
          const request = indexedDB.open(info.name);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        try {
          if (db.objectStoreNames.contains('syncQueue')) {
            const rows = await new Promise((resolve, reject) => {
              const request = db.transaction('syncQueue').objectStore('syncQueue').getAll();
              request.onsuccess = () => resolve(request.result);
              request.onerror = () => reject(request.error);
            });
            results.push(...rows);
          }
        } finally { db.close(); }
      }
      return results;
    }""")


async def set_offline(context, fixture, value):
    fixture.offline = value
    await context.set_offline(value)


async def wiii_regression(browser, base_url, output, passes):
    fixture = Fixture()
    context, page = await create_page(browser, fixture, base_url)
    try:
        await set_offline(context, fixture, True)
        panel = await open_panel(page)
        await expect(panel).to_contain_text("Không có kết nối mạng", timeout=12000)
        await expect(panel.get_by_role("combobox", name="AI provider")).to_have_value("wiii")
        await expect(panel.locator('option[value="chatgpt"]')).to_have_count(0)
        await expect(panel.locator('option[value="local"]')).to_have_count(1)
        await expect(panel.locator("iframe")).to_have_count(0)
        assert fixture.count("/ai/token") == 0, "Offline open exchanged a Wiii token"
        assert await queue_entries(page) == [], "Offline open queued a mutation"
        await page.screenshot(path=str(output / "wiii-offline.png"), full_page=True)
        passes.append("Disabled ChatGPT preserves Wiii and local choice; offline open has guidance, no token, iframe, or queue entry")
        await set_offline(context, fixture, False)
        retry = panel.get_by_role("button", name="Thử kết nối lại trợ lý AI", exact=True)
        await expect(retry).to_be_visible(timeout=12000)
        assert fixture.count("/ai/token") == 0, "Reconnect automatically exchanged Wiii token"
        await retry.evaluate("button => { button.click(); button.click(); }")
        await expect(page.frame_locator('iframe[data-wiii-id="wiii-iframe"]').get_by_text("Synthetic Wiii iframe fixture")).to_be_visible()
        assert fixture.count("/ai/token") == 1, "Double retry exchanged more than one token"
        passes.append("Wiii recovery is manual; duplicate retry issues exactly one token request")
        await page.evaluate("() => { const f=document.createElement('iframe'); f.id='unrelated-fixture'; f.src='http://localhost:8000/unrelated'; document.body.appendChild(f); }")
        await expect(page.frame_locator("#unrelated-fixture").get_by_text("Synthetic Wiii iframe fixture")).to_be_visible()
        unrelated = next(frame for frame in page.frames if frame.url.endswith("/unrelated"))
        await unrelated.evaluate("parent.postMessage({type:'wiii:auth-expired'}," + json.dumps(base_url) + ")")
        await page.wait_for_timeout(350)
        assert fixture.count("/ai/token") == 1, "Unrelated window triggered token refresh"
        legitimate = next(frame for frame in page.frames if "/embed" in frame.url)
        await legitimate.evaluate("origin => { parent.postMessage({type:'wiii:auth-expired'},origin); parent.postMessage({type:'wiii:auth-expired'},origin); }", base_url)
        await page.wait_for_timeout(550)
        assert fixture.count("/ai/token") == 2, "Valid duplicate refresh did not issue exactly one request"
        passes.append("Wiii rejects a different iframe from its trusted origin and deduplicates legitimate refresh")
        await set_offline(context, fixture, True)
        await expect(panel).to_contain_text("Không có kết nối mạng", timeout=12000)
        await expect(panel.locator("iframe")).to_have_count(0)
        await panel.get_by_role("button", name="Đóng trợ lý AI", exact=True).click()
        await expect(panel).to_have_count(0)
        assert await queue_entries(page) == []
        assert not fixture.errors, fixture.errors
        passes.append("Wiii network loss removes iframe; closing works with zero uncaught page errors")
    except Exception:
        await page.screenshot(path=str(output / "wiii-failure.png"), full_page=True)
        raise
    finally:
        (output / "wiii-fixture-requests.local.json").write_text(json.dumps(fixture.calls, indent=2), encoding="utf-8")
        await context.close()


async def chatgpt_flow(browser, base_url, output, passes):
    fixture = Fixture(enabled=True, wiii=False)
    context, page = await create_page(browser, fixture, base_url)
    try:
        panel = await open_panel(page)
        provider = panel.get_by_role("combobox", name="AI provider")
        await expect(provider).to_have_value("chatgpt")
        assistant = panel.get_by_role("region", name="ChatGPT study assistant")
        await expect(assistant).to_be_visible()
        assert fixture.count("/ai/token") == 0, "ChatGPT-only opening exchanged a Wiii token"
        connect = assistant.get_by_role("button", name="Connect ChatGPT", exact=True)
        await expect(connect).to_be_enabled()
        await connect.evaluate("button => { button.click(); button.click(); }")
        code = assistant.get_by_test_id("chatgpt-user-code")
        await expect(code).to_have_text("QA-FIXTURE")
        assert fixture.count("/device", "POST") == 1, "Duplicate connect created multiple attempts"
        verification = assistant.get_by_role("link", name="Open ChatGPT verification")
        await expect(verification).to_have_attribute("href", "https://auth.openai.com/codex/device")
        await expect(verification).to_have_attribute("target", "_blank")
        await page.screenshot(path=str(output / "chatgpt-pending-fixture.png"), full_page=True)
        passes.append("ChatGPT is usable with Wiii unavailable; duplicate connect yields one attempt and a verification link/code")
        fixture.allow_connection = True
        question = assistant.get_by_role("textbox", name="Your study question")
        await expect(question).to_be_visible(timeout=15000)
        await question.fill("Explain a nautical mile in one sentence.")
        send = assistant.get_by_role("button", name="Send question", exact=True)
        await send.evaluate("button => { button.click(); button.click(); }")
        await expect(assistant.get_by_test_id("chatgpt-answer")).to_have_text(ANSWER)
        assert fixture.count("/ask", "POST") == 1, "Duplicate send submitted multiple questions"
        payload = json.loads(next(call["body"] for call in fixture.calls if call["path"].endswith("/ask")))
        assert payload == {"question": "Explain a nautical mile in one sentence."}, payload
        await expect(assistant.get_by_test_id("chatgpt-answer").locator("img, script")).to_have_count(0)
        await page.screenshot(path=str(output / "chatgpt-answer-fixture.png"), full_page=True)
        passes.append("Pending polling reaches connected; explicit question sends once with no course data; answer HTML remains plain text")
        fixture.ask_failure = True
        await question.fill("A second synthetic question")
        await send.click()
        await expect(assistant.get_by_role("alert")).to_be_visible()
        await expect(send).to_be_enabled()
        fixture.ask_failure = False
        await send.click()
        await expect(assistant.get_by_test_id("chatgpt-answer")).to_have_text(ANSWER)
        passes.append("A provider 429 displays a recoverable error; explicit retry returns an answer")
        await set_offline(context, fixture, True)
        await expect(assistant).to_contain_text("ChatGPT needs an internet connection.", timeout=12000)
        mutation_count = len(fixture.mutations())
        await page.wait_for_timeout(1500)
        assert len(fixture.mutations()) == mutation_count, "An offline ChatGPT mutation was attempted"
        assert await queue_entries(page) == [], "Offline ChatGPT polluted the sync queue"
        await set_offline(context, fixture, False)
        resume = assistant.get_by_role("button", name="Resume connection", exact=True)
        await expect(resume).to_be_visible(timeout=12000)
        await page.wait_for_timeout(1200)
        assert len(fixture.mutations()) == mutation_count, "Reconnect automatically replayed a ChatGPT mutation"
        await resume.click()
        await expect(question).to_be_visible()
        await assistant.get_by_role("button", name="Disconnect", exact=True).click()
        await expect(connect).to_be_visible()
        await expect(assistant.get_by_test_id("chatgpt-answer")).to_have_count(0)
        await expect(code).to_have_count(0)
        assert fixture.count("/connection", "DELETE") == 1
        assert not fixture.errors, fixture.errors
        passes.append("Offline ChatGPT has no queue or replay; manual resume works; disconnect clears code/answer with no page errors")
    except Exception:
        await page.screenshot(path=str(output / "chatgpt-failure.png"), full_page=True)
        raise
    finally:
        (output / "chatgpt-fixture-requests.local.json").write_text(json.dumps(fixture.calls, indent=2), encoding="utf-8")
        await context.close()


async def pending_lifecycle(browser, base_url, output, passes):
    fixture = Fixture(enabled=True, wiii=False)
    context, page = await create_page(browser, fixture, base_url)
    try:
        panel = await open_panel(page)
        assistant = panel.get_by_role("region", name="ChatGPT study assistant")
        await assistant.get_by_role("button", name="Connect ChatGPT", exact=True).click()
        await expect(assistant.get_by_test_id("chatgpt-user-code")).to_be_visible()
        await set_offline(context, fixture, True)
        await expect(assistant).to_contain_text("ChatGPT needs an internet connection.", timeout=12000)
        polls = fixture.count("/poll", "POST")
        await page.wait_for_timeout(6000)
        assert fixture.count("/poll", "POST") == polls, "Pending connection kept polling offline"
        await set_offline(context, fixture, False)
        resume = assistant.get_by_role("button", name="Resume connection", exact=True)
        await expect(resume).to_be_visible(timeout=12000)
        await page.wait_for_timeout(6000)
        assert fixture.count("/poll", "POST") == polls, "Pending connection resumed polling automatically"
        await resume.click()
        await expect(assistant.get_by_test_id("chatgpt-user-code")).to_be_visible()
        await assistant.get_by_role("button", name="Cancel connection", exact=True).click()
        await expect(assistant.get_by_role("button", name="Connect ChatGPT", exact=True)).to_be_visible()
        polls = fixture.count("/poll", "POST")
        await page.wait_for_timeout(6000)
        assert fixture.count("/poll", "POST") == polls, "Cancelled connection kept polling"
        await assistant.get_by_role("button", name="Connect ChatGPT", exact=True).click()
        await expect(assistant.get_by_test_id("chatgpt-user-code")).to_be_visible()
        await panel.get_by_role("button", name="Đóng trợ lý AI", exact=True).click()
        await expect(panel).to_have_count(0)
        polls = fixture.count("/poll", "POST")
        await page.wait_for_timeout(6000)
        assert fixture.count("/poll", "POST") == polls, "Destroyed panel kept polling"
        assert await queue_entries(page) == [], "Pending lifecycle polluted the sync queue"
        assert not fixture.errors, fixture.errors
        passes.append("Pending authorization stops polling offline, after cancellation, and on panel destruction; reconnect requires manual resume")
    except Exception:
        await page.screenshot(path=str(output / "pending-failure.png"), full_page=True)
        raise
    finally:
        (output / "pending-fixture-requests.local.json").write_text(json.dumps(fixture.calls, indent=2), encoding="utf-8")
        await context.close()


async def assert_panel_ux(page, panel):
    measurements = await panel.evaluate("""host => {
      const surface = host.querySelector('.chat-panel');
      const bounds = surface.getBoundingClientRect();
      const controls = [...host.querySelectorAll('button, select, textarea, a[href], summary')]
        .filter(node => node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden')
        .map(node => {
          const rect = node.getBoundingClientRect();
          return {label:node.getAttribute('aria-label') || node.textContent.trim().slice(0,60),width:rect.width,height:rect.height};
        });
      return {left:bounds.left,right:bounds.right,viewport:innerWidth,
        width:surface.clientWidth,scroll:surface.scrollWidth,controls};
    }""")
    assert measurements["left"] >= -1 and measurements["right"] <= measurements["viewport"] + 1, measurements
    assert measurements["scroll"] <= measurements["width"] + 1, measurements
    small = [control for control in measurements["controls"] if control["height"] < 43.5 or control["width"] < 43.5]
    assert not small, f"Controls smaller than 44px: {small}"
    await panel.get_by_role("button", name="Đóng trợ lý AI", exact=True).focus()
    await page.keyboard.press("Tab")
    focus = await page.evaluate("""() => ({
      inside:!!document.activeElement?.closest('app-chat-panel'),
      outline:getComputedStyle(document.activeElement).outlineStyle,
      width:parseFloat(getComputedStyle(document.activeElement).outlineWidth)
    })""")
    assert focus["inside"] and focus["outline"] != "none" and focus["width"] > 0, focus


async def assert_unobstructed(button):
    await button.scroll_into_view_if_needed()
    hits = await button.evaluate("""element => {
      const rect = element.getBoundingClientRect();
      return [5,rect.height/2,rect.height-5].map(offset => {
        const hit = document.elementFromPoint(rect.x+rect.width/2,rect.y+offset);
        return {y:rect.y+offset,owns:hit===element || element.contains(hit),blocking:hit?.className};
      });
    }""")
    assert all(hit["owns"] for hit in hits), f"Button is partially or fully obscured: {hits}"


async def draft_and_mobile_ux(browser, base_url, output, passes, *, mobile):
    fixture = Fixture(enabled=True, wiii=False)
    fixture.connection = "connected"
    context, page = await create_page(browser, fixture, base_url, mobile=mobile)
    name = "mobile" if mobile else "desktop"
    try:
        panel = await open_panel(page)
        assistant = panel.get_by_role("region", name="ChatGPT study assistant")
        question = assistant.get_by_role("textbox", name="Your study question")
        await expect(question).to_be_visible()
        await expect(assistant).to_contain_text("Cloud · online only")
        await assert_panel_ux(page, panel)
        await assistant.get_by_role("button", name="Explain a concept", exact=True).click()
        await expect(question).to_have_value("Explain this concept in plain language, with one practical example: ")
        assert fixture.count("/ask", "POST") == 0, "A question starter automatically sent a question"
        await question.fill("")
        await page.evaluate("""() => {
          const lesson = document.createElement('article');
          lesson.id = 'qa-lesson-passage';
          lesson.textContent = 'One nautical mile equals 1852 metres.';
          const record = document.createElement('p');
          record.textContent = 'PRIVATE_NOT_SELECTED: studentrecord@example.invalid';
          document.body.append(lesson,record);
          const selection = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(lesson);
          selection.removeAllRanges(); selection.addRange(range);
        }""")
        asks = fixture.count("/ask", "POST")
        await assistant.get_by_role("button", name="Add selected passage", exact=True).click()
        await expect(question).to_have_value("Selected passage:\nOne nautical mile equals 1852 metres.")
        await expect(assistant).to_contain_text("Review it before sending")
        assert fixture.count("/ask", "POST") == asks, "Adding selected text automatically sent it"
        await page.screenshot(path=str(output / f"chatgpt-{name}-draft-fixture.png"), full_page=not mobile)
        await assistant.get_by_role("button", name="Send question", exact=True).click()
        await expect(assistant.get_by_test_id("chatgpt-answer")).to_have_text(ANSWER)
        body = json.loads([call for call in fixture.calls if call["path"].endswith("/ask")][-1]["body"])
        assert body == {"question": "Selected passage:\nOne nautical mile equals 1852 metres."}, body
        await set_offline(context, fixture, True)
        await expect(assistant).to_contain_text("ChatGPT needs an internet connection.", timeout=12000)
        # A fresh provider panel must also support drafting before it has any status.
        await panel.get_by_role("combobox", name="AI provider").select_option("local")
        await panel.get_by_role("combobox", name="AI provider").select_option("chatgpt")
        await assistant.get_by_role("button", name="Revision plan", exact=True).click()
        await expect(question).to_have_value("Help me make a short revision plan for this topic: ")
        await expect(assistant.get_by_role("button", name="Send question", exact=True)).to_be_disabled()
        before = len(fixture.mutations())
        await page.wait_for_timeout(500)
        assert len(fixture.mutations()) == before
        assert await queue_entries(page) == []
        await page.screenshot(path=str(output / f"chatgpt-{name}-offline-draft-fixture.png"), full_page=not mobile)
        await set_offline(context, fixture, False)
        await expect(assistant.get_by_role("button", name="Resume connection", exact=True)).to_be_visible(timeout=12000)
        await expect(question).to_have_value("Help me make a short revision plan for this topic: ")
        await expect(assistant.get_by_role("button", name="Send question", exact=True)).to_be_disabled()
        assert len(fixture.mutations()) == before, "Offline draft automatically sent on reconnect"
        assert not fixture.errors, fixture.errors
        passes.append(f"{name.capitalize()} ChatGPT: no horizontal overflow, 44px controls, keyboard focus, explicit selected-passage draft without other DOM records, offline draft with no autosend")
    except Exception:
        await page.screenshot(path=str(output / f"chatgpt-{name}-ux-failure.png"), full_page=not mobile)
        raise
    finally:
        await context.close()


def assert_local_request_privacy(fixture):
    for call in fixture.local_calls:
        assert "authorization" not in call["headers"], "LMS authorization leaked to local server"
        assert "cookie" not in call["headers"], "Cookies leaked to local server"
        assert "referer" not in call["headers"], "LMS referrer leaked to local server"
        assert call["port"] in (11434, 1234)


async def local_flow(browser, base_url, output, passes, *, mobile=False, real=False):
    fixture = Fixture(wiii=False, real_local=real)
    context, page = await create_page(browser, fixture, base_url, mobile=mobile, cold_offline=True)
    name = "real-ollama" if real else "local-mobile" if mobile else "local-desktop"
    try:
        panel = await open_panel(page)
        provider = panel.get_by_role("combobox", name="AI provider")
        await expect(provider).to_have_value("local")
        assistant = panel.get_by_role("region", name="Local study assistant")
        await expect(assistant).to_be_visible()
        await expect(panel.locator('option[value="chatgpt"]')).to_have_count(0)
        assert fixture.local_calls == [], "Local server was probed without a user action"
        assert not [call for call in fixture.calls if call["path"].startswith("/api/v3/ai/")], "Offline assistant automatically queried LMS AI API"
        await assert_panel_ux(page, panel)
        check = assistant.get_by_role("button", name="Check connection", exact=True)
        await check.click()
        models = assistant.get_by_role("combobox", name="Downloaded model", exact=True)
        await expect(models).to_be_visible(timeout=15000)
        options = await models.locator("option").all_text_contents()
        if real:
            assert "gemma3:4b" in options, f"Required already-installed model absent: {options}"
            await models.select_option("gemma3:4b")
        else:
            assert options == ["qa-local-model:latest", "qa-second:latest"], options
            await models.select_option("qa-second:latest")
        question = assistant.get_by_role("textbox", name="Your study question")
        prompt = "What is one nautical mile? Answer in one short sentence." if real else "Explain a nautical mile."
        await question.fill(prompt)
        send = assistant.get_by_role("button", name="Send question", exact=True)
        await assert_unobstructed(send)
        await send.click()
        answer = assistant.get_by_test_id("local-model-answer")
        if real:
            await expect(answer).to_be_visible(timeout=95000)
            response = await answer.inner_text()
            assert len(response.strip()) >= 15, response
            (output / "real-ollama-answer.local.json").write_text(json.dumps({"model":"gemma3:4b","question":prompt,"answer":response,"lms_identity":"synthetic","cloud":"blocked in browser routes, loopback allowed"}, ensure_ascii=False, indent=2), encoding="utf-8")
        else:
            await expect(answer).to_have_text(ANSWER)
        await expect(answer.locator("img,script")).to_have_count(0)
        posted = [call for call in fixture.local_calls if call["method"] == "POST"]
        assert len(posted) == 1, posted
        body = json.loads(posted[0]["body"])
        assert body["messages"] == [{"role": "user", "content": prompt}], body
        assert body["keep_alive"] == 0, body
        assert_local_request_privacy(fixture)
        assert await queue_entries(page) == []
        await answer.scroll_into_view_if_needed()
        await page.screenshot(path=str(output / f"{name}-answer.png"), full_page=not mobile)
        if not real:
            fixture.local_delay = 1.5
            await question.fill("Cancel this synthetic generation")
            await send.click()
            await assistant.get_by_role("button", name="Cancel request", exact=True).click()
            await expect(assistant).to_contain_text("Request cancelled")
            await page.wait_for_timeout(1800)
            await expect(answer).to_have_count(0)
            runtime = assistant.get_by_role("combobox", name="Local server", exact=True)
            await question.fill("Switch runtime while this synthetic answer is pending")
            await send.click()
            await expect(assistant.get_by_role("button", name="Cancel request", exact=True)).to_be_visible()
            calls = sum(call["port"] == 1234 for call in fixture.local_calls)
            await runtime.select_option("lmstudio")
            await page.wait_for_timeout(1800)
            assert sum(call["port"] == 1234 for call in fixture.local_calls) == calls, "Changing runtime automatically probed the new server"
            await expect(answer).to_have_count(0)
            await expect(models).to_have_count(0)
            fixture.local_failure = True
            await check.click()
            await expect(assistant.get_by_role("alert")).to_contain_text("Cannot reach the local server")
            fixture.local_failure = False
            fixture.local_delay = 0.2
            await check.click()
            await expect(models).to_have_value("qa-lmstudio-model")
            await question.fill("A synthetic LM Studio study question")
            await send.click()
            await expect(answer).to_have_text(ANSWER)
            assert_local_request_privacy(fixture)
            assert await queue_entries(page) == []
        assert not fixture.errors, fixture.errors
        passes.append(("REAL Ollama gemma3:4b answer in Chrome with synthetic LMS and simulated cloud outage; " if real else f"{name} synthetic Ollama/LM Studio: ")
                      + "explicit discovery, local models only, no LMS JWT/cookies/referrer, plain answer, no offline queue"
                      + ("" if real else ", cancel/switch and recoverable missing-server error"))
    except Exception:
        await page.screenshot(path=str(output / f"{name}-failure.png"), full_page=not mobile)
        raise
    finally:
        (output / f"{name}-requests.local.json").write_text(json.dumps(fixture.local_calls, indent=2), encoding="utf-8")
        await context.close()


async def main(args):
    output = Path(args.output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    passes = []
    summary = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "scope": ("Real Chrome; SYNTHETIC LMS identity and provider fixtures, with one optional REAL local Ollama check"
                  if args.real_local else "Real Chrome rendering of LMS with SYNTHETIC identity/provider HTTP responses"),
        "limits": "No live ChatGPT consent/answer, real backend transport, installed PWA/service-worker or production HTTPS local-network permission verification. Mobile is Chrome viewport/touch emulation, not a physical phone. Cloud outage is simulated; host networking remains enabled.",
        "passed": passes,
    }
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(channel="chrome", headless=True)
        summary["browser"] = browser.version
        try:
            await wiii_regression(browser, args.base_url.rstrip("/"), output, passes)
            if not args.wiii_only:
                await chatgpt_flow(browser, args.base_url.rstrip("/"), output, passes)
                await pending_lifecycle(browser, args.base_url.rstrip("/"), output, passes)
                for mobile in (False, True):
                    await draft_and_mobile_ux(browser, args.base_url.rstrip("/"), output, passes, mobile=mobile)
                    await local_flow(browser, args.base_url.rstrip("/"), output, passes, mobile=mobile)
                if args.real_local:
                    await local_flow(browser, args.base_url.rstrip("/"), output, passes, real=True)
            summary["result"] = "PASS"
        except Exception as error:
            summary["result"] = "FAIL"
            summary["failure"] = str(error)
            raise
        finally:
            (output / "summary.local.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
            for passed in passes:
                print("PASS:", passed)
            print("LIMIT:", summary["limits"])
            await browser.close()


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:4311")
    parser.add_argument("--output", default=".tools/ai-sidebar-browser")
    parser.add_argument("--wiii-only", action="store_true")
    parser.add_argument("--real-local", action="store_true", help="Also ask one real question using already-running Ollama gemma3:4b")
    asyncio.run(main(parser.parse_args()))
