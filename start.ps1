# One-click launcher for the Ampara DSS (run from the project root)
Set-Location $PSScriptRoot

Write-Host "Starting PostgreSQL (Docker)..." -ForegroundColor Cyan
docker compose up -d

Write-Host "Starting FastAPI backend on http://localhost:8000 ..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$PSScriptRoot\backend'; .\venv\Scripts\python.exe -m uvicorn app.main:app --port 8000"

Write-Host "Starting React frontend on http://localhost:5173 ..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$PSScriptRoot\frontend'; npm run dev"

Start-Sleep -Seconds 6
Start-Process "http://localhost:5173"
Write-Host "System is up. Close the two PowerShell windows to stop." -ForegroundColor Green
