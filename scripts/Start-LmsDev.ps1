$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
Push-Location $taskRoot
try {
    docker info --format '{{.ServerVersion}}'
    if ($LASTEXITCODE -ne 0) { throw 'Start Docker Desktop (Linux containers), then retry.' }
    docker compose --project-name lms-bob-hackathon --env-file .env.dev.example -f docker-compose.yml -f docker-compose.dev.yml up -d --build --wait
    if ($LASTEXITCODE -ne 0) { throw 'LMS startup failed. Inspect this Compose project logs; do not claim a passing app smoke.' }
    Write-Output 'LMS local frontend: http://localhost:4200 ; backend health: http://localhost:8088/actuator/health'
    Write-Output 'This uses development fixtures. Verify relevant browser flows before recording a demo.'
} finally { Pop-Location }
