# Fix Chatbot Timeout Issue

## Problem
The chatbot is timing out because `deepseek-r1:8b` (5.2 GB) is too large and slow when running on CPU.

## Solution: Switch to Faster Model

You have `qwen3:4b` (2.5 GB) available which is much faster. Update your `.env` file:

### Step 1: Update .env file

Add or update this line in `backend/.env`:

```env
OLLAMA_MODEL=qwen3:4b
```

### Step 2: Restart FastAPI Server

After updating `.env`, restart your FastAPI server:

```powershell
# Stop the current server (Ctrl+C)
# Then restart:
cd backend
.\venv\Scripts\activate
python -m uvicorn app.main:app --reload --port 8000
```

### Step 3: Test the Chatbot

Try sending a message in the chatbot. It should respond much faster now.

## Alternative: Increase Timeout

If you want to keep using `deepseek-r1:8b`, you can increase the timeout in `backend/app/routers/chat.py`:

Change line 385 from:
```python
async with httpx.AsyncClient(timeout=120.0) as client:
```

To:
```python
async with httpx.AsyncClient(timeout=300.0) as client:  # 5 minutes
```

But using `qwen3:4b` is recommended for better performance.

## Model Comparison

| Model | Size | Speed | Quality |
|-------|------|-------|---------|
| qwen3:4b | 2.5 GB | Fast | Good |
| deepseek-r1:8b | 5.2 GB | Slow (CPU) | Better |

For CPU-only systems, `qwen3:4b` is the better choice.
