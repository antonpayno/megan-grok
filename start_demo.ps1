# Demo en un solo proceso: compila el frontend, resetea la BD y arranca uvicorn.
# Uso (desde la raiz del repo):  powershell -ExecutionPolicy Bypass -File .\start_demo.ps1
$ErrorActionPreference = "Continue"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root
$venvPath = Join-Path $root "backend\.venv"

if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    $env:Path += ";C:\Program Files\nodejs"
}

$python = Join-Path $venvPath "Scripts\python.exe"
if (-not (Test-Path $python)) {
    $python = "python"
}

Write-Host "==> Compilando frontend..."
Push-Location (Join-Path $root "frontend")
npm.cmd run build
$buildExit = $LASTEXITCODE
Pop-Location
if ($buildExit -ne 0) {
    Write-Host "ERROR: el build del frontend fallo (codigo $buildExit)." -ForegroundColor Red
    exit 1
}

Write-Host "==> Parando la demo anterior..."
Get-CimInstance Win32_Process |
    Where-Object {
        ($_.CommandLine -and $_.CommandLine -like "*$venvPath*") -or
        ($_.ExecutablePath -and $_.ExecutablePath -like "$venvPath*") -or
        ($_.CommandLine -and $_.CommandLine -match 'app\.main:app')
    } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

$listeners = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
foreach ($listener in $listeners) {
    Stop-Process -Id $listener.OwningProcess -Force -ErrorAction SilentlyContinue
}

for ($i = 0; $i -lt 10; $i++) {
    if (-not (Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue)) { break }
    Start-Sleep -Milliseconds 500
}
if (Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue) {
    Write-Host "ERROR: el puerto 8000 sigue ocupado. Cierralo y vuelve a intentarlo." -ForegroundColor Red
    exit 1
}

Write-Host "==> Sembrando datos demo (--reset)..."
Push-Location (Join-Path $root "backend")
& $python -m app.seed --reset
$seedExit = $LASTEXITCODE
Pop-Location
if ($seedExit -ne 0) {
    Write-Host "ERROR: el seed fallo (codigo $seedExit). No se arranca el servidor." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "==> Demo lista en http://localhost:8000  (Ctrl+C para parar)"
Push-Location (Join-Path $root "backend")
& $python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
$serverExit = $LASTEXITCODE
Pop-Location
exit $serverExit
