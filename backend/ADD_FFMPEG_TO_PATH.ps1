# PowerShell script to add FFmpeg to PATH permanently
# Run this script as Administrator or it will add to User PATH

$ffmpegBinPath = "C:\Users\HP\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.0.1-full_build\bin"

# Check if path already exists
$currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($currentPath -notlike "*$ffmpegBinPath*") {
    # Add to User PATH
    [Environment]::SetEnvironmentVariable("Path", $currentPath + ";$ffmpegBinPath", "User")
    Write-Host "✅ FFmpeg added to User PATH" -ForegroundColor Green
    Write-Host "📍 Path: $ffmpegBinPath" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "⚠️  IMPORTANT: Close and reopen your terminal for changes to take effect!" -ForegroundColor Yellow
} else {
    Write-Host "✅ FFmpeg is already in PATH" -ForegroundColor Green
}

# Test FFmpeg
Write-Host ""
Write-Host "Testing FFmpeg..." -ForegroundColor Cyan
$env:PATH += ";$ffmpegBinPath"
try {
    $version = & ffmpeg -version 2>&1 | Select-Object -First 1
    Write-Host "✅ FFmpeg is working: $version" -ForegroundColor Green
} catch {
    Write-Host "❌ FFmpeg test failed. Please restart your terminal." -ForegroundColor Red
}

Write-Host ""
Write-Host "After closing and reopening your terminal, run: ffmpeg -version" -ForegroundColor Yellow
