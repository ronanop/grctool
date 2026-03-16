"""
Local VD (ChromaDB) API: document upload, list, delete, search.
Metadata stored in MongoDB collection local_vd_documents.
"""
import os
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from bson import ObjectId
from dotenv import load_dotenv

from app.auth import get_current_active_user, require_role
from app.database import db
from app.models import UserInDB, Role
from app.services.local_vd_service import local_vd_service

load_dotenv()

router = APIRouter()
admin_only = require_role([Role.ADMIN])

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
LOCAL_VD_DOCS_DIR = os.path.join(UPLOAD_DIR, "local_vd_documents")
Path(LOCAL_VD_DOCS_DIR).mkdir(parents=True, exist_ok=True)


def serialize_document(doc: Any) -> Any:
    if doc is None:
        return None
    if isinstance(doc, ObjectId):
        return str(doc)
    if isinstance(doc, dict):
        return {k: serialize_document(v) for k, v in doc.items()}
    if isinstance(doc, list):
        return [serialize_document(item) for item in doc]
    from datetime import datetime, date
    if isinstance(doc, (datetime, date)):
        return doc.isoformat()
    return doc


@router.post("/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    department_id: str = Form(...),
    document_name: Optional[str] = Form(None),
    current_user: UserInDB = Depends(admin_only),
):
    """Upload a PDF; chunk and store in ChromaDB (local vector database)."""
    try:
        if not file.filename.lower().endswith(".pdf"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only PDF files are supported",
            )

        dept = await db.departments.find_one({"_id": ObjectId(department_id)})
        if not dept:
            raise HTTPException(status_code=404, detail="Department not found")

        MAX_FILE_SIZE = 50 * 1024 * 1024
        file_content = await file.read()
        if len(file_content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File size exceeds maximum limit of 50MB",
            )

        dept_name = dept["name"].replace("/", "_").replace("\\", "_").replace(":", "_")
        dept_folder = os.path.join(LOCAL_VD_DOCS_DIR, dept_name)
        Path(dept_folder).mkdir(parents=True, exist_ok=True)
        unique_filename = f"{uuid.uuid4()}.pdf"
        file_path = os.path.join(dept_folder, unique_filename)
        with open(file_path, "wb") as buffer:
            buffer.write(file_content)

        document_id = str(uuid.uuid4())
        doc_name = document_name or file.filename

        result = local_vd_service.process_document(
            file_path=file_path,
            department_id=department_id,
            document_id=document_id,
            document_name=doc_name,
            metadata={
                "uploaded_by": str(current_user.id),
                "original_filename": file.filename,
                "file_path": file_path,
            },
        )

        if not result.get("success"):
            try:
                os.remove(file_path)
            except Exception:
                pass
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=result.get("error", "Failed to process document"),
            )

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
            "uploaded_at": datetime.utcnow(),
        }
        await db.local_vd_documents.insert_one(doc_dict)

        return {
            "success": True,
            "document_id": document_id,
            "document_name": doc_name,
            "chunks_count": result.get("chunks_count", 0),
            "message": "Document uploaded and processed successfully (ChromaDB)",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.get("/documents")
async def get_documents(
    department_id: Optional[str] = None,
    current_user: UserInDB = Depends(admin_only),
):
    """List uploaded documents (from MongoDB), optionally by department."""
    try:
        query = {}
        if department_id and department_id not in ("", "all"):
            try:
                query["department_id"] = ObjectId(department_id)
            except Exception:
                raise HTTPException(status_code=400, detail="Invalid department ID")

        cursor = db.local_vd_documents.find(query).sort("uploaded_at", -1)
        documents = await cursor.to_list(length=1000)

        result = []
        for doc in documents:
            doc_dict = serialize_document(doc)
            if "_id" in doc_dict:
                doc_dict["id"] = doc_dict.pop("_id")
            result.append(doc_dict)
        return result
    except HTTPException:
        raise
    except Exception as e:
        return []


@router.delete("/documents/{document_id}")
async def delete_document(
    document_id: str,
    current_user: UserInDB = Depends(admin_only),
):
    """Delete document and all its chunks from ChromaDB and MongoDB."""
    try:
        doc = await db.local_vd_documents.find_one({"document_id": document_id})
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")
        department_id = str(doc["department_id"])
        local_vd_service.delete_document(document_id, department_id)
        file_path = doc.get("file_path")
        if file_path and os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception:
                pass
        await db.local_vd_documents.delete_one({"document_id": document_id})
        return {"success": True, "message": "Document deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.get("/documents/search")
async def search_documents(
    query: str,
    department_id: Optional[str] = None,
    n_results: int = 5,
    current_user: UserInDB = Depends(admin_only),
):
    """Search documents in ChromaDB (semantic search). Admin only."""
    if not department_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="department_id is required for local VD search",
        )
    dept = await db.departments.find_one({"_id": ObjectId(department_id)})
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    results = local_vd_service.search_documents(
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
