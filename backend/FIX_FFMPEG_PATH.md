# Fix FFmpeg PATH Issue

## Problem
FFmpeg is installed but not found because it's not in your system PATH.

## Solution: Add FFmpeg to PATH

### Step 1: Find FFmpeg Installation

Check these common locations:

```powershell
# Check common locations
Test-Path "C:\ffmpeg\bin\ffmpeg.exe"
Test-Path "$env:ProgramFiles\ffmpeg\bin\ffmpeg.exe"
Test-Path "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Gyan.FFmpeg*\ffmpeg.exe"
```

### Step 2: Add to PATH (Choose One Method)

#### Method 1: Using PowerShell (Temporary - Current Session Only)

```powershell
# Replace with your actual FFmpeg path
$ffmpegPath = "C:\ffmpeg\bin"  # Change this to your FFmpeg location
$env:PATH += ";$ffmpegPath"
```

#### Method 2: Add to System PATH (Permanent - Recommended)

1. **Find your FFmpeg installation path** (e.g., `C:\ffmpeg\bin` or `C:\Program Files\ffmpeg\bin`)

2. **Add to System PATH:**
   - Press `Win + X` → **System** → **Advanced system settings**
   - Click **Environment Variables**
   - Under **System variables**, find **Path** → Click **Edit**
   - Click **New** → Add your FFmpeg bin path (e.g., `C:\ffmpeg\bin`)
   - Click **OK** on all dialogs

3. **Restart your terminal** (close and reopen PowerShell)

4. **Verify:**
   ```powershell
   ffmpeg -version
   ```

#### Method 3: Reinstall FFmpeg Properly (Easiest)

If you can't find FFmpeg, reinstall it using winget (it will add to PATH automatically):

```powershell
# Uninstall if needed
winget uninstall ffmpeg

# Reinstall
winget install ffmpeg

# Restart terminal and verify
ffmpeg -version
```

### Step 3: Restart Everything

After adding to PATH:
1. **Close all PowerShell/terminal windows**
2. **Open a new terminal**
3. **Restart your FastAPI server**
4. **Test voice chat**

## Quick Test

After fixing PATH, test in a NEW terminal:

```powershell
ffmpeg -version
```

If you see version info, you're good! ✅

## Alternative: Use Full Path in Code

If you can't add to PATH, we can modify the code to use the full path to FFmpeg. Let me know your FFmpeg installation path and I'll update the code.

## Common FFmpeg Locations

- `C:\ffmpeg\bin\ffmpeg.exe`
- `C:\Program Files\ffmpeg\bin\ffmpeg.exe`
- `C:\Program Files (x86)\ffmpeg\bin\ffmpeg.exe`
- `%LOCALAPPDATA%\Microsoft\WinGet\Packages\Gyan.FFmpeg_*\ffmpeg.exe`
