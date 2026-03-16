# PowerShell script to start the FastAPI server
Set-Location $PSScriptRoot
& ".\venv\Scripts\python.exe" -m uvicorn app.main:app --reload --port 8000

