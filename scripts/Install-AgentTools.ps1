$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'Use-DevEnv.ps1')
$taskRoot = Split-Path -Parent $PSScriptRoot
npm.cmd ci --prefix (Join-Path $taskRoot 'tooling') --ignore-scripts --no-fund --no-audit
if ($LASTEXITCODE -ne 0) { throw 'Browser tooling installation failed.' }
& (Join-Path $PSScriptRoot 'Use-DevEnv.ps1')
playwright-cli.cmd --version
if ($LASTEXITCODE -ne 0) { throw 'Playwright CLI is not working.' }
