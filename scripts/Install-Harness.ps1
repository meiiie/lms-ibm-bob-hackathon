$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
& (Join-Path $PSScriptRoot 'Use-DevEnv.ps1')
$taskHookPath = git -C $taskRoot config --get core.hooksPath
if ($taskHookPath) { throw "Existing core.hooksPath '$taskHookPath': integrate the pre-commit check deliberately; leave existing hooks intact." }
$taskGitDir = git -C $taskRoot rev-parse --absolute-git-dir
if ($LASTEXITCODE -ne 0) { throw 'Not a Git repository.' }
if (Test-Path -LiteralPath (Join-Path $taskGitDir 'commondir')) { throw 'Install the harness in a standalone clone, not a shared worktree.' }
node (Join-Path $PSScriptRoot 'harness.cjs') check
if ($LASTEXITCODE -ne 0) { throw 'Fix harness configuration first.' }
$taskSource = Join-Path $taskRoot '.githooks\pre-commit'
$taskTarget = Join-Path $taskGitDir 'hooks\pre-commit'
if (Test-Path -LiteralPath $taskTarget) {
    if ((Get-FileHash -LiteralPath $taskSource).Hash -ne (Get-FileHash -LiteralPath $taskTarget).Hash) {
        throw 'An existing pre-commit hook must be preserved and integrated deliberately.'
    }
} else {
    Copy-Item -LiteralPath $taskSource -Destination $taskTarget
}
Write-Output 'Pre-commit installed; existing Git LFS and other hooks preserved.'
Write-Output 'Bob lifecycle activation still needs a real trusted Bob task.'
