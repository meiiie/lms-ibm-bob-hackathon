$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'Use-DevEnv.ps1')
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskBob = Join-Path $env:LOCALAPPDATA 'Programs\IBM Bob\bin\bobide.cmd'
if (-not (Test-Path -LiteralPath $taskBob)) {
    throw 'Install IBM Bob from https://bob.ibm.com/docs/ide/getting-started/install'
}
& $taskBob --reuse-window $taskRoot
