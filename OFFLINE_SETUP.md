# Offline Chatbot Setup - No Internet Required

## Overview

This chatbot is designed to work **completely offline** - no internet connection is required once everything is set up. All communication happens locally on your machine.

## Architecture (All Local)

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐      ┌─────────────┐
│   Browser   │─────▶│   FastAPI    │─────▶│   MongoDB   │      │   Ollama    │
│  Frontend   │      │   Backend    │      │   (Local)   │      │   (Local)   │
│ localhost:  │      │ localhost:   │      │ localhost:  │      │ localhost:  │
│   5173      │      │    8000      │      │   27017     │      │   11434     │
└─────────────┘      └──────────────┘      └─────────────┘      └─────────────┘
     ▲                      ▲                      ▲                      ▲
     │                      │                      │                      │
     └──────────────────────┴──────────────────────┴──────────────────────┘
              All connections are LOCAL
              (No internet needed!)
```

**Important**: You need **local MongoDB** installed. If you're seeing MongoDB Atlas connection errors, see `LOCAL_MONGODB_SETUP.md` for instructions.

## Why No Internet is Needed

1. **Frontend → Backend**: Uses `http://localhost:8000` (local connection)
2. **Backend → MongoDB**: Uses `mongodb://localhost:27017` (local database)
3. **Backend → Ollama**: Uses `http://localhost:11434` (local connection)
4. **Ollama Model**: Runs entirely on your machine (offline AI)

**⚠️ Important**: Make sure your `.env` file uses **local MongoDB**, not MongoDB Atlas (cloud). See `LOCAL_MONGODB_SETUP.md` for setup instructions.

## Troubleshooting "Internet Required" Errors

If you see errors that suggest internet is needed, it's actually a **local connection issue**:

### Common Issues:

1. **MongoDB Atlas Connection Error** ⚠️ **MOST COMMON**
   - Error: `ac-mtape3p-shard-00-02.adikraw.mongodb.net` or DNS timeout
   - **Cause**: `.env` file is using MongoDB Atlas (cloud) instead of local MongoDB
   - **Solution**: 
     - Install local MongoDB (see `LOCAL_MONGODB_SETUP.md`)
     - Update `.env`: `MONGODB_URI=mongodb://localhost:27017/iso27001_compliance`
     - Restart FastAPI server

2. **Backend Server Not Running**
   - Error: "Network Error" or "Failed to connect"
   - Solution: Start the FastAPI backend server
   - Check: `http://localhost:8000` should be accessible

3. **Local MongoDB Not Running**
   - Error: "Failed to connect to MongoDB" or "Connection refused"
   - Solution: Start MongoDB service: `net start MongoDB` (Windows)
   - Check: `mongosh` or `mongo` command should connect

4. **Ollama Not Running**
   - Error: "Failed to connect to Ollama"
   - Solution: Start Ollama: `ollama serve`
   - Check: `http://localhost:11434` should be accessible

5. **Model Not Downloaded**
   - Error: "Model not found"
   - Solution: Download the model: `ollama pull deepseek-r1:8b`
   - Check: `ollama list` to see available models

6. **Browser Blocking Localhost**
   - Error: CORS or connection refused
   - Solution: Check browser console for specific errors
   - Note: CORS is configured to allow all origins

## Verification Steps

### 1. Check Backend is Running
```bash
# In browser or terminal
curl http://localhost:8000
# Should return: {"message": "ISO 27001 Compliance Portal API"}
```

### 2. Check Ollama is Running
```bash
# In browser or terminal
curl http://localhost:11434/api/tags
# Should return JSON with available models
```

### 3. Check Model is Available
```bash
ollama list
# Should show "deepseek-r1:8b" in the list
```

### 4. Test Chatbot
- Open the frontend application
- Click the chatbot icon
- Send a test message
- Should get a response from Ollama (offline)

## Configuration

All services use localhost (no external URLs):

- **Frontend API**: `http://localhost:8000` (configured in `frontend/src/services/api.js`)
- **Ollama URL**: `http://localhost:11434` (configured in `backend/app/routers/chat.py`)
- **Ollama Model**: `deepseek-r1:8b` (configured in `backend/app/routers/chat.py`)

## Important Notes

✅ **No external API calls** - Everything runs locally  
✅ **No internet required** - All connections are to localhost  
✅ **Completely offline** - Works without network connection  
✅ **Privacy** - All data stays on your machine  

If you're seeing errors, they're related to local services not running, not internet connectivity.

