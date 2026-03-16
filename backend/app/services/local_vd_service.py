"""
Local Vector Database service using ChromaDB.
Documents are chunked, embedded (sentence-transformers), and stored in ChromaDB per department.
"""
import os
import uuid
from pathlib import Path
from typing import List, Optional, Dict, Any

from pypdf import PdfReader

# ChromaDB persistence path (default under project)
CHROMA_PERSIST_DIR = os.getenv("CHROMA_DB_PATH", os.path.join(os.path.dirname(__file__), "..", "..", "chroma_data"))
Path(CHROMA_PERSIST_DIR).mkdir(parents=True, exist_ok=True)

# Same embedding model as RAG for consistency (ChromaDB will load it via embedding function)
EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL", "BAAI/bge-large-en-v1.5")

_chroma_client = None
_embedding_fn = None


def _get_chroma_client():
    global _chroma_client
    if _chroma_client is None:
        try:
            import chromadb
            _chroma_client = chromadb.PersistentClient(path=CHROMA_PERSIST_DIR)
        except ImportError as e:
            raise RuntimeError(
                "ChromaDB not installed. From backend folder run: python -m pip install chromadb. "
                f"(Original: {e})"
            ) from e
    return _chroma_client


def _get_embedding_function():
    global _embedding_fn
    if _embedding_fn is None:
        try:
            from chromadb.utils import embedding_functions
            _embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
                model_name=EMBEDDING_MODEL_NAME
            )
        except Exception as e:
            raise RuntimeError(
                f"ChromaDB embedding function failed (model={EMBEDDING_MODEL_NAME}). "
                f"Ensure sentence-transformers is installed. Original: {e}"
            ) from e
    return _embedding_fn


def _collection_name(department_id: str) -> str:
    """ChromaDB collection name per department (safe for naming)."""
    return f"local_vd_dept_{department_id.replace('-', '_')}"


def chunk_text(text: str, chunk_size: int = 500, chunk_overlap: int = 50) -> List[str]:
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
            for punct in [". ", ".\n", "! ", "!\n", "? ", "?\n"]:
                last_punct = chunk.rfind(punct)
                if last_punct > chunk_size * 0.7:
                    chunk = chunk[: last_punct + 1]
                    end = start + len(chunk)
                    break
        chunks.append(chunk.strip())
        start = end - chunk_overlap
        if start >= text_length:
            break
    return [c for c in chunks if c]


def extract_text_from_pdf(file_path: str) -> str:
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
        raise Exception(f"Failed to extract text from PDF: {str(e)}") from e


class LocalVDService:
    """Service for local vector DB operations with ChromaDB."""

    def __init__(self):
        self._client = None

    @property
    def client(self):
        if self._client is None:
            self._client = _get_chroma_client()
        return self._client

    def get_collection(self, department_id: str):
        name = _collection_name(department_id)
        return self.client.get_or_create_collection(
            name=name,
            embedding_function=_get_embedding_function(),
            metadata={"hnsw:space": "cosine"},
        )

    def process_document(
        self,
        file_path: str,
        department_id: str,
        document_id: str,
        document_name: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Extract text from PDF, chunk, and add to ChromaDB (embeddings computed by ChromaDB)."""
        try:
            text = extract_text_from_pdf(file_path)
            if not text or len(text.strip()) == 0:
                raise Exception("No text extracted from PDF")
            chunks = chunk_text(text)
            if not chunks:
                raise Exception("No chunks created from document")

            collection = self.get_collection(department_id)
            ids = [f"{document_id}_chunk_{i}" for i in range(len(chunks))]
            metadatas = [
                {
                    "document_id": document_id,
                    "document_name": document_name,
                    "department_id": department_id,
                    "chunk_index": str(i),
                    "total_chunks": str(len(chunks)),
                }
                for i in range(len(chunks))
            ]
            # ChromaDB computes embeddings via embedding_function
            collection.add(ids=ids, documents=chunks, metadatas=metadatas)

            return {
                "success": True,
                "document_id": document_id,
                "chunks_count": len(chunks),
                "total_characters": len(text),
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def delete_document(self, document_id: str, department_id: str) -> bool:
        """Delete all chunks for a document from ChromaDB."""
        try:
            collection = self.get_collection(department_id)
            # Get all ids for this document
            result = collection.get(where={"document_id": document_id})
            if result and result["ids"]:
                collection.delete(ids=result["ids"])
            return True
        except Exception as e:
            print(f"[LocalVD] Delete error: {e}")
            return False

    def search_documents(
        self,
        query: str,
        department_id: str,
        n_results: int = 5,
    ) -> List[Dict[str, Any]]:
        """Search for relevant chunks in the department collection."""
        if not department_id or not str(department_id).strip():
            return []
        department_id = str(department_id).strip()
        try:
            collection = self.get_collection(department_id)
            res = collection.query(
                query_texts=[query],
                n_results=min(n_results, 100),
                include=["documents", "metadatas", "distances"],
            )
            if not res or not res.get("ids") or not res["ids"][0]:
                return []
            ids = res["ids"][0]
            docs = (res.get("documents") or [[]])[0] if res.get("documents") else [""] * len(ids)
            metas = (res.get("metadatas") or [[]])[0] if res.get("metadatas") else [{}] * len(ids)
            dists = (res.get("distances") or [[]])[0] if res.get("distances") else [None] * len(ids)
            if not isinstance(docs, list):
                docs = [""] * len(ids)
            if not isinstance(metas, list):
                metas = [{}] * len(ids)
            if not isinstance(dists, list):
                dists = [None] * len(ids)
            return [
                {
                    "chunk_id": ids[i],
                    "text": docs[i] if i < len(docs) else "",
                    "metadata": metas[i] if i < len(metas) else {},
                    "distance": dists[i] if i < len(dists) else None,
                }
                for i in range(len(ids))
            ]
        except Exception as e:
            import traceback
            print(f"[LocalVD] Search error (dept={department_id}): {e}")
            traceback.print_exc()
            return []

    def get_department_stats(self, department_id: str) -> Dict[str, Any]:
        """Return chunk count for the department collection."""
        try:
            collection = self.get_collection(department_id)
            count = collection.count()
            return {
                "total_chunks": count,
                "unique_documents": count,
            }
        except Exception:
            return {"total_chunks": 0, "unique_documents": 0}


local_vd_service = LocalVDService()
