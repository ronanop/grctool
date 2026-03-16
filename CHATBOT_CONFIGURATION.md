# Chatbot Configuration Feature

## Overview

A chatbot configuration system has been added that allows admins to configure chatbot settings through the UI. The "Chatbot" agent appears in the Agents section, and clicking on it opens a configuration page.

## What Was Created

### 1. Backend API Endpoints (`/api/v1/chatbot-config`)
- `GET /config` - Get current chatbot configuration
- `PUT /config` - Update chatbot configuration (saves to .env file)
- `GET /models` - Get list of available Ollama models

### 2. Frontend Components
- **ChatbotConfig.jsx** - Configuration page with all settings
- **chatConfigService.js** - Service for API calls
- **Modified Agents.jsx** - Shows "Configure" button for chatbot agent

### 3. Database
- **Chatbot Agent** - Created in the agents collection

## How to Use

### Step 1: Access Chatbot Configuration

1. Login as admin
2. Go to **Admin → Agents**
3. Find the **"Chatbot"** agent card
4. Click the **"Configure"** button (instead of "Edit")

### Step 2: Configure Settings

The configuration page includes:

#### Ollama Configuration
- **Ollama Base URL**: Where Ollama is running (default: http://localhost:11434)
- **Model**: Select from available Ollama models

#### Performance Settings
- **Request Timeout**: Maximum wait time (30-600 seconds)
- **RAG Search Timeout**: Timeout for document search (1-30 seconds)

#### AI Model Parameters
- **Max Response Tokens**: Response length limit (50-2000)
- **Temperature**: Creativity level (0-2, lower = more deterministic)
- **Top P**: Nucleus sampling parameter (0-1)

#### Feature Toggles
- **Enable RAG**: Toggle document search functionality
- **Enable Application Context**: Toggle application statistics in context

### Step 3: Save and Restart

1. Click **"Save Configuration"**
2. **IMPORTANT**: Restart the FastAPI server for changes to take effect
3. The settings are saved to `backend/.env` file

## Configuration Options

| Setting | Default | Range | Description |
|---------|---------|-------|-------------|
| `OLLAMA_BASE_URL` | http://localhost:11434 | URL | Ollama server URL |
| `OLLAMA_MODEL` | qwen3:4b | Model name | LLM model to use |
| `CHAT_TIMEOUT_SECONDS` | 180 | 30-600 | Request timeout |
| `ENABLE_RAG` | true | true/false | Enable document search |
| `ENABLE_APP_CONTEXT` | true | true/false | Enable app stats in context |
| `RAG_TIMEOUT_SECONDS` | 5.0 | 1-30 | RAG search timeout |
| `MAX_RESPONSE_TOKENS` | 300 | 50-2000 | Max response length |
| `CHAT_TEMPERATURE` | 0.7 | 0-2 | Model temperature |
| `CHAT_TOP_P` | 0.9 | 0-1 | Top-p sampling |

## Files Created/Modified

### Backend
- `backend/app/routers/chat_config.py` - New configuration router
- `backend/app/main.py` - Added chat_config router
- `backend/app/routers/chat.py` - Updated to use configurable settings
- `backend/create_chatbot_agent.py` - Script to create chatbot agent

### Frontend
- `frontend/src/pages/admin/ChatbotConfig.jsx` - Configuration page
- `frontend/src/services/chatConfigService.js` - API service
- `frontend/src/pages/admin/Agents.jsx` - Modified to show Configure button
- `frontend/src/App.jsx` - Added route for chatbot config

## Testing

1. **Test Connection**: Click "Test Connection" button to verify Ollama is accessible
2. **View Models**: Available models are loaded automatically
3. **Save Settings**: Changes are saved to `.env` file
4. **Restart Server**: Required for changes to take effect

## Notes

- Configuration is stored in `backend/.env` file
- Server restart is required after configuration changes
- The chatbot agent cannot be deleted (protected)
- All settings have validation and default values
- Changes take effect immediately after server restart

## Troubleshooting

### Configuration not saving
- Check file permissions on `backend/.env`
- Verify admin role permissions

### Settings not taking effect
- Ensure FastAPI server was restarted
- Check `.env` file for correct values
- Verify environment variables are being loaded

### Models not loading
- Check Ollama is running
- Verify Ollama Base URL is correct
- Check network connectivity
