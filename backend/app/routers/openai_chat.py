"""
OpenAI Chat API - proxy to OpenAI Chat Completions for the floating chatbot.
Uses Pinecone (RAG) for document context when answering.
"""
import os
import asyncio
import concurrent.futures
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from dotenv import load_dotenv
from pathlib import Path
from bson import ObjectId

from app.auth import get_current_active_user
from app.models import UserInDB, Role
from app.services.rag_service import rag_service
from app.services.local_vd_service import local_vd_service
from app.database import db

_backend_dir = Path(__file__).resolve().parent.parent.parent
load_dotenv(dotenv_path=_backend_dir / ".env")

router = APIRouter()

ENABLE_RAG = os.getenv("ENABLE_RAG", "true").lower() == "true"
RAG_TIMEOUT_SECONDS = float(os.getenv("RAG_TIMEOUT_SECONDS", "5.0"))

BASE_SYSTEM_PROMPT = """You are a helpful compliance assistant. When relevant context from documents is provided below, use it to answer accurately and cite the source. Be concise and professional."""


def _get_system_prompt() -> str:
    """Build system prompt: base + optional custom instructions from .env."""
    load_dotenv(dotenv_path=_backend_dir / ".env", override=True)
    custom = (os.getenv("CHATBOT_CUSTOM_INSTRUCTIONS") or "").strip().replace("\\n", "\n")
    if custom:
        return f"{BASE_SYSTEM_PROMPT}\n\nAdditional instructions:\n{custom}"
    return BASE_SYSTEM_PROMPT


def _get_openai_key():
    """OpenAI API key from .env (OPENAI_API_KEY)."""
    return (os.getenv("OPENAI_API_KEY") or "").strip()


def _get_openai_model():
    return os.getenv("OPENAI_CHAT_MODEL", "gpt-4o-mini")


class ChatMessage(BaseModel):
    role: str  # "user" | "assistant" | "system"
    content: str


class ChatRequest(BaseModel):
    message: str
    messages: Optional[List[ChatMessage]] = None  # conversation history
    image_base64: Optional[str] = None  # optional image for vision (data sent as base64 string)


class ChatResponse(BaseModel):
    reply: str
    model: str


def _get_chatbot_vector_db() -> str:
    """Which vector DB the chatbot uses: pinecone | local."""
    load_dotenv(dotenv_path=_backend_dir / ".env", override=True)
    v = (os.getenv("CHATBOT_VECTOR_DB") or "pinecone").strip().lower()
    return v if v in ("pinecone", "local") else "pinecone"


async def _get_rag_context(message: str, current_user: UserInDB) -> str:
    """Retrieve relevant document chunks from the configured vector DB (Pinecone or Local ChromaDB) and format as context string."""
    load_dotenv(dotenv_path=_backend_dir / ".env", override=True)
    vector_db = _get_chatbot_vector_db()
    is_admin = current_user.role == Role.ADMIN
    # Normalize department_id to string (ObjectId or str from DB)
    department_id = None
    if getattr(current_user, "department_id", None) is not None:
        department_id = str(current_user.department_id)
    if not ENABLE_RAG or (not is_admin and not department_id):
        if not ENABLE_RAG:
            print("[OpenAI Chat] RAG disabled (ENABLE_RAG=false)")
        elif not is_admin and not department_id:
            print("[OpenAI Chat] No department assigned to user; skipping RAG context")
        return ""

    relevant_chunks = []
    try:
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            if vector_db == "local":
                # Local VD (ChromaDB): search per department
                if is_admin:
                    depts = await db.departments.find({}, {"_id": 1}).to_list(length=100)
                    all_chunks = []
                    # Use one longer timeout for all department searches (first call may load embedding model)
                    timeout_total = max(RAG_TIMEOUT_SECONDS, 20.0)
                    for d in depts:
                        dept_id = str(d["_id"])
                        try:
                            chunks = await asyncio.wait_for(
                                loop.run_in_executor(
                                    executor,
                                    lambda q=message, did=dept_id: local_vd_service.search_documents(q, did, n_results=5),
                                ),
                                timeout=timeout_total,
                            )
                            for c in chunks:
                                c["department_id"] = dept_id
                                all_chunks.append(c)
                        except Exception as e:
                            print(f"[OpenAI Chat] Local VD search failed for dept {dept_id}: {e}")
                            continue
                    all_chunks.sort(key=lambda x: (x.get("distance") if x.get("distance") is not None else float("inf")))
                    relevant_chunks = all_chunks[:5]
                else:
                    relevant_chunks = await asyncio.wait_for(
                        loop.run_in_executor(
                            executor,
                            lambda: local_vd_service.search_documents(message, department_id, n_results=10),
                        ),
                        timeout=max(RAG_TIMEOUT_SECONDS, 20.0),
                    )
                print(f"[OpenAI Chat] Local VD: got {len(relevant_chunks)} chunks (user dept={department_id}, admin={is_admin})")
            else:
                # Pinecone (default)
                future = loop.run_in_executor(
                    executor,
                    lambda: rag_service.search_documents(
                        query=message,
                        department_id=department_id,
                        n_results=5 if is_admin else 3,
                        search_all_departments=is_admin,
                    ),
                )
                relevant_chunks = await asyncio.wait_for(future, timeout=RAG_TIMEOUT_SECONDS)
    except asyncio.TimeoutError:
        print("[OpenAI Chat] RAG search timed out")
        return ""
    except Exception as e:
        import traceback
        print(f"[OpenAI Chat] RAG search error (non-fatal): {e}")
        traceback.print_exc()
        return ""
    if not relevant_chunks:
        print(f"[OpenAI Chat] No RAG chunks found (vector_db={vector_db}, dept={department_id})")
        return ""

    source_label = "Local (ChromaDB)" if vector_db == "local" else "Pinecone"
    rag_context = f"\n\n=== Relevant Context from Documents ({source_label}) ===\n"
    for i, chunk in enumerate(relevant_chunks, 1):
        doc_name = (chunk.get("metadata") or {}).get("document_name", "Document")
        dept_id = chunk.get("department_id") or (chunk.get("metadata") or {}).get("department_id", "")
        chunk_text = (chunk.get("text") or "")[:400]
        if chunk_text and len((chunk.get("text") or "")) > 400:
            chunk_text += "..."
        if is_admin and dept_id:
            try:
                dept = await db.departments.find_one({"_id": ObjectId(dept_id)}, {"name": 1})
                dept_name = dept.get("name", "Unknown") if dept else "Unknown"
                rag_context += f"\n[Document {i}: {doc_name} - {dept_name}]\n{chunk_text}\n"
            except Exception:
                rag_context += f"\n[Document {i}: {doc_name}]\n{chunk_text}\n"
        else:
            rag_context += f"\n[Document {i}: {doc_name}]\n{chunk_text}\n"
    rag_context += "\n=== End of Context ===\nUse the above when relevant to answer accurately; cite the document name when applicable."
    return rag_context


async def _get_application_context(current_user: UserInDB) -> str:
    """Build a summary of application data (departments, users, checklist, etc.) for the chatbot. Scoped by role."""
    is_admin = current_user.role == Role.ADMIN
    department_id = str(current_user.department_id) if getattr(current_user, "department_id", None) else None

    lines = ["=== Application context (use to answer questions about this compliance portal) ==="]

    try:
        # Departments
        if is_admin:
            depts = await db.departments.find({}, {"name": 1}).sort("name", 1).to_list(length=500)
            dept_names = [d.get("name", "") for d in depts if d.get("name")]
            lines.append(f"Departments: {len(depts)} total. Names: {', '.join(dept_names) if dept_names else 'None'}.")
        else:
            if department_id:
                dept = await db.departments.find_one({"_id": ObjectId(department_id)}, {"name": 1})
                lines.append(f"Current user's department: {dept.get('name', 'Unknown')} (user is in this department).")
            else:
                lines.append("Current user has no department assigned.")

        # Users
        if is_admin:
            user_count = await db.users.count_documents({})
            admin_count = await db.users.count_documents({"role": "admin"})
            lines.append(f"Users: {user_count} total ({admin_count} admin, {user_count - admin_count} regular).")
        else:
            if department_id:
                dept_user_count = await db.users.count_documents({"department_id": ObjectId(department_id)})
                lines.append(f"Users in your department: {dept_user_count}.")

        # Compliance frameworks
        frameworks = await db.compliance_frameworks.find({}, {"name": 1, "is_active": 1}).sort("name", 1).to_list(length=100)
        framework_names = [f.get("name", "") for f in frameworks if f.get("name")]
        active_count = sum(1 for f in frameworks if f.get("is_active", True))
        lines.append(f"Compliance frameworks: {len(frameworks)} total ({active_count} active). Names: {', '.join(framework_names) if framework_names else 'None'}.")

        # ISO controls (checklist / control management)
        if is_admin:
            controls_count = await db.iso_controls.count_documents({})
            questions_count = await db.questions.count_documents({})
            lines.append(f"ISO controls (Control Management): {controls_count} controls, {questions_count} questions in total.")
        else:
            # User's controls: by department and/or frameworks their department uses
            query = {}
            if department_id:
                query["department_id"] = ObjectId(department_id)
            controls_count = await db.iso_controls.count_documents(query)
            control_ids = await db.iso_controls.find(query, {"_id": 1}).distinct("_id")
            questions_count = await db.questions.count_documents({"iso_control_id": {"$in": control_ids}}) if control_ids else 0
            lines.append(f"ISO controls relevant to your department: {controls_count} controls, {questions_count} questions (checklist).")

        # Checklist progress for current user (control and question responses)
        user_id = getattr(current_user, "id", None) or getattr(current_user, "_id", None)
        if user_id is not None:
            try:
                uid = ObjectId(str(user_id)) if not isinstance(user_id, ObjectId) else user_id
                control_responses_count = await db.control_responses.count_documents({"user_id": uid})
                question_responses_count = await db.responses.count_documents({"user_id": uid})
                lines.append(f"Current user's checklist progress: {control_responses_count} control-level responses (Yes/No), {question_responses_count} question-level responses submitted.")
            except Exception:
                pass

        # RAG documents summary (optional)
        if is_admin:
            try:
                rag_docs = await db.rag_documents.count_documents({})
                local_vd_docs = await db.local_vd_documents.count_documents({})
                lines.append(f"Documents: {rag_docs} in RAG (Pinecone), {local_vd_docs} in Local VD (ChromaDB).")
            except Exception:
                pass

        lines.append("=== End of application context === Use the above numbers and names when the user asks about departments, users, checklist, controls, frameworks, or document counts. Be concise.")
        return "\n".join(lines)
    except Exception as e:
        print(f"[OpenAI Chat] Application context error: {e}")
        return ""


@router.post("/openai", response_model=ChatResponse)
async def chat_openai(
    body: ChatRequest,
    current_user: UserInDB = Depends(get_current_active_user),
):
    """Send a message to OpenAI and return the assistant reply. Uses Pinecone RAG for context. Requires auth."""
    api_key = _get_openai_key()
    if not api_key or not api_key.strip():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OpenAI API key not configured. Set OPENAI_API_KEY in backend/.env",
        )
    try:
        from openai import OpenAI
    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OpenAI package not installed. Run: pip install openai",
        )
    client = OpenAI(api_key=api_key.strip())
    model_name = _get_openai_model()

    # Application context (departments, users, checklist, etc.)
    app_context = await _get_application_context(current_user)
    # RAG context from Pinecone or ChromaDB
    rag_context = await _get_rag_context(body.message, current_user)
    system_content = _get_system_prompt()
    if app_context:
        system_content = f"{system_content}\n\n{app_context}"
    if rag_context:
        system_content = f"{system_content}\n\n{rag_context}"

    # Build messages: system + history + new user message (with optional image for vision)
    messages = [{"role": "system", "content": system_content}]
    if body.messages:
        for m in body.messages:
            messages.append({"role": m.role, "content": m.content})
    if body.image_base64 and body.image_base64.strip():
        # Vision: send text + image (model must support vision, e.g. gpt-4o-mini)
        user_content = [
            {"type": "text", "text": body.message or "(See image)"},
            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{body.image_base64.strip()}"}},
        ]
        messages.append({"role": "user", "content": user_content})
    else:
        messages.append({"role": "user", "content": body.message})

    try:
        resp = client.chat.completions.create(
            model=model_name,
            messages=messages,
            max_tokens=1024,
        )
        reply = resp.choices[0].message.content if resp.choices else ""
        return ChatResponse(reply=reply or "", model=resp.model or model_name)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"OpenAI request failed: {str(e)}",
        )
