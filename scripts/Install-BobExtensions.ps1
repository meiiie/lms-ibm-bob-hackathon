$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskBob = Join-Path $env:LOCALAPPDATA 'Programs\IBM Bob\bin\bobide.cmd'
$taskCache = Join-Path $taskRoot '.tools\vsix'
New-Item -ItemType Directory -Path $taskCache -Force | Out-Null
$taskInstalled = @(& $taskBob --list-extensions --show-versions)
if ($LASTEXITCODE -ne 0) { throw 'Cannot list IBM Bob extensions.' }
$taskLock = Get-Content -LiteralPath (Join-Path $taskRoot 'tooling\extensions.lock.json') -Raw | ConvertFrom-Json
foreach ($extension in $taskLock) {
    $identity = $extension.id + '@' + $extension.version
    if ($taskInstalled -contains $identity) {
        Write-Output "Already installed: $identity"
        continue
    }
    $archive = Join-Path $taskCache ($extension.id + '-' + $extension.version + '.vsix')
    if (-not (Test-Path -LiteralPath $archive)) {
        Invoke-WebRequest -Uri $extension.url -OutFile $archive
    }
    $actual = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash
    if ($actual -ne $extension.sha256) { throw "Checksum mismatch: $identity" }
    & $taskBob --install-extension $archive --do-not-include-pack-dependencies
    if ($LASTEXITCODE -ne 0) { throw "Installation failed: $identity" }
}
& $taskBob --list-extensions --show-versions
