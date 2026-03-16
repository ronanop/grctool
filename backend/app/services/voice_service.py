"""
Voice Service for Speech-to-Text and Text-to-Speech
"""
import os
import io
import tempfile
import subprocess
from typing import Optional, Dict, Any
import numpy as np

# Try to import pydub for audio conversion
try:
    from pydub import AudioSegment
    PYDUB_AVAILABLE = True
except ImportError:
    PYDUB_AVAILABLE = False
    print("[Voice] pydub not available (optional, for audio conversion)")

# Check for FFmpeg
def check_ffmpeg():
    """Check if FFmpeg is available in PATH"""
    try:
        result = subprocess.run(
            ['ffmpeg', '-version'],
            capture_output=True,
            text=True,
            timeout=5
        )
        return result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired):
        # Try common FFmpeg locations on Windows
        common_paths = [
            r"C:\ffmpeg\bin\ffmpeg.exe",
            r"C:\Program Files\ffmpeg\bin\ffmpeg.exe",
            os.path.expanduser(r"~\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.0.1-full_build\bin\ffmpeg.exe"),
        ]
        for path in common_paths:
            if os.path.exists(path):
                # Add to PATH for this session
                bin_dir = os.path.dirname(path)
                os.environ['PATH'] = bin_dir + os.pathsep + os.environ.get('PATH', '')
                try:
                    result = subprocess.run(
                        [path, '-version'],
                        capture_output=True,
                        text=True,
                        timeout=5
                    )
                    if result.returncode == 0:
                        print(f"[Voice] Found FFmpeg at: {path}")
                        return True
                except:
                    pass
        return False

FFMPEG_AVAILABLE = check_ffmpeg()
if not FFMPEG_AVAILABLE:
    print("[Voice] WARNING: FFmpeg not found in PATH. Audio conversion may fail.")
    print("[Voice] Install FFmpeg: winget install ffmpeg")
    print("[Voice] Or add FFmpeg to your system PATH")
    print("[Voice] After adding to PATH, restart your server in a NEW terminal")
else:
    print("[Voice] ✅ FFmpeg is available")

# Try to import Whisper for STT
try:
    import whisper
    WHISPER_AVAILABLE = True
except ImportError:
    WHISPER_AVAILABLE = False
    print("[Voice] Whisper not available")

# Try to import Coqui TTS
try:
    from TTS.api import TTS
    COQUI_TTS_AVAILABLE = True
except ImportError:
    COQUI_TTS_AVAILABLE = False
    print("[Voice] Coqui TTS not available")

# Try to import edge-tts (alternative, works with Python 3.12)
try:
    import edge_tts
    EDGE_TTS_AVAILABLE = True
except ImportError:
    EDGE_TTS_AVAILABLE = False
    print("[Voice] edge-tts not available")

# Initialize models (lazy load)
whisper_model = None
tts_model = None

# Whisper model size (tiny, base, small, medium, large)
# base is a good balance between speed and accuracy
WHISPER_MODEL_SIZE = os.getenv("WHISPER_MODEL_SIZE", "base")

def get_whisper_model(model_size: Optional[str] = None):
    """Lazy load Whisper model"""
    global whisper_model
    if whisper_model is None and WHISPER_AVAILABLE:
        size = model_size or WHISPER_MODEL_SIZE
        print(f"[Voice] Loading Whisper model: {size}")
        print("[Voice] This may take a minute on first run...")
        whisper_model = whisper.load_model(size)
        print("[Voice] Whisper model loaded successfully")
    return whisper_model

def get_tts_model():
    """Lazy load TTS model (Coqui TTS or edge-tts)"""
    global tts_model
    if tts_model is None:
        # Try Coqui TTS first (if available)
        if COQUI_TTS_AVAILABLE:
            print("[Voice] Loading Coqui TTS model...")
            print("[Voice] This may take a minute on first run (downloading model)...")
            try:
                tts_model = TTS(model_name="tts_models/en/ljspeech/tacotron2-DDC", progress_bar=False)
                print("[Voice] Coqui TTS model loaded successfully")
                return tts_model
            except Exception as e:
                print(f"[Voice] Error loading Coqui TTS: {e}")
                # Try alternative model
                try:
                    tts_model = TTS(model_name="tts_models/en/vctk/vits", progress_bar=False)
                    print("[Voice] Coqui TTS model loaded (alternative)")
                    return tts_model
                except Exception as e2:
                    print(f"[Voice] Failed to load Coqui TTS: {e2}")
        
        # Fallback to edge-tts (works with Python 3.12)
        if EDGE_TTS_AVAILABLE:
            print("[Voice] Using edge-tts (works with Python 3.12)")
            tts_model = "edge-tts"  # Marker that we're using edge-tts
            return tts_model
    
    return tts_model

def speech_to_text(audio_bytes: bytes, language: str = "en") -> Dict[str, Any]:
    """
    Convert speech audio to text using Whisper
    
    Args:
        audio_bytes: Audio file as bytes (WAV, MP3, M4A, etc.)
        language: Language code (default: "en")
    
    Returns:
        Dictionary with transcribed text and metadata
    """
    try:
        if not WHISPER_AVAILABLE:
            return {
                "success": False,
                "error": "Whisper not available. Install with: pip install openai-whisper"
            }
        
        model = get_whisper_model()
        if model is None:
            return {
                "success": False,
                "error": "Failed to load Whisper model"
            }
        
        # Convert audio to WAV format if needed (Whisper works best with WAV)
        # Save audio to temp file with appropriate extension
        audio_ext = '.webm'  # Default to original format
        converted_audio_bytes = audio_bytes
        
        # Try to convert WebM to WAV using pydub (requires ffmpeg)
        if PYDUB_AVAILABLE and FFMPEG_AVAILABLE:
            try:
                print("[Voice] Converting audio to WAV format...")
                # Try to detect format and convert to WAV
                audio_segment = AudioSegment.from_file(io.BytesIO(audio_bytes))
                # Convert to WAV format (mono, 16kHz for better Whisper compatibility)
                audio_segment = audio_segment.set_channels(1).set_frame_rate(16000)
                wav_bytes = io.BytesIO()
                audio_segment.export(wav_bytes, format="wav")
                converted_audio_bytes = wav_bytes.getvalue()
                audio_ext = '.wav'
                print("[Voice] Audio converted to WAV format (mono, 16kHz)")
            except Exception as e:
                print(f"[Voice] Audio conversion failed: {e}")
                print("[Voice] Trying with original format...")
                # Continue with original format
        elif PYDUB_AVAILABLE and not FFMPEG_AVAILABLE:
            print("[Voice] FFmpeg not found - skipping audio conversion")
            print("[Voice] Whisper will try to process original format (may fail)")
        
        # Save audio to temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix=audio_ext) as tmp_file:
            tmp_file.write(converted_audio_bytes)
            tmp_path = tmp_file.name
        
        try:
            # Transcribe audio
            print(f"[Voice] Transcribing audio (language: {language})...")
            # Use fp16=False to avoid CPU warning, and load audio directly from bytes if possible
            result = model.transcribe(
                tmp_path, 
                language=language if language != "auto" else None,
                fp16=False  # Use FP32 on CPU
            )
            
            text = result["text"].strip()
            language_detected = result.get("language", language)
            
            print(f"[Voice] Transcribed: {text[:50]}...")
            
            return {
                "success": True,
                "text": text,
                "language": language_detected,
                "confidence": 1.0  # Whisper doesn't provide confidence scores
            }
        finally:
            # Clean up temp file
            if os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except:
                    pass
                
    except Exception as e:
        print(f"[Voice] STT error: {e}")
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "error": str(e)
        }

def text_to_speech(text: str, speaker: Optional[str] = None) -> Dict[str, Any]:
    """
    Convert text to speech audio using Coqui TTS or edge-tts
    
    Args:
        text: Text to convert to speech
        speaker: Optional speaker ID (for multi-speaker models) or voice name for edge-tts
    
    Returns:
        Dictionary with audio bytes and metadata
    """
    try:
        tts = get_tts_model()
        if tts is None:
            return {
                "success": False,
                "error": "No TTS engine available. Install with: pip install edge-tts (or TTS for Coqui)"
            }
        
        print(f"[Voice] Synthesizing speech: {text[:50]}...")
        
        # Check if using edge-tts
        if tts == "edge-tts" or (isinstance(tts, str) and tts == "edge-tts"):
            # Use edge-tts (works with Python 3.12)
            import asyncio
            import edge_tts
            
            # Get a good English voice (default to a natural-sounding one)
            voice_name = speaker or "en-US-AriaNeural"  # Natural female voice
            
            async def generate_audio():
                communicate = edge_tts.Communicate(text, voice_name)
                audio_data = b""
                async for chunk in communicate.stream():
                    if chunk["type"] == "audio":
                        audio_data += chunk["data"]
                return audio_data
            
            # Run async function - handle case where event loop is already running
            try:
                # Try to get the current event loop
                loop = asyncio.get_running_loop()
                # If we're in an async context, we need to use a different approach
                # Create a new thread with a new event loop
                import concurrent.futures
                import threading
                
                def run_in_thread():
                    new_loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(new_loop)
                    try:
                        return new_loop.run_until_complete(generate_audio())
                    finally:
                        new_loop.close()
                
                with concurrent.futures.ThreadPoolExecutor() as executor:
                    future = executor.submit(run_in_thread)
                    audio_bytes_data = future.result(timeout=30)
            except RuntimeError:
                # No event loop running, create one
                try:
                    loop = asyncio.get_event_loop()
                except RuntimeError:
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
                audio_bytes_data = loop.run_until_complete(generate_audio())
            
            print(f"[Voice] Speech synthesized with edge-tts ({len(audio_bytes_data)} bytes)")
            
            return {
                "success": True,
                "audio_bytes": audio_bytes_data,
                "format": "mp3",  # edge-tts outputs MP3
                "sample_rate": 24000  # edge-tts default sample rate
            }
        
        # Use Coqui TTS (if available)
        elif COQUI_TTS_AVAILABLE:
            # Generate audio with Coqui TTS
            # TTS returns numpy array
            audio_data = tts.tts(text=text, speaker=speaker)
            
            # Convert to WAV bytes
            import soundfile as sf
            
            audio_bytes = io.BytesIO()
            # Ensure audio_data is numpy array
            if not isinstance(audio_data, np.ndarray):
                audio_data = np.array(audio_data)
            
            # Get sample rate from TTS model (usually 22050)
            sample_rate = getattr(tts, 'output_sample_rate', 22050)
            
            sf.write(audio_bytes, audio_data, samplerate=sample_rate, format='WAV')
            
            print(f"[Voice] Speech synthesized with Coqui TTS ({len(audio_bytes.getvalue())} bytes)")
            
            return {
                "success": True,
                "audio_bytes": audio_bytes.getvalue(),
                "format": "wav",
                "sample_rate": sample_rate
            }
        else:
            return {
                "success": False,
                "error": "No TTS engine available"
            }
        
    except Exception as e:
        print(f"[Voice] TTS error: {e}")
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "error": str(e)
        }

def get_voice_info() -> Dict[str, Any]:
    """Get information about available voice models"""
    info = {
        "whisper_available": WHISPER_AVAILABLE,
        "coqui_tts_available": COQUI_TTS_AVAILABLE,
        "edge_tts_available": EDGE_TTS_AVAILABLE,
        "tts_available": COQUI_TTS_AVAILABLE or EDGE_TTS_AVAILABLE,
        "whisper_model_loaded": whisper_model is not None,
        "tts_model_loaded": tts_model is not None,
        "whisper_model_size": WHISPER_MODEL_SIZE,
        "tts_engine": None
    }
    
    if tts_model:
        if tts_model == "edge-tts" or (isinstance(tts_model, str) and tts_model == "edge-tts"):
            info["tts_engine"] = "edge-tts"
        elif COQUI_TTS_AVAILABLE:
            info["tts_engine"] = "coqui-tts"
            try:
                info["tts_model_name"] = tts_model.model_name
                info["tts_speakers"] = getattr(tts_model, 'speakers', [])
            except:
                pass
    
    return info
