$taskRoot = Split-Path -Parent $PSScriptRoot
$taskNode = Join-Path $taskRoot '.tools\node-v24.21.0-win-x64'
if (-not (Test-Path -LiteralPath (Join-Path $taskNode 'node.exe'))) {
    throw 'Project Node.js is missing. Run scripts\Install-Node.ps1 first.'
}
if (($env:PATH -split ';') -notcontains $taskNode) {
    $env:PATH = $taskNode + ';' + $env:PATH
}
$taskBrowserBin = Join-Path $taskRoot 'tooling\node_modules\.bin'
if ((Test-Path -LiteralPath $taskBrowserBin) -and (($env:PATH -split ';') -notcontains $taskBrowserBin)) {
    $env:PATH = $taskBrowserBin + ';' + $env:PATH
}
$env:PLAYWRIGHT_CLI_SESSION = 'lms-bob-hackathon'
Write-Output "Project Node: $(node --version)"
Write-Output "Project npm: $(npm.cmd --version)"
