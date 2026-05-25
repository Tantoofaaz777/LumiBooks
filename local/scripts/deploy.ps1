param([string]$Dest = "G:\mousepad_git\Lumiverse\data\extensions\lumi_books\repo")
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Push-Location $root
try {
    Write-Host "[lumi_books] building..."
    bun run build
    if ($LASTEXITCODE -ne 0) { throw "build failed" }

    $destDist = Join-Path $Dest "dist"
    if (-not (Test-Path $destDist)) {
        New-Item -ItemType Directory -Path $destDist -Force | Out-Null
    }

    Copy-Item -Path "dist\backend.js"  -Destination (Join-Path $destDist "backend.js")  -Force
    Copy-Item -Path "dist\frontend.js" -Destination (Join-Path $destDist "frontend.js") -Force
    Copy-Item -Path "spindle.json"     -Destination (Join-Path $Dest "spindle.json")    -Force

    Write-Host "[lumi_books] deployed to $Dest"
}
finally { Pop-Location }
