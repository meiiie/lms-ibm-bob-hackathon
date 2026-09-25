$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'Use-DevEnv.ps1')
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskFixture = Join-Path $taskRoot '.tools\browser-smoke'
New-Item -ItemType Directory -Path $taskFixture -Force | Out-Null
$taskSession = 'bob-setup-smoke-' + $PID
$taskCheck = Join-Path $taskFixture 'check.js'
$taskScreenshot = Join-Path $taskFixture 'passed.png'
$taskScreenshotJson = ConvertTo-Json -InputObject $taskScreenshot -Compress
$taskCode = @'
async (page) => {
  await page.setContent(`<!doctype html><html lang="en"><meta charset="utf-8">
    <title>Bob tooling smoke test</title><body>
    <h1>Local browser tooling check</h1>
    <label for="name">Team name</label><input id="name">
    <button type="button" onclick="document.getElementById('result').textContent = 'Ready, ' + document.getElementById('name').value">Check</button>
    <p id="result" role="status">Waiting</p></body></html>`);
  await page.getByLabel('Team name').fill('Neko Core');
  await page.getByRole('button', { name: 'Check', exact: true }).click();
  const actual = await page.getByRole('status').textContent();
  if (actual !== 'Ready, Neko Core') throw new Error('Unexpected result: ' + actual);
  await page.screenshot({ path: __SCREENSHOT__, fullPage: true });
  return 'BOB_BROWSER_SMOKE_PASS';
}
'@
$taskCode.Replace('__SCREENSHOT__', $taskScreenshotJson) | Set-Content -LiteralPath $taskCheck -Encoding UTF8
try {
    $taskOpenOutput = & playwright-cli.cmd "-s=$taskSession" open about:blank --browser=chrome --idle-timeout=300000 2>&1
    $taskOpenExit = $LASTEXITCODE
    $taskOpenOutput | Write-Output
    if ($taskOpenExit -ne 0 -or ($taskOpenOutput -join "`n") -match '(?m)^### Error') {
        throw 'Cannot open Chrome for the browser smoke test.'
    }
    $taskCheckOutput = & playwright-cli.cmd "-s=$taskSession" run-code --filename $taskCheck 2>&1
    $taskCheckExit = $LASTEXITCODE
    $taskCheckOutput | Write-Output
    $taskResult = $taskCheckOutput -join "`n"
    if ($taskCheckExit -ne 0 -or $taskResult -match '(?m)^### Error' -or $taskResult -notmatch '"BOB_BROWSER_SMOKE_PASS"') {
        throw 'Browser interaction/assertion failed. Inspect the output above.'
    }
    Write-Output "Browser form interaction passed. Screenshot: $taskScreenshot"
    Write-Output 'This checks tooling with a synthetic fixture; it is not a product acceptance test.'
}
finally {
    & playwright-cli.cmd "-s=$taskSession" close
}
