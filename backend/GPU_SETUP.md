# GPU Acceleration Setup Guide

This guide will help you set up GPU acceleration for your RAG embeddings and Ollama chatbot.

## Prerequisites

1. **NVIDIA GPU** (RTX 4060 Laptop GPU - ✅ You have this)
2. **NVIDIA Drivers** (Latest version)
3. **CUDA Toolkit** (Version 11.8 or 12.1 recommended)

## Step 1: Install CUDA Toolkit

1. Download CUDA Toolkit from: https://developer.nvidia.com/cuda-downloads
2. Choose Windows → x86_64 → 10/11 → exe (local)
3. Install with default options
4. Verify installation:
   ```powershell
   nvidia-smi
   nvcc --version
   ```

## Step 2: Install PyTorch with CUDA Support

**Option A: CUDA 11.8 (Recommended for compatibility)**
```powershell
pip uninstall torch torchvision torchaudio
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
```

**Option B: CUDA 12.1 (If you have CUDA 12.1 installed)**
```powershell
pip uninstall torch torchvision torchaudio
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
```

## Step 3: Verify GPU Setup

Run the test script:
```powershell
cd backend
python test_gpu.py
```

You should see:
- ✅ PyTorch installed
- ✅ CUDA is available
- ✅ GPU Device: NVIDIA GeForce RTX 4060 Laptop GPU
- Performance test results

## Step 4: Configure Ollama for GPU

Ollama should automatically detect and use your GPU. Verify:

1. **Check if Ollama is using GPU:**
   ```powershell
   # In one terminal, start monitoring GPU
   nvidia-smi -l 1
   
   # In another terminal, test Ollama
   ollama run deepseek-r1:8b "Hello"
   ```

2. **You should see GPU usage spike in nvidia-smi**

## Step 5: Restart Your FastAPI Server

After installing PyTorch with CUDA:
```powershell
# Stop your current server (Ctrl+C)
# Then restart:
python -m uvicorn app.main:app --reload --port 8000
```

You should see in the logs:
```
✅ GPU acceleration enabled
   GPU: NVIDIA GeForce RTX 4060 Laptop GPU
   CUDA Version: 11.8 (or 12.1)
```

## Performance Expectations

### Before GPU:
- RAG embedding generation: ~50-100 texts/second
- Document processing: ~30-60 seconds per document
- Chat response: 2-5 seconds

### After GPU:
- RAG embedding generation: ~500-1000+ texts/second (5-10x faster)
- Document processing: ~5-10 seconds per document (3-6x faster)
- Chat response: 1-2 seconds (2-3x faster with GPU-accelerated Ollama)

## Troubleshooting

### Issue: "CUDA not available"
**Solution:**
1. Verify CUDA is installed: `nvcc --version`
2. Verify drivers: `nvidia-smi`
3. Reinstall PyTorch with correct CUDA version
4. Restart your computer

### Issue: "Out of memory"
**Solution:**
- Reduce batch size in `rag_service.py` (change `batch_size=32` to `batch_size=16`)
- Close other GPU-intensive applications
- Process documents in smaller batches

### Issue: "PyTorch not found"
**Solution:**
```powershell
pip install torch
```

### Issue: Ollama not using GPU
**Solution:**
1. Make sure Ollama is the latest version
2. Check `nvidia-smi` while running Ollama
3. Some models may not use GPU efficiently - try different models

## Monitoring GPU Usage

**Real-time monitoring:**
```powershell
nvidia-smi -l 1
```

**Check GPU memory:**
```powershell
nvidia-smi --query-gpu=memory.used,memory.total --format=csv
```

## Environment Variables

Your `.env` file should have:
```env
EMBEDDING_MODEL=all-MiniLM-L6-v2
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=deepseek-r1:8b
```

The RAG service will automatically detect and use GPU if available.

## Next Steps

1. ✅ Install CUDA Toolkit
2. ✅ Install PyTorch with CUDA
3. ✅ Run `test_gpu.py` to verify
4. ✅ Restart FastAPI server
5. ✅ Monitor GPU usage during document uploads
6. ✅ Enjoy 5-10x faster RAG processing!
