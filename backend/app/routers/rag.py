"""
RAG API endpoints for document management and retrieval.
Search endpoint uses the same vector DB as the chatbot (CHATBOT_VECTOR_DB: pinecone | local)
so checklist and chatbot both hit Pinecone or Local ChromaDB.
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from typing import List, Optional, Any, Dict
import os
import uuid
from pathlib import Path
from app.auth import get_current_active_user, require_role
from app.database import db
from app.models import UserInDB, Role
from app.services.rag_service import rag_service
from app.services.local_vd_service import local_vd_service
from bson import ObjectId
from dotenv import load_dotenv

_backend_dir = Path(__file__).resolve().parent.parent.parent

def serialize_document(doc: Any) -> Any:
    """Recursively convert ObjectIds and other non-serializable types to strings"""
    if doc is None:
        return None
    
    # Handle ObjectId directly
    if isinstance(doc, ObjectId):
        return str(doc)
    
    # Handle dict/dict-like objects
    if isinstance(doc, dict):
        result = {}
        for key, value in doc.items():
            result[key] = serialize_document(value)
        return result
    
    # Handle lists
    if isinstance(doc, list):
        return [serialize_document(item) for item in doc]
    
    # Handle datetime and other common MongoDB types
    from datetime import datetime, date
    if isinstance(doc, (datetime, date)):
        return doc.isoformat()
    
    # Return as-is for other types (str, int, float, bool, etc.)
    return doc

load_dotenv()

router = APIRouter()

# Require admin role for document upload
admin_only = require_role([Role.ADMIN])

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
RAG_DOCS_DIR = os.path.join(UPLOAD_DIR, "rag_documents")
Path(RAG_DOCS_DIR).mkdir(parents=True, exist_ok=True)

@router.post("/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    department_id: str = Form(...),
    document_name: Optional[str] = Form(None),
    current_user: UserInDB = Depends(admin_only)
):
    """
    Upload and process a PDF document for RAG
    
    - **file**: PDF file to upload
    - **department_id**: Department ID this document belongs to
    - **document_name**: Optional name for the document (defaults to filename)
    """
    try:
        # Validate file type (only PDF for now)
        if not file.filename.lower().endswith('.pdf'):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only PDF files are supported"
            )
        
        # Validate department exists
        dept = await db.departments.find_one({"_id": ObjectId(department_id)})
        if not dept:
            raise HTTPException(status_code=404, detail="Department not found")
        
        # Check file size (max 50MB for documents)
        MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
        file_content = await file.read()
        
        if len(file_content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File size exceeds maximum limit of 50MB"
            )
        
        # Create department-specific folder
        dept_name = dept["name"].replace("/", "_").replace("\\", "_").replace(":", "_")
        dept_folder = os.path.join(RAG_DOCS_DIR, dept_name)
        Path(dept_folder).mkdir(parents=True, exist_ok=True)
        
        # Generate unique filename and save
        unique_filename = f"{uuid.uuid4()}.pdf"
        file_path = os.path.join(dept_folder, unique_filename)
        
        with open(file_path, "wb") as buffer:
            buffer.write(file_content)
        
        # Generate document ID
        document_id = str(uuid.uuid4())
        doc_name = document_name or file.filename
        
        # Process document with RAG service
        result = rag_service.process_document(
            file_path=file_path,
            department_id=department_id,
            document_id=document_id,
            document_name=doc_name,
            metadata={
                "uploaded_by": str(current_user.id),
                "original_filename": file.filename,
                "file_path": file_path
            }
        )
        
        if not result.get("success"):
            # Clean up file if processing failed
            try:
                os.remove(file_path)
            except:
                pass
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to process document: {result.get('error', 'Unknown error')}"
            )
        
        # Store document metadata in MongoDB
        from datetime import datetime
        doc_dict = {
            "document_id": document_id,
            "department_id": ObjectId(department_id),
            "name": doc_name,
            "original_filename": file.filename,
            "file_path": file_path,
            "file_size": len(file_content),
            "chunks_count": result.get("chunks_count", 0),
            "uploaded_by": ObjectId(current_user.id),
            "uploaded_at": datetime.utcnow()
        }
        
        await db.rag_documents.insert_one(doc_dict)
        
        return {
            "success": True,
            "document_id": document_id,
            "document_name": doc_name,
            "chunks_count": result.get("chunks_count", 0),
            "message": "Document uploaded and processed successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error uploading document: {str(e)}"
        )

@router.get("/documents")
async def get_documents(
    department_id: Optional[str] = None,
    current_user: UserInDB = Depends(admin_only)
):
    """Get all uploaded documents, optionally filtered by department"""
    try:
        query = {}
        if department_id and department_id != 'all' and department_id:
            try:
                query["department_id"] = ObjectId(department_id)
            except Exception as obj_err:
                print(f"Invalid department ID format: {department_id}, error: {obj_err}")
                raise HTTPException(status_code=400, detail="Invalid department ID format")
        
        # Query documents - handle empty collection gracefully
        try:
            documents_cursor = db.rag_documents.find(query).sort("uploaded_at", -1)
            documents = await documents_cursor.to_list(length=1000)
        except Exception as coll_error:
            # Collection doesn't exist yet or query failed, return empty list
            print(f"Error querying documents: {coll_error}")
            import traceback
            traceback.print_exc()
            return []
        
        # Normalize IDs - convert all ObjectIds to strings
        result = []
        for doc in documents:
            try:
                # Convert MongoDB document to dict first
                if hasattr(doc, '__dict__'):
                    doc_dict = dict(doc)
                else:
                    doc_dict = dict(doc) if isinstance(doc, dict) else {}
                
                # Serialize all ObjectIds and non-serializable types
                doc_dict = serialize_document(doc_dict)
                
                # Ensure 'id' field exists (convert _id to id)
                if "_id" in doc_dict:
                    doc_dict["id"] = doc_dict.pop("_id")
                elif "id" not in doc_dict and "_id" not in doc_dict:
                    # If neither exists, skip this document
                    print(f"Warning: Document missing _id field: {doc}")
                    continue
                
                result.append(doc_dict)
            except Exception as norm_err:
                print(f"Error normalizing document: {norm_err}")
                import traceback
                traceback.print_exc()
                continue
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        print(f"Unexpected error fetching documents: {e}")
        import traceback
        traceback.print_exc()
        # Return empty list instead of raising to avoid breaking frontend
        return []

@router.delete("/documents/{document_id}")
async def delete_document(
    document_id: str,
    current_user: UserInDB = Depends(admin_only)
):
    """Delete a document and all its chunks from RAG system"""
    try:
        # Get document from MongoDB
        doc = await db.rag_documents.find_one({"document_id": document_id})
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")
        
        department_id = str(doc["department_id"])
        
        # Delete chunks from Pinecone
        rag_service.delete_document(document_id, department_id)
        
        # Delete file if exists
        file_path = doc.get("file_path")
        if file_path and os.path.exists(file_path):
            try:
                os.remove(file_path)
            except:
                pass  # Continue even if file deletion fails
        
        # Delete from MongoDB
        await db.rag_documents.delete_one({"document_id": document_id})
        
        return {"success": True, "message": "Document deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting document: {str(e)}"
        )

def _get_search_vector_db() -> str:
    """Which vector DB to use for search (checklist + chatbot): pinecone | local."""
    load_dotenv(dotenv_path=_backend_dir / ".env", override=True)
    v = (os.getenv("CHATBOT_VECTOR_DB") or "pinecone").strip().lower()
    return v if v in ("pinecone", "local") else "pinecone"


@router.get("/documents/search")
async def search_documents(
    query: str,
    department_id: Optional[str] = None,
    n_results: int = 5,
    current_user: UserInDB = Depends(get_current_active_user)
):
    """
    Search documents using semantic search. Uses the same vector DB as the chatbot
    (CHATBOT_VECTOR_DB: pinecone = RAG Documents, local = Local VD ChromaDB).
    Checklist and chatbot both use this so policy answers match the selected source.
    """
    try:
        # Determine department ID
        if not department_id:
            if not getattr(current_user, "department_id", None):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No department specified and user has no department assigned"
                )
            department_id = str(current_user.department_id)
        else:
            department_id = str(department_id).strip()

        # Validate department exists
        dept = await db.departments.find_one({"_id": ObjectId(department_id)})
        if not dept:
            raise HTTPException(status_code=404, detail="Department not found")

        vector_db = _get_search_vector_db()
        n_results = min(max(1, n_results), 50)

        if vector_db == "local":
            # Local VD (ChromaDB) – same source as chatbot when "Local (ChromaDB)" is selected
            results = local_vd_service.search_documents(
                query=query,
                department_id=department_id,
                n_results=n_results,
            )
        else:
            # Pinecone (RAG Documents)
            results = rag_service.search_documents(
                query=query,
                department_id=department_id,
                n_results=n_results,
            )

        return {
            "query": query,
            "department_id": department_id,
            "results": results,
            "count": len(results),
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Search error: {str(e)}",
        )

@router.get("/documents/stats")
async def get_document_stats(
    department_id: Optional[str] = None,
    current_user: UserInDB = Depends(admin_only)
):
    """Get statistics about documents in RAG system"""
    try:
        if department_id:
            stats = rag_service.get_department_stats(department_id)
            return {
                "department_id": department_id,
                **stats
            }
        else:
            # Get stats for all departments
            departments = await db.departments.find().to_list(length=1000)
            all_stats = {}
            
            for dept in departments:
                dept_id = str(dept["_id"])
                stats = rag_service.get_department_stats(dept_id)
                all_stats[dept_id] = {
                    "department_name": dept["name"],
                    **stats
                }
            
            return {"departments": all_stats}
            
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting stats: {str(e)}"
        )

