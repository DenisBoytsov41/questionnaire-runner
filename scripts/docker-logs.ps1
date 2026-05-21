param(
  [string]$Service = "",
  [switch]$NoFollow
)

$ErrorActionPreference = "Stop"

$serviceColors = @{
  "questionnaire-frontend" = "Cyan"
  "questionnaire-backend" = "Green"
  "questionnaire-db" = "Magenta"
  "frontend" = "Cyan"
  "backend" = "Green"
  "db" = "Magenta"
}

function Write-LogLine {
  param([string]$Line)

  if ($Line -match "^(?<service>[^|]+)\s+\|\s?(?<message>.*)$") {
    $service = $Matches.service.Trim()
    $message = $Matches.message
    $color = $serviceColors[$service]

    if (-not $color) {
      $color = "Gray"
    }

    Write-Host ("[{0,-24}] " -f $service) -ForegroundColor $color -NoNewline
    Write-Host $message
    return
  }

  Write-Host $Line
}

$arguments = @("compose", "logs", "--no-color", "--timestamps")

if (-not $NoFollow) {
  $arguments += "-f"
}

if ($Service.Trim()) {
  $arguments += $Service.Trim()
}

Write-Host "Цветные логи Docker. Остановить просмотр: Ctrl+C" -ForegroundColor Yellow
Write-Host "Команда: docker $($arguments -join ' ')" -ForegroundColor DarkGray

& docker @arguments | ForEach-Object {
  Write-LogLine $_
}
