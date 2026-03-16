# Voice Chat Setup Guide

This guide will help you set up voice-to-voice chatbot functionality using Whisper (STT) and Coqui TTS.

## Prerequisites

1. **Python 3.8+** (you have Python 3.12 ✅)
2. **CUDA** (optional, for GPU acceleration - you have CUDA 12.1 ✅)
3. **Microphone** access in browser

## Step 1: Install Voice Dependencies

Install the required packages:

```powershell
cd backend
pip install openai-whisper TTS soundfile
```

**Note:** 
- Whisper will download model files on first use (~150MB for "base" model)
- Coqui TTS will download voice models on first use (~500MB)

## Step 2: Verify Installation

Test the voice service:

```powershell
python -c "import whisper; import TTS; print('Voice libraries installed successfully')"
```

## Step 3: Model Sizes

### Whisper Models (Speech-to-Text)
- `tiny` - Fastest, least accurate (~39MB)
- `base` - **Recommended** - Good balance (~74MB) ✅ Default
- `small` - Better accuracy (~244MB)
- `medium` - High accuracy (~769MB)
- `large` - Best accuracy (~1550MB)

You can change the model size in `.env`:
```env
WHISPER_MODEL_SIZE=base
```

### Coqui TTS Models (Text-to-Speech)
- `tts_models/en/ljspeech/tacotron2-DDC` - **Default** - Good quality English voice
- `tts_models/en/vctk/vits` - Multiple speaker voices
- `tts_models/multilingual/multi-dataset/xtts_v2` - Multilingual, best quality (larger)

## Step 4: GPU Acceleration (Optional)

Both Whisper and Coqui TTS can use GPU if available:

- **Whisper**: Automatically uses GPU if CUDA is available
- **Coqui TTS**: Set `use_cuda=True` in voice_service.py (already configured)

## Step 5: Test Voice Chat

1. **Start your FastAPI server**
2. **Open the chatbot** in your browser
3. **Click the microphone icon** (🎤)
4. **Speak your question**
5. **Click stop** (or the square icon)
6. **Wait for transcription and response**
7. **Audio response will play automatically**

## API Endpoints

### POST `/api/v1/chat/voice/transcribe`
Transcribe audio to text
- **Input**: Audio file (WAV, MP3, WebM, etc.)
- **Output**: Transcribed text

### POST `/api/v1/chat/voice/synthesize`
Convert text to speech
- **Input**: Text string
- **Output**: WAV audio file

### POST `/api/v1/chat/voice/chat`
Complete voice chat (transcribe → chat → synthesize)
- **Input**: Audio file + optional conversation history
- **Output**: Transcribed text, response text, and audio

### GET `/api/v1/chat/voice/info`
Get voice model information
- **Output**: Status of Whisper and TTS models

## Performance Tips

1. **First Run**: Models download automatically (one-time, ~650MB total)
2. **GPU Acceleration**: Both models will use GPU if available
3. **Model Size**: Use `base` for Whisper (good balance)
4. **Audio Format**: WebM/Opus from browser works well with Whisper

## Troubleshooting

### Issue: "Whisper not available"
**Solution:**
```powershell
pip install openai-whisper
```

### Issue: "Coqui TTS not available"
**Solution:**
```powershell
pip install TTS soundfile
```

### Issue: "Microphone access denied"
**Solution:**
- Check browser permissions
- Use HTTPS in production (required for microphone)
- Allow microphone access in browser settings

### Issue: "Model download failed"
**Solution:**
- Check internet connection (first-time download only)
- Models are cached after first download
- Try smaller model size

### Issue: Slow transcription
**Solution:**
- Use smaller Whisper model (`tiny` or `base`)
- Enable GPU acceleration
- Reduce audio length

## Expected Performance

### With GPU (RTX 4060):
- **Transcription**: ~1-2 seconds for 10 seconds of audio
- **Synthesis**: ~0.5-1 second per sentence
- **Total voice chat**: ~3-5 seconds end-to-end

### Without GPU:
- **Transcription**: ~3-5 seconds for 10 seconds of audio
- **Synthesis**: ~1-2 seconds per sentence
- **Total voice chat**: ~5-10 seconds end-to-end

## Browser Compatibility

- **Chrome/Edge**: ✅ Full support
- **Firefox**: ✅ Full support
- **Safari**: ⚠️ May need additional permissions
- **Mobile**: ✅ Works on mobile browsers

## Security Notes

- Voice data is processed server-side
- Audio files are temporarily stored and deleted
- No voice data is permanently stored
- Microphone access requires user permission

## Next Steps

1. ✅ Install dependencies
2. ✅ Restart FastAPI server
3. ✅ Test voice chat in browser
4. ✅ Enjoy voice-to-voice conversations!
