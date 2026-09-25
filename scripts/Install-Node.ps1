$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskTools = Join-Path $taskRoot '.tools'
$taskNode = Join-Path $taskTools 'node-v24.21.0-win-x64'
if (Test-Path -LiteralPath (Join-Path $taskNode 'node.exe')) {
    & (Join-Path $taskNode 'node.exe') --version
    return
}
$taskArchive = Join-Path $env:TEMP 'node-v24.21.0-win-x64-ibm-hackathon.zip'
$taskExpected = '158f7685b44de51f6c0df1d153526cbcd3e1bc739a8dfc607721cef75de9e541'
Invoke-WebRequest -Uri 'https://nodejs.org/dist/v24.21.0/node-v24.21.0-win-x64.zip' -OutFile $taskArchive
if ((Get-FileHash -LiteralPath $taskArchive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskExpected) {
    throw 'Node archive checksum mismatch. Installation stopped.'
}
New-Item -ItemType Directory -Path $taskTools -Force | Out-Null
Expand-Archive -LiteralPath $taskArchive -DestinationPath $taskTools
& (Join-Path $taskNode 'node.exe') --version
