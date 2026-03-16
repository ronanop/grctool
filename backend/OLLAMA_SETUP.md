# Ollama Chatbot Setup

This document explains how to set up and configure the Ollama chatbot integration.

## Prerequisites

1. **Ollama must be installed and running** on your system
2. Ollama should be accessible at `http://localhost:11434` (default)
3. At least one model should be downloaded in Ollama

## Installation

The required library (`httpx`) has been added to `requirements.txt` and should be installed automatically. If not, install it manually:

```bash
pip install httpx==0.27.0
```

## Configuration

### Option 1: Environment Variables (Recommended)

Create or update the `.env` file in the `backend` directory:

```env
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=deepseek-r1:8b
```

### Option 2: Default Values

If no `.env` file is present, the system will use these defaults:
- `OLLAMA_BASE_URL`: `http://localhost:11434`
- `OLLAMA_MODEL`: `deepseek-r1:8b`

## Available Models

Common Ollama models you can use:
- `deepseek-r1:8b` - DeepSeek R1 8B model (default)
- `llama2` - General purpose model
- `mistral` - High performance model
- `codellama` - Code-focused model
- `llama3` - Latest Llama model (if available)
- `phi` - Microsoft's efficient model

To see available models in your Ollama installation:
```bash
ollama list
```

## Testing the Connection

1. Make sure Ollama is running:
   ```bash
   ollama serve
   ```

2. Test if Ollama is accessible:
   ```bash
   curl http://localhost:11434/api/tags
   ```

3. Start the FastAPI backend server

4. Open the chatbot in the frontend and send a test message

## API Endpoints

### POST `/api/v1/chat/chat`
Send a message to the chatbot.

**Request:**
```json
{
  "message": "What is ISO 27001?",
  "conversation_history": []
}
```

**Response:**
```json
{
  "response": "ISO 27001 is...",
  "conversation_history": [
    {"role": "user", "content": "What is ISO 27001?"},
    {"role": "assistant", "content": "ISO 27001 is..."}
  ]
}
```

### GET `/api/v1/chat/models`
Get list of available Ollama models.

## Troubleshooting

### Error: "Failed to connect to Ollama"
- Make sure Ollama is running: `ollama serve`
- Check if Ollama is accessible at the configured URL
- Verify the port (default: 11434)

### Error: "Model not found"
- The specified model might not be downloaded
- Download the model: `ollama pull llama2`
- Update `OLLAMA_MODEL` in `.env` to match an available model

### Slow Responses
- Larger models may take longer to respond
- Consider using a smaller/faster model like `phi` or `mistral`
- Check system resources (CPU/RAM)

## System Prompt

The chatbot is configured with a system prompt that makes it a compliance assistant for ISO 27001. This can be customized in `backend/app/routers/chat.py` by modifying the `SYSTEM_PROMPT` variable.

