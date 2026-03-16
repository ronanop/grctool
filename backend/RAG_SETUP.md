# RAG (Retrieval Augmented Generation) Setup Guide

## Overview

This application includes RAG capabilities using **Pinecone** for vector storage and semantic search. PDF documents can be uploaded per department, chunked, embedded, and used to provide context-aware responses.

## Architecture

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐      ┌─────────────┐
│   PDF       │─────▶│   FastAPI    │─────▶│  Pinecone   │      │   OpenAI    │
│  Document   │      │   Backend    │      │  (Vector DB)│      │   Chatbot   │
│             │      │              │      │             │      │  (RAG ctx)  │
└─────────────┘      └──────────────┘      └─────────────┘      └─────────────┘
                            │                       │                    │
                            │                       │                    │
                            ▼                       ▼                    ▼
                     ┌──────────────┐      ┌─────────────┐      ┌─────────────┐
                     │  MongoDB     │      │ Sentence    │      │  RAG search │
                     │  (Metadata)  │      │ Transformers│      │  + context  │
                     └──────────────┘      └─────────────┘      └─────────────┘
```

## Installation

### 1. Install Required Dependencies

```bash
cd backend
pip install -r requirements.txt
```

This installs `pinecone`, `pypdf`, `sentence-transformers`, and other RAG dependencies.

### 2. Create a Pinecone Index

1. Sign up at [pinecone.io](https://www.pinecone.io/) and get an API key.
2. Create an index with **dimension 1024** (for the default embedding model `BAAI/bge-large-en-v1.5`): name e.g. `rag-documents`, metric **cosine** or dotproduct. If you use `EMBEDDING_MODEL=all-MiniLM-L6-v2`, create the index with dimension **384** instead.

### 3. Download Embedding Model

The first time you run the app, the embedding model (`BAAI/bge-large-en-v1.5`, 1024 dims) is downloaded and cached locally.

## Configuration

### Environment Variables

Add to your `backend/.env`:

```env
# Pinecone (required for RAG)
PINECONE_API_KEY=your-pinecone-api-key
PINECONE_INDEX_NAME=rag-documents

# Embedding model (default: BAAI/bge-large-en-v1.5 = 1024 dims; or all-MiniLM-L6-v2 = 384 dims; index dimension must match)
EMBEDDING_MODEL=BAAI/bge-large-en-v1.5
```

## How It Works

### 1. Document Upload

- Admin uploads PDF documents via the "RAG Documents" page
- Documents are assigned to specific departments
- Each document is processed and chunked

### 2. Document Processing

- **Text Extraction**: PDF text is extracted using `pypdf`
- **Chunking**: Text is split into chunks (default: 500 characters with 50 char overlap)
- **Embedding**: Each chunk is converted to a vector using Sentence Transformers
- **Storage**: Chunks and embeddings are stored in Pinecone (per-department namespaces)

### 3. RAG Retrieval

When a user asks a question in the chatbot:
1. Query is converted to an embedding
2. Similar chunks are retrieved from Pinecone (semantic search)
3. Relevant context is added to the system prompt
4. OpenAI generates a response using the context

## Usage

### Upload Documents

1. Navigate to **Admin → RAG Documents**
2. Click **Upload Document**
3. Select a department
4. Choose a PDF file (max 50MB)
5. Optionally provide a document name
6. Click **Upload & Process**

The document will be:
- Saved to disk
- Processed and chunked
- Stored in Pinecone
- Metadata saved in MongoDB

### Search Documents

1. Go to **RAG Documents** page
2. Use the search box to query documents
3. Results show relevant chunks with relevance scores
4. Filter by department if needed

### Chatbot Integration

The chatbot automatically uses RAG when:
- User has a department assigned
- Documents exist for that department
- Query is relevant to uploaded documents

The chatbot will include relevant document context in its responses.

## API Endpoints

### POST `/api/v1/rag/documents/upload`
Upload and process a PDF document.

**Form Data:**
- `file`: PDF file
- `department_id`: Department ID
- `document_name`: Optional document name

### GET `/api/v1/rag/documents`
Get all uploaded documents (optionally filtered by department).

**Query Parameters:**
- `department_id`: Optional department filter

### DELETE `/api/v1/rag/documents/{document_id}`
Delete a document and all its chunks.

### GET `/api/v1/rag/documents/search`
Search documents using semantic search.

**Query Parameters:**
- `query`: Search query
- `department_id`: Optional department filter
- `n_results`: Number of results (default: 5)

### GET `/api/v1/rag/documents/stats`
Get statistics about documents in the RAG system.

## Storage Locations

- **Pinecone**: Vector index (namespaces per department: `department_{id}`)
- **PDF Files**: `./uploads/rag_documents/{department_name}/`
- **Metadata**: MongoDB collection `rag_documents`

## Chunking Strategy

- **Chunk Size**: 500 characters (default)
- **Overlap**: 50 characters between chunks
- **Sentence Boundary**: Attempts to break at sentence boundaries when possible

This ensures:
- Context is preserved across chunks
- Better semantic search results
- More accurate RAG responses

## Troubleshooting

### Error: "No module named 'pinecone'" or "PINECONE_API_KEY is not set"
- Install dependencies: `pip install -r requirements.txt`
- Set `PINECONE_API_KEY` in `.env` and create a Pinecone index with dimension 1024 (or 384 if using all-MiniLM-L6-v2)

### Error: "Failed to download embedding model"
- Check internet connection (first-time download only)
- Model is ~80MB, ensure sufficient disk space
- After first download, model is cached locally

### Error: "No text extracted from PDF"
- PDF might be scanned/image-based (OCR not included)
- Try a text-based PDF
- Check if PDF is corrupted

### Slow Processing
- Large PDFs take longer to process
- First-time embedding model download takes time
- Consider splitting very large documents

### Pinecone Errors
- Verify `PINECONE_API_KEY` and `PINECONE_INDEX_NAME` in `.env`
- Ensure the index exists with dimension **1024** (for default `BAAI/bge-large-en-v1.5`) or **384** (for `all-MiniLM-L6-v2`)
- Check Pinecone console for index status and quota

## Performance Tips

1. **Chunk Size**: Adjust in `rag_service.py` if needed
   - Smaller chunks = more precise but more storage
   - Larger chunks = less storage but less precise

2. **Embedding Model**: Change model in `.env` if needed
   - `BAAI/bge-large-en-v1.5`: Default, 1024 dims, high quality
   - `all-MiniLM-L6-v2`: 384 dims, fast, good quality (~80MB)
   - `all-mpnet-base-v2`: Better quality, slower (~420MB)

3. **Number of Results**: Adjust `n_results` in search
   - More results = more context but slower
   - Default: 3 chunks per query

## Offline / Cloud

- **Pinecone**: Runs in the cloud (requires internet for RAG document upload and search).
- **Embedding model**: Runs locally (after first download); no external API for embeddings.
- **First-time**: Embedding model download (~80MB) and Pinecone API key required.

## Next Steps

1. Upload department-specific PDF documents
2. Test the search functionality
3. Ask questions in the chatbot to see RAG in action
4. Monitor document stats to track usage

The RAG system is now ready to provide context-aware, document-based responses! 🚀






