"""Real Chrome language/offline acceptance; no login credentials or mocked API."""
import argparse
import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright, expect


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
            await page.wait_for_function("navigator.serviceWorker.controller !== null", timeout=90000)
            await page.wait_for_function("""async () => {
              const urls = (await Promise.all((await caches.keys()).map(async key =>
                (await (await caches.open(key)).keys()).map(r => new URL(r.url).pathname)))).flat();
              return ['/locales/vi.json','/locales/en.json','/locales/legacy-ui.en.json'].every(u => urls.includes(u));
            }""", timeout=90000)
            cdp = await context.new_cdp_session(page)
            await cdp.send('Network.clearBrowserCache')
            await cdp.detach()
            await context.set_offline(True)
            await page.reload(wait_until='domcontentloaded')
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
