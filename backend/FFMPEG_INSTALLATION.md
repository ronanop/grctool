# FFmpeg Installation for Whisper (Windows)

## Problem

Whisper requires **FFmpeg** to process audio files (WebM, MP3, etc.). The error you're seeing:
```
FileNotFoundError: [WinError 2] The system cannot find the file specified
```
means FFmpeg is not installed or not in your system PATH.

## Solution: Install FFmpeg

### Option 1: Using Chocolatey (Recommended - Easiest)

1. **Install Chocolatey** (if not already installed):
   - Open PowerShell as Administrator
   - Run: `Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))`

2. **Install FFmpeg**:
   ```powershell
   choco install ffmpeg
   ```

3. **Restart your terminal** and verify:
   ```powershell
   ffmpeg -version
   ```

### Option 2: Manual Installation

1. **Download FFmpeg**:
   - Go to: https://www.gyan.dev/ffmpeg/builds/
   - Download: `ffmpeg-release-essentials.zip` (or latest release)

2. **Extract** to a folder (e.g., `C:\ffmpeg`)

3. **Add to PATH**:
   - Press `Win + X` → System → Advanced system settings
   - Click "Environment Variables"
   - Under "System variables", find "Path" → Edit
   - Click "New" → Add: `C:\ffmpeg\bin`
   - Click OK on all dialogs

4. **Restart your terminal** and verify:
   ```powershell
   ffmpeg -version
   ```

### Option 3: Using winget (Windows 10/11)

```powershell
winget install ffmpeg
```

## Verify Installation

After installation, verify FFmpeg is available:

```powershell
ffmpeg -version
```

You should see FFmpeg version information.

## After Installation

1. **Restart your FastAPI server**:
   ```powershell
   cd C:\Users\HP\Desktop\decgrc\backend
   .\venv\Scripts\activate
   python -m uvicorn app.main:app --reload --port 8000
   ```

2. **Test voice chat again** - it should work now!

## Alternative: Use WAV Format Directly

If you can't install FFmpeg, you can modify the frontend to record in WAV format instead of WebM. However, this is less efficient and FFmpeg is recommended.

## Troubleshooting

### "ffmpeg is not recognized"
- Make sure you restarted your terminal after adding to PATH
- Check that FFmpeg is in your PATH: `echo $env:PATH`
- Try restarting your computer

### Still getting errors
- Make sure FFmpeg is in the system PATH, not just user PATH
- Verify installation: `ffmpeg -version` should work in a new terminal

## Quick Test

After installing FFmpeg, test it:

```powershell
ffmpeg -i input.webm output.wav
```

If this works, Whisper will work too!
