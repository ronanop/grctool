"""
OCR Service for extracting text from images
"""
import os
from typing import Optional, Dict, Any
from pathlib import Path
import io

# Try to import PIL Image (needed for both OCR libraries)
try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False
    Image = None
    print("[OCR] PIL/Pillow not available")

# Try to import OCR libraries
try:
    import pytesseract
    PYTESSERACT_AVAILABLE = True
except ImportError:
    PYTESSERACT_AVAILABLE = False
    print("[OCR] pytesseract not available")

try:
    import easyocr
    EASYOCR_AVAILABLE = True
except ImportError:
    EASYOCR_AVAILABLE = False
    print("[OCR] easyocr not available")

# Initialize EasyOCR reader (lazy load)
easyocr_reader = None

def get_easyocr_reader():
    """Lazy load EasyOCR reader"""
    global easyocr_reader
    if easyocr_reader is None and EASYOCR_AVAILABLE:
        print("[OCR] Initializing EasyOCR reader...")
        try:
            # Try GPU first, fallback to CPU
            import torch
            use_gpu = torch.cuda.is_available() if hasattr(torch, 'cuda') else False
            easyocr_reader = easyocr.Reader(['en'], gpu=use_gpu)
            print(f"[OCR] EasyOCR reader initialized (GPU: {use_gpu})")
        except Exception as e:
            print(f"[OCR] Error initializing EasyOCR: {e}")
            # Fallback to CPU
            try:
                easyocr_reader = easyocr.Reader(['en'], gpu=False)
                print("[OCR] EasyOCR reader initialized (CPU fallback)")
            except Exception as e2:
                print(f"[OCR] Failed to initialize EasyOCR: {e2}")
                return None
    return easyocr_reader

def extract_text_from_image(
    image_path: str,
    use_easyocr: bool = True
) -> Dict[str, Any]:
    """
    Extract text from an image using OCR
    
    Args:
        image_path: Path to the image file
        use_easyocr: Use EasyOCR if True, otherwise use pytesseract
    
    Returns:
        Dictionary with extracted text and metadata
    """
    try:
        if not os.path.exists(image_path):
            return {
                "success": False,
                "error": "Image file not found"
            }
        
        # Extract text
        extracted_text = ""
        confidence = 0.0
        
        if use_easyocr and EASYOCR_AVAILABLE:
            # EasyOCR can work directly with file path, no need to open with PIL
            reader = get_easyocr_reader()
            if reader:
                results = reader.readtext(image_path)
                extracted_text = "\n".join([result[1] for result in results])
                if results:
                    # Calculate average confidence
                    confidences = [result[2] for result in results]
                    confidence = sum(confidences) / len(confidences) if confidences else 0.0
            else:
                return {
                    "success": False,
                    "error": "EasyOCR reader not available"
                }
        elif PYTESSERACT_AVAILABLE:
            # Check if PIL is available for pytesseract
            if not PIL_AVAILABLE or Image is None:
                return {
                    "success": False,
                    "error": "PIL/Pillow not available. Install Pillow to use pytesseract."
                }
            # Use pytesseract - need to open image first
            image = Image.open(image_path)
            extracted_text = pytesseract.image_to_string(image)
            # Get confidence data
            data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)
            confidences = [int(conf) for conf in data['conf'] if int(conf) > 0]
            confidence = sum(confidences) / len(confidences) / 100.0 if confidences else 0.0
        else:
            return {
                "success": False,
                "error": "No OCR library available. Install pytesseract or easyocr."
            }
        
        if not extracted_text or not extracted_text.strip():
            return {
                "success": False,
                "error": "No text found in image"
            }
        
        return {
            "success": True,
            "text": extracted_text.strip(),
            "confidence": confidence,
            "char_count": len(extracted_text)
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

def extract_text_from_image_bytes(
    image_bytes: bytes,
    use_easyocr: bool = True
) -> Dict[str, Any]:
    """
    Extract text from image bytes
    
    Args:
        image_bytes: Image file as bytes
        use_easyocr: Use EasyOCR if True
    
    Returns:
        Dictionary with extracted text and metadata
    """
    try:
        # Save to temporary file
        import tempfile
        
        with tempfile.NamedTemporaryFile(delete=False, suffix='.png') as tmp_file:
            tmp_file.write(image_bytes)
            tmp_path = tmp_file.name
        
        try:
            result = extract_text_from_image(tmp_path, use_easyocr)
            return result
        finally:
            # Clean up temp file
            if os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except:
                    pass
                
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }
