"""
RAG Service for document chunking and retrieval using Pinecone
"""
import os
import sys
import uuid
import json
from pathlib import Path
from typing import List, Optional, Dict, Any
from pypdf import PdfReader
import hashlib

# If orjson fails to load (e.g. Windows Application Control blocks its DLL), stub with stdlib json
# so Pinecone can still be imported.
try:
    import orjson
except (ImportError, OSError, Exception):
    class _OrjsonStub:
        @staticmethod
        def dumps(obj, *, default=None, **kwargs):
            # orjson.dumps returns bytes; Pinecone's client may call .decode() on the result
            s = json.dumps(obj, separators=(',', ':'), default=default or (lambda x: str(x)))
            return s.encode("utf-8")

        @staticmethod
        def loads(s):
            if isinstance(s, bytes):
                s = s.decode("utf-8")
            return json.loads(s)

    sys.modules["orjson"] = _OrjsonStub()

# Lazy imports: pinecone, sentence_transformers, torch are loaded only when needed.

# Pinecone config (index must exist with dimension matching embedding model)
# Default model BAAI/bge-large-en-v1.5 outputs 1024 dims; or set EMBEDDING_MODEL=all-MiniLM-L6-v2 and use index dim 384
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY", "")
PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME", "rag-documents")
PINECONE_ENVIRONMENT = os.getenv("PINECONE_ENVIRONMENT", "")  # Optional for serverless

_pinecone_index = None

def get_pinecone_index():
    """Lazy load Pinecone index connection."""
    global _pinecone_index
    if _pinecone_index is None:
        if not PINECONE_API_KEY:
            raise RuntimeError(
                "PINECONE_API_KEY is not set. Set it in .env to use RAG with Pinecone."
            )
        try:
            from pinecone import Pinecone
            pc = Pinecone(api_key=PINECONE_API_KEY)
            _pinecone_index = pc.Index(PINECONE_INDEX_NAME)
        except ImportError as e:
            raise RuntimeError(
                "Pinecone client not installed or wrong Python env. "
                "From the folder where you run uvicorn, use: python -m pip install pinecone. "
                f"(Original: {e})"
            ) from e
    return _pinecone_index

# Embedding model (1024 dims = matches common Pinecone index; use all-MiniLM-L6-v2 for 384-dim index)
EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL", "BAAI/bge-large-en-v1.5")
embedding_model = None

def get_embedding_model():
    """Lazy load embedding model (CPU only)."""
    global embedding_model
    if embedding_model is None:
        print(f"Loading embedding model: {EMBEDDING_MODEL_NAME} (CPU)")
        device = "cpu"
        try:
            from sentence_transformers import SentenceTransformer
            embedding_model = SentenceTransformer(EMBEDDING_MODEL_NAME, device=device)
            print(f"✅ Embedding model loaded on CPU")
        except OSError as e:
            if "4551" in str(e) or "Application Control" in str(e):
                raise RuntimeError(
                    "Windows Application Control blocked PyTorch. Allow asmjit.dll or fix policy."
                ) from e
            raise
    return embedding_model

def get_gpu_info() -> Dict[str, Any]:
    """Get GPU information if available."""
    try:
        import torch
        if torch.cuda.is_available():
            return {
                "device": "cuda",
                "gpu_name": torch.cuda.get_device_name(0),
                "cuda_version": torch.version.cuda,
                "memory_allocated_mb": round(torch.cuda.memory_allocated(0) / 1024**2, 2),
                "memory_reserved_mb": round(torch.cuda.memory_reserved(0) / 1024**2, 2),
                "total_memory_gb": round(torch.cuda.get_device_properties(0).total_memory / 1024**3, 2)
            }
    except (ImportError, OSError):
        pass
    return {"device": "cpu", "gpu_available": False}

def _namespace(department_id: str) -> str:
    return f"department_{department_id}"

class RAGService:
    """Service for RAG operations with Pinecone (one index, namespaces per department)."""

    def __init__(self):
        self._index = None

    @property
    def index(self):
        if self._index is None:
            self._index = get_pinecone_index()
        return self._index

    def chunk_text(self, text: str, chunk_size: int = 500, chunk_overlap: int = 50) -> List[str]:
        """Split text into chunks with overlap."""
        if not text or len(text.strip()) == 0:
            return []
        chunks = []
        start = 0
        text_length = len(text)
        while start < text_length:
            end = start + chunk_size
            chunk = text[start:end]
            if end < text_length:
                for punct in ['. ', '.\n', '! ', '!\n', '? ', '?\n']:
                    last_punct = chunk.rfind(punct)
                    if last_punct > chunk_size * 0.7:
                        chunk = chunk[:last_punct + 1]
                        end = start + len(chunk)
                        break
            chunks.append(chunk.strip())
            start = end - chunk_overlap
            if start >= text_length:
                break
        return [c for c in chunks if c]

    def extract_text_from_pdf(self, file_path: str) -> str:
        """Extract text from PDF file."""
        try:
            reader = PdfReader(file_path)
            parts = []
            for page in reader.pages:
                t = page.extract_text()
                if t:
                    parts.append(t)
            return "\n\n".join(parts)
        except Exception as e:
            raise Exception(f"Failed to extract text from PDF: {str(e)}")

    def process_document(
        self,
        file_path: str,
        department_id: str,
        document_id: str,
        document_name: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Process a document (PDF) and store chunks in Pinecone."""
        try:
            text = self.extract_text_from_pdf(file_path)
            if not text or len(text.strip()) == 0:
                raise Exception("No text extracted from PDF")
            chunks = self.chunk_text(text)
            if not chunks:
                raise Exception("No chunks created from document")

            model = get_embedding_model()
            gpu_info = get_gpu_info()
            batch_size = 32 if gpu_info.get("device") == "cuda" else 8
            print(f"[RAG] Generating embeddings for {len(chunks)} chunks (batch_size={batch_size})...")
            embeddings = model.encode(
                chunks, batch_size=batch_size, show_progress_bar=False, convert_to_numpy=True
            ).tolist()

            namespace = _namespace(department_id)
            vectors = []
            for i, (chunk, emb) in enumerate(zip(chunks, embeddings)):
                chunk_id = f"{document_id}_chunk_{i}"
                meta = {
                    "document_id": document_id,
                    "document_name": document_name,
                    "department_id": department_id,
                    "chunk_index": i,
                    "total_chunks": len(chunks),
                    "text": chunk[:40_000],  # Pinecone metadata size limit
                }
                if metadata:
                    for k, v in metadata.items():
                        if isinstance(v, (str, int, float, bool)) or (isinstance(v, list) and all(isinstance(x, str) for x in v)):
                            meta[k] = v
                vectors.append({"id": chunk_id, "values": emb, "metadata": meta})

            # Upsert in batches (Pinecone recommends up to 100 vectors per upsert)
            batch_size_upsert = 100
            for j in range(0, len(vectors), batch_size_upsert):
                batch = vectors[j : j + batch_size_upsert]
                self.index.upsert(vectors=batch, namespace=namespace)

            return {
                "success": True,
                "document_id": document_id,
                "chunks_count": len(chunks),
                "total_characters": len(text),
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def search_documents(
        self,
        query: str,
        department_id: Optional[str] = None,
        n_results: int = 5,
        search_all_departments: bool = False
    ) -> List[Dict[str, Any]]:
        """Search for relevant document chunks using semantic search."""
        try:
            model = get_embedding_model()
            query_embedding = model.encode(
                [query], show_progress_bar=False, convert_to_numpy=True
            ).tolist()[0]

            if search_all_departments:
                try:
                    stats = self.index.describe_index_stats()
                    namespaces = stats.get("namespaces") or {}
                    all_results = []
                    for ns_name, ns_stats in namespaces.items():
                        if not ns_name.startswith("department_"):
                            continue
                        count = ns_stats.get("vector_count", 0)
                        if count == 0:
                            continue
                        top_k = min(n_results * 2, count)
                        q = self.index.query(
                            vector=query_embedding,
                            top_k=top_k,
                            namespace=ns_name,
                            include_metadata=True,
                        )
                        dept_id = ns_name.replace("department_", "")
                        for m in (q.get("matches") or []):
                            meta = m.get("metadata") or {}
                            all_results.append({
                                "chunk_id": m.get("id"),
                                "text": meta.get("text", ""),
                                "metadata": meta,
                                "distance": 1 - (m.get("score") or 0) if m.get("score") is not None else None,
                                "department_id": meta.get("department_id", dept_id),
                            })
                    all_results.sort(key=lambda x: (x.get("distance") or float("inf")))
                    return all_results[:n_results]
                except Exception as e:
                    print(f"[RAG] Error searching all departments: {e}")
                    return []

            if not department_id:
                return []
            namespace = _namespace(department_id)
            try:
                q = self.index.query(
                    vector=query_embedding,
                    top_k=n_results,
                    namespace=namespace,
                    include_metadata=True,
                )
            except Exception as e:
                if "not found" in str(e).lower() or "namespace" in str(e).lower():
                    return []
                raise
            formatted = []
            for m in (q.get("matches") or []):
                meta = m.get("metadata") or {}
                formatted.append({
                    "chunk_id": m.get("id"),
                    "text": meta.get("text", ""),
                    "metadata": meta,
                    "distance": 1 - (m.get("score") or 0) if m.get("score") is not None else None,
                })
            return formatted
        except Exception as e:
            print(f"[RAG] Search error: {e}")
            raise Exception(f"Search failed: {str(e)}")

    def delete_document(self, document_id: str, department_id: str) -> bool:
        """Delete all chunks for a document from Pinecone."""
        try:
            namespace = _namespace(department_id)
            self.index.delete(filter={"document_id": {"$eq": document_id}}, namespace=namespace)
            return True
        except Exception as e:
            print(f"Error deleting document: {e}")
            return False

    def get_department_stats(self, department_id: str) -> Dict[str, Any]:
        """Get statistics about documents in a department's namespace."""
        try:
            namespace = _namespace(department_id)
            stats = self.index.describe_index_stats()
            namespaces = stats.get("namespaces") or {}
            ns_stats = namespaces.get(namespace) or {}
            total_chunks = ns_stats.get("vector_count", 0)
            # Unique documents: we'd need to query metadata; for now approximate from chunk count
            return {
                "total_chunks": total_chunks,
                "unique_documents": total_chunks,  # Approximate; Pinecone doesn't aggregate unique metadata values
                "gpu_info": get_gpu_info(),
            }
        except Exception:
            return {
                "total_chunks": 0,
                "unique_documents": 0,
                "gpu_info": get_gpu_info(),
            }

rag_service = RAGService()
