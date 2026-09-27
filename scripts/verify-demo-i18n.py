"""Real Chrome language/offline acceptance; no login credentials or mocked API."""
import argparse
import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright, expect


async def wait_for_async(page, expression, *, arg=None, timeout=90000, polling=1000):
    # This Playwright version treats the Promise itself as truthy in wait_for_function.
    # Await evaluate in Python so a false CacheStorage/worker result actually waits.
    deadline = asyncio.get_running_loop().time() + timeout / 1000
    while asyncio.get_running_loop().time() < deadline:
        result = await page.evaluate(expression, arg)
        if result:
            return result
        await asyncio.sleep(polling / 1000)
    raise TimeoutError('Service-worker acceptance condition did not become true')


async def verify(base_url, output):
    output.mkdir(parents=True, exist_ok=True)
    checks = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(channel='chrome', headless=True)
        try:
            context = await browser.new_context(service_workers='block')
            page = await context.new_page()
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            await page.goto(base_url + '/auth/login', wait_until='networkidle')
            vi_title = await page.locator('h1').inner_text()
            await page.get_by_role('button', name='EN', exact=True).click()
            await expect(page.locator('h1')).to_have_text('Sign in')
            await page.get_by_role('button', name='VI', exact=True).click()
            await expect(page.locator('h1')).to_have_text(vi_title)
            await page.get_by_role('button', name='EN', exact=True).click()

            async def slow_catalog(route):
                await asyncio.sleep(1)
                await route.continue_()

            # Delay the real response to expose cold-start instant() caching races.
            await page.route('**/locales/en.json', slow_catalog)
            await page.reload(wait_until='networkidle')
            await expect(page.locator('h1')).to_have_text('Sign in')
            checks.append('Login EN/VI switching and saved EN with delayed real catalog')
            await expect(page.get_by_role('button', name='Continue with email', exact=True)).to_be_visible()
            await expect(page.locator('.google-unavailable-copy')).to_contain_text('Please use email and password.')
            await page.screenshot(path=str(output / 'english-login.png'), full_page=True)
            await page.set_viewport_size({'width': 390, 'height': 844})
            await expect(page.get_by_role('button', name='EN', exact=True)).to_be_visible()
            assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            await page.screenshot(path=str(output / 'english-login-mobile.png'), full_page=True)
            checks.append('Mobile language switch visible without horizontal overflow')
            assert not errors, errors
            await context.close()

            context = await browser.new_context(service_workers='allow')
            page = await context.new_page()
            await page.goto(base_url + '/auth/login', wait_until='networkidle')
            await page.get_by_role('button', name='EN', exact=True).click()
            await expect(page.locator('h1')).to_have_text('Sign in')
            await page.wait_for_function("navigator.serviceWorker.controller?.state === 'activated'", timeout=90000)
            manifest = await page.evaluate("async () => (await fetch('/ngsw.json?ngsw-bypass=true')).json()")
            prefetch = [url for group in manifest['assetGroups'] if group.get('installMode') == 'prefetch'
                        for url in group.get('urls', [])]
            await wait_for_async(page, """async urls => {
              const names = (await caches.keys()).filter(n => n.includes(':assets:') && n.endsWith(':cache'));
              const stores = await Promise.all(names.map(n => caches.open(n)));
              for (const url of urls) {
                if (!(await Promise.all(stores.map(s => s.match(url)))).some(r => r?.ok)) return false;
              }
              return true;
            }""", arg=prefetch, timeout=180000)
            await wait_for_async(page, """async () => {
              const urls = (await Promise.all((await caches.keys()).map(async key =>
                (await (await caches.open(key)).keys()).map(r => new URL(r.url).pathname)))).flat();
              return ['/locales/vi.json','/locales/en.json','/locales/legacy-ui.en.json'].every(u => urls.includes(u));
            }""", timeout=90000)
            await wait_for_async(page, """async () => {
              const state = await (await fetch('/ngsw/state')).text();
              return state.includes('Driver state: NORMAL') && !state.includes('* initialization(');
            }""", polling=5000, timeout=180000)
            worker_state = await page.evaluate("async () => (await fetch('/ngsw/state')).text()")
            (output / 'ngsw-state-online.txt').write_text(worker_state, encoding='utf8')
            assert 'Driver state: NORMAL' in worker_state, worker_state
            assert '* initialization(' not in worker_state, 'Service-worker initialization is pending'
            cdp = await context.new_cdp_session(page)
            await cdp.send('Network.clearBrowserCache')
            await cdp.detach()
            await context.set_offline(True)
            response = await page.reload(wait_until='domcontentloaded')
            assert response and response.ok and response.from_service_worker
            await page.wait_for_function("document.documentElement.lang === 'en'")
            await expect(page.get_by_role('button', name='VI', exact=True)).to_be_visible()
            english_offline = await page.locator('h1').inner_text()
            catalog = json.loads((Path(__file__).resolve().parents[1] / 'fe/public/locales/en.json').read_text('utf8'))
            await expect(page.locator('h1')).to_have_text(catalog['offline']['title'])
            english_offline = catalog['offline']['title']
            await page.get_by_role('button', name='VI', exact=True).click()
            await expect(page.locator('h1')).not_to_have_text(english_offline)
            await page.get_by_role('button', name='EN', exact=True).click()
            await expect(page.locator('h1')).to_have_text(english_offline)
            assert await page.evaluate('navigator.onLine') is False
            await page.screenshot(path=str(output / 'english-offline.png'), full_page=True)
            checks.append('All three locale catalogs cached; real offline reload and EN/VI switch')
            await context.close()
        finally:
            await browser.close()
    result = {'base_url': base_url, 'checks': checks, 'status': 'passed',
              'limits': 'Desktop Chrome and mobile viewport emulation; no physical phone or installed PWA.'}
    (output / 'summary.json').write_text(json.dumps(result, indent=2), encoding='utf8')
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--base-url', default='https://neko-core-lms-demo.pages.dev')
    parser.add_argument('--output', type=Path, default=Path('.tools/demo-i18n'))
    args = parser.parse_args()
    asyncio.run(verify(args.base_url.rstrip('/'), args.output))
