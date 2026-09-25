$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'Use-DevEnv.ps1')
$taskRoot = Split-Path -Parent $PSScriptRoot
foreach ($taskCommand in @('git', 'gh', 'java', 'mvn.cmd', 'docker')) {
    if (-not (Get-Command $taskCommand -ErrorAction SilentlyContinue)) { throw "Missing command: $taskCommand" }
}
git --version
gh --version | Select-Object -First 1
$taskJavaVersion = & java -version 2>&1
if ($LASTEXITCODE -ne 0 -or ($taskJavaVersion -join "`n") -notmatch 'version "21\.') { throw 'Java 21 must be on PATH.' }
$taskJavaVersion | Write-Output
mvn.cmd -version
if ($LASTEXITCODE -ne 0) { throw 'Maven check failed.' }
docker compose version
if ($LASTEXITCODE -ne 0) { throw 'Docker Compose v2 is required.' }
$taskDockerVersion = & docker version --format '{{.Server.Version}}' 2>&1
if ($LASTEXITCODE -ne 0) { Write-Warning 'Docker daemon is not running; start Docker Desktop before running the LMS stack.' }
else { Write-Output "Docker daemon: $taskDockerVersion" }
$taskBob = Join-Path $env:LOCALAPPDATA 'Programs\IBM Bob\bin\bobide.cmd'
if (-not (Test-Path -LiteralPath $taskBob)) { throw 'IBM Bob CLI was not found.' }
& $taskBob --version
if ($LASTEXITCODE -ne 0) { throw 'IBM Bob CLI check failed.' }
node -e "if (process.versions.node !== '24.21.0') process.exit(1); console.log('Pinned Node runtime verified');"
if ($LASTEXITCODE -ne 0) { throw 'Unexpected Node runtime.' }
playwright-cli.cmd --version
if ($LASTEXITCODE -ne 0) { throw 'Playwright CLI check failed.' }
$taskInstalled = @(& $taskBob --list-extensions --show-versions)
if ($LASTEXITCODE -ne 0) { throw 'Cannot list Bob extensions.' }
$taskLock = Get-Content -LiteralPath (Join-Path $taskRoot 'tooling\extensions.lock.json') -Raw | ConvertFrom-Json
foreach ($taskExtension in $taskLock) {
    $taskIdentity = $taskExtension.id + '@' + $taskExtension.version
    if ($taskInstalled -notcontains $taskIdentity) { throw "Missing pinned extension: $taskIdentity" }
}
Write-Output "Pinned Bob extensions verified: $($taskLock.Count)"
$taskSkills = @('ponytail','ponytail-review','hackathon-slice','systematic-debugging','agent-evaluation','frontend-craft','playwright-cli','hackathon-submit')
foreach ($taskSkill in $taskSkills) {
    if (-not (Test-Path -LiteralPath (Join-Path $taskRoot ".bob\skills\$taskSkill\SKILL.md"))) { throw "Missing skill: $taskSkill" }
}
node (Join-Path $PSScriptRoot 'harness.cjs') check
if ($LASTEXITCODE -ne 0) { throw 'Harness check failed.' }
$taskScreenshots = @(Get-ChildItem -LiteralPath (Join-Path $taskRoot 'bob_sessions') -Filter '*.png' -File -Recurse)
Write-Output "Skills present: $($taskSkills.Count); real Bob summary PNGs: $($taskScreenshots.Count)"
Write-Output 'Setup checks complete. Login, instance/quota, lifecycle activation, product smoke and submission readiness remain separate checks.'
