# Install PyTorch with CUDA Support

## Problem

Your PyTorch is installed as **CPU-only version** (`2.10.0+cpu`), which doesn't support GPU acceleration.

## Solution: Reinstall PyTorch with CUDA

### Step 1: Uninstall Current PyTorch

```powershell
cd C:\Users\HP\Desktop\decgrc\backend
.\venv\Scripts\activate
pip uninstall torch torchvision torchaudio -y
```

### Step 2: Install PyTorch with CUDA 12.1

Since you have CUDA 12.1 installed, install PyTorch with CUDA 12.1 support:

```powershell
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
```

### Step 3: Verify Installation

```powershell
python -c "import torch; print('PyTorch:', torch.__version__); print('CUDA available:', torch.cuda.is_available()); print('CUDA version:', torch.version.cuda if torch.cuda.is_available() else 'N/A')"
```

You should see:
- PyTorch version with `+cu121` (e.g., `2.1.0+cu121`)
- `CUDA available: True`
- CUDA version: `12.1`

### Step 4: Restart Server

After installing, restart your FastAPI server. You should now see:
```
✅ GPU acceleration enabled
   GPU: NVIDIA GeForce RTX 4060 Laptop GPU
   CUDA Version: 12.1
   GPU Memory: 8.00 GB
```

## Alternative: CUDA 11.8

If CUDA 12.1 doesn't work, try CUDA 11.8:

```powershell
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
```

## Why This Matters

- **CPU-only PyTorch**: Slower, uses CPU for all operations
- **CUDA PyTorch**: Much faster, uses GPU for acceleration
- **Your GPU**: RTX 4060 (8GB) - perfect for RAG embeddings and Whisper

## Performance Impact

- **Without GPU**: Embedding generation ~100-200ms per batch
- **With GPU**: Embedding generation ~10-20ms per batch (10x faster!)

## After Installation

1. Restart your server
2. Check logs for "✅ GPU acceleration enabled"
3. Voice chat and RAG will be much faster!
