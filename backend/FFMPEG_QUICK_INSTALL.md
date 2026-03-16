# Quick FFmpeg Installation (Required for Voice Chat)

## The Problem

Whisper needs **FFmpeg** to process audio files. The error you're seeing means FFmpeg is not installed.

## Quick Fix (Choose One)

### Option 1: Using winget (Windows 10/11) - FASTEST ⚡

Open PowerShell and run:
```powershell
winget install ffmpeg
```

Then restart your terminal and server.

### Option 2: Using Chocolatey

1. Install Chocolatey (if needed):
   ```powershell
   Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
   ```

2. Install FFmpeg:
   ```powershell
   choco install ffmpeg
   ```

### Option 3: Manual Download

1. Download: https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip
2. Extract to `C:\ffmpeg`
3. Add `C:\ffmpeg\bin` to System PATH
4. Restart terminal

## Verify Installation

```powershell
ffmpeg -version
```

If you see version info, you're good! ✅

## After Installation

1. **Restart your terminal**
2. **Restart your FastAPI server**
3. **Try voice chat again** - it should work!

## Why FFmpeg?

Whisper uses FFmpeg to convert audio formats (WebM → WAV) before processing. It's a standard tool for audio/video processing.

---

**Need help?** See `backend/FFMPEG_INSTALLATION.md` for detailed instructions.
