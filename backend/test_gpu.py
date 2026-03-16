"""
GPU Acceleration Test Script
Run this to verify GPU acceleration is working for RAG embeddings
"""
import sys
import time
import io
from pathlib import Path

# Fix Windows console encoding for Unicode characters
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

print("=" * 60)
print("GPU ACCELERATION TEST FOR RAG EMBEDDINGS")
print("=" * 60)

# Test PyTorch and CUDA
print("\n1. Testing PyTorch Installation...")
print("-" * 60)
try:
    import torch
    print("✅ PyTorch installed")
    print(f"   Version: {torch.__version__}")
except ImportError:
    print("❌ PyTorch not installed")
    print("   Install with: pip install torch")
    print("   For CUDA: pip install torch --index-url https://download.pytorch.org/whl/cu118")
    sys.exit(1)

# Test CUDA availability
print("\n2. Testing CUDA Availability...")
print("-" * 60)
if torch.cuda.is_available():
    print("✅ CUDA is available!")
    print(f"   GPU Device: {torch.cuda.get_device_name(0)}")
    print(f"   CUDA Version: {torch.version.cuda}")
    print(f"   cuDNN Version: {torch.backends.cudnn.version() if torch.backends.cudnn.is_available() else 'N/A'}")
    
    props = torch.cuda.get_device_properties(0)
    print(f"   Total GPU Memory: {props.total_memory / 1024**3:.2f} GB")
    print(f"   Compute Capability: {props.major}.{props.minor}")
    device = 'cuda'
else:
    print("⚠️ CUDA not available - will use CPU")
    print("   Make sure:")
    print("   1. NVIDIA drivers are installed")
    print("   2. CUDA toolkit is installed")
    print("   3. PyTorch was installed with CUDA support")
    device = 'cpu'

# Test Sentence Transformers
print("\n3. Testing Sentence Transformers with GPU...")
print("-" * 60)
try:
    from sentence_transformers import SentenceTransformer
    
    model_name = "all-MiniLM-L6-v2"
    print(f"Loading model: {model_name}")
    print(f"Device: {device}")
    
    model = SentenceTransformer(model_name, device=device)
    print(f"✅ Model loaded on: {device}")
    
    if device == 'cuda':
        print(f"   GPU Memory after model load: {torch.cuda.memory_allocated(0) / 1024**2:.2f} MB")
    
except Exception as e:
    print(f"❌ Error loading model: {e}")
    sys.exit(1)

# Performance test
print("\n4. Performance Test...")
print("-" * 60)
test_texts = [
    "This is a test document about ISO 27001 compliance requirements.",
    "Access control policies must be implemented and reviewed regularly.",
    "Information security management systems require continuous monitoring.",
    "Risk assessment is a critical component of compliance frameworks.",
    "Documentation and evidence collection are essential for audits."
] * 20  # 100 texts total

print(f"Encoding {len(test_texts)} text chunks...")

# Warm up
_ = model.encode(test_texts[:5], show_progress_bar=False)

# Actual test
start_time = time.time()
embeddings = model.encode(test_texts, batch_size=32 if device == 'cuda' else 8, show_progress_bar=True)
end_time = time.time()

elapsed = end_time - start_time
speed = len(test_texts) / elapsed

print(f"\n✅ Performance Results:")
print(f"   Texts processed: {len(test_texts)}")
print(f"   Time taken: {elapsed:.2f} seconds")
print(f"   Speed: {speed:.2f} texts/second")
print(f"   Embedding shape: {embeddings.shape}")
print(f"   Embedding dimension: {embeddings.shape[1]}")

if device == 'cuda':
    print(f"\n   GPU Memory Usage:")
    print(f"   - Allocated: {torch.cuda.memory_allocated(0) / 1024**2:.2f} MB")
    print(f"   - Reserved: {torch.cuda.memory_reserved(0) / 1024**2:.2f} MB")
    print(f"   - Cached: {torch.cuda.memory_reserved(0) / 1024**2:.2f} MB")

# Comparison estimate
if device == 'cuda':
    estimated_cpu_time = elapsed * 5  # Rough estimate: GPU is ~5x faster
    print(f"\n📊 Estimated CPU time: ~{estimated_cpu_time:.2f} seconds")
    print(f"   GPU speedup: ~{estimated_cpu_time / elapsed:.1f}x faster")

print("\n" + "=" * 60)
print("TEST COMPLETE")
print("=" * 60)

if device == 'cuda':
    print("\n✅ GPU acceleration is working! Your RAG service will use GPU.")
else:
    print("\n⚠️ Running on CPU. To enable GPU:")
    print("   1. Install CUDA toolkit")
    print("   2. Install PyTorch with CUDA: pip install torch --index-url https://download.pytorch.org/whl/cu118")
    print("   3. Restart your FastAPI server")
