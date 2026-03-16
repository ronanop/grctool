# Local MongoDB Setup for Offline Operation

## Problem

Your application is currently trying to connect to **MongoDB Atlas** (cloud MongoDB), which requires internet connection. The error shows:
```
ac-mtape3p-shard-00-02.adikraw.mongodb.net:27017
```

## Solution: Use Local MongoDB

To work completely offline, you need to install and run MongoDB locally on your machine.

## Installation Steps

### Windows

1. **Download MongoDB Community Server**
   - Visit: https://www.mongodb.com/try/download/community
   - Select: Windows, MSI package
   - Download and run the installer

2. **Install MongoDB**
   - Run the installer
   - Choose "Complete" installation
   - Install as a Windows Service (recommended)
   - Install MongoDB Compass (optional GUI tool)

3. **Verify Installation**
   - MongoDB should start automatically as a Windows service
   - Check if it's running: Open Services (Win+R → `services.msc`) → Look for "MongoDB"

### Alternative: MongoDB via Docker (Easier)

If you have Docker installed:

```bash
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

This runs MongoDB in a container on port 27017.

## Configuration

1. **Create/Update `.env` file** in the `backend` directory:

```env
# Use LOCAL MongoDB (no internet needed)
MONGODB_URI=mongodb://localhost:27017/iso27001_compliance

# Ollama (already local)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=deepseek-r1:8b

# JWT
SECRET_KEY=your-secret-key-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# File Uploads
UPLOAD_DIR=./uploads
```

2. **Copy from example**:
   ```bash
   cd backend
   copy .env.example .env
   # Then edit .env and make sure MONGODB_URI points to localhost
   ```

## Verify Local MongoDB is Running

### Method 1: Check Windows Service
- Press `Win+R`, type `services.msc`
- Look for "MongoDB" service
- Status should be "Running"

### Method 2: Test Connection
```bash
# In PowerShell or Command Prompt
mongosh
# Or if mongosh is not installed:
mongo
```

If it connects, you'll see:
```
Current Mongosh Log ID: ...
Connecting to: mongodb://127.0.0.1:27017/?directConnection=true&serverSelectionTimeoutMS=2000
Using MongoDB: ...
```

### Method 3: Test from Python
```bash
cd backend
python -c "from motor.motor_asyncio import AsyncIOMotorClient; import asyncio; asyncio.run(AsyncIOMotorClient('mongodb://localhost:27017').admin.command('ping'))"
```

Should print: `{'ok': 1.0}`

## Restart Your Application

After setting up local MongoDB:

1. **Stop the FastAPI server** (if running)
2. **Update `.env` file** with local MongoDB URI
3. **Start MongoDB** (if not running as service)
4. **Restart FastAPI server**

## Complete Offline Architecture

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
              All connections are LOCAL (No internet needed!)
```

## Troubleshooting

### Error: "Failed to connect to MongoDB"
- **Check**: Is MongoDB running? (`services.msc` or `mongosh`)
- **Check**: Is the port 27017 correct?
- **Check**: Is `.env` file using `mongodb://localhost:27017` (not `mongodb+srv://`)

### Error: "Connection refused"
- MongoDB service might not be started
- Start it: `net start MongoDB` (Windows)

### Error: "MongoDB not found"
- MongoDB might not be installed
- Install MongoDB Community Server (see above)

### Still connecting to Atlas?
- Check your `.env` file in `backend/` directory
- Make sure `MONGODB_URI` starts with `mongodb://localhost` not `mongodb+srv://`
- Restart the FastAPI server after changing `.env`

## Quick Start (Docker)

If you have Docker, the fastest way:

```bash
# Start MongoDB
docker run -d -p 27017:27017 --name mongodb mongo:latest

# Verify it's running
docker ps

# Your .env should have:
# MONGODB_URI=mongodb://localhost:27017/iso27001_compliance
```

Now your entire application works **completely offline**! 🎉






