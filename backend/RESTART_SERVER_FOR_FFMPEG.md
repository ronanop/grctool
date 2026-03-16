# Restart Server to Pick Up FFmpeg

## Problem
Even though FFmpeg is installed and added to PATH, the server still shows the warning because **Python processes inherit PATH from when they start**.

## Solution: Restart Server in NEW Terminal

### Step 1: Stop Current Server
Press `Ctrl+C` in the terminal where your server is running.

### Step 2: Close Current Terminal
Close the PowerShell/terminal window completely.

### Step 3: Open NEW Terminal
Open a **fresh** PowerShell terminal (this will pick up the updated PATH).

### Step 4: Verify FFmpeg
```powershell
ffmpeg -version
```
You should see version info. If not, the PATH wasn't added correctly.

### Step 5: Start Server Again
```powershell
cd C:\Users\HP\Desktop\decgrc\backend
.\venv\Scripts\activate
python -m uvicorn app.main:app --reload --port 8000
```

### Step 6: Check Server Logs
You should now see:
```
[Voice] ✅ FFmpeg is available
```

Instead of:
```
[Voice] WARNING: FFmpeg not found in PATH
```

## Why This Happens

- PATH changes only affect **new processes**
- Your server started **before** PATH was updated
- You need to **restart in a new terminal** to pick up the change

## Alternative: Code Auto-Detection

I've updated the code to automatically find FFmpeg in common locations even if it's not in PATH. This helps, but restarting is still recommended for best performance.

## Quick Test

After restarting, the warning should be gone and voice chat should work! 🎉
