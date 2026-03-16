"""
Chatbot (OpenAI) settings: visibility, title, model. Stored in backend/.env.
"""
import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, status
from pydantic import BaseModel

from app.auth import get_current_active_user, require_role
from app.models import UserInDB, Role

_backend_dir = Path(__file__).resolve().parent.parent.parent
_env_path = _backend_dir / ".env"
load_dotenv(dotenv_path=_env_path)

router = APIRouter()
admin_only = require_role([Role.ADMIN])


def _read_env_dict() -> dict:
    out = {}
    if _env_path.is_file():
        with open(_env_path, "r", encoding="utf-8", errors="replace") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, value = line.split("=", 1)
                    out[key.strip()] = value.strip()
    return out


def _write_env(env_vars: dict) -> None:
    with open(_env_path, "w", encoding="utf-8") as f:
        for key, value in env_vars.items():
            f.write(f"{key}={value}\n")


def _get_chatbot_enabled() -> bool:
    return os.getenv("CHATBOT_ENABLED", "true").lower() in ("true", "1", "yes")


def _get_chatbot_title() -> str:
    return (os.getenv("CHATBOT_TITLE") or "Assistant").strip() or "Assistant"


def _get_chat_model() -> str:
    return os.getenv("OPENAI_CHAT_MODEL", "gpt-4o-mini").strip() or "gpt-4o-mini"


def _get_chatbot_custom_instructions() -> str:
    raw = (os.getenv("CHATBOT_CUSTOM_INSTRUCTIONS") or "").strip()
    return raw.replace("\\n", "\n")


def _set_chatbot_custom_instructions(value: str) -> str:
    """Normalize for .env: newlines stored as literal \\n."""
    if not value:
        return ""
    return (value.strip().replace("\r\n", "\n").replace("\n", "\\n"))


def _get_chatbot_vector_db() -> str:
    """Which vector DB the chatbot uses for RAG: pinecone | local."""
    v = (os.getenv("CHATBOT_VECTOR_DB") or "pinecone").strip().lower()
    return v if v in ("pinecone", "local") else "pinecone"


class ChatbotConfigOut(BaseModel):
    enabled: bool
    title: str


class ChatbotSettingsOut(BaseModel):
    enabled: bool
    title: str
    model: str
    custom_instructions: str
    vector_db: str  # "pinecone" | "local"


class ChatbotSettingsUpdate(BaseModel):
    enabled: Optional[bool] = None
    title: Optional[str] = None
    model: Optional[str] = None
    custom_instructions: Optional[str] = None
    vector_db: Optional[str] = None


@router.get("/config", response_model=ChatbotConfigOut)
async def get_chatbot_config(
    current_user: UserInDB = Depends(get_current_active_user),
):
    """Public config for Layout/Chatbot: enabled and title (no secrets)."""
    load_dotenv(dotenv_path=_env_path, override=True)
    return ChatbotConfigOut(
        enabled=_get_chatbot_enabled(),
        title=_get_chatbot_title(),
    )


@router.get("/settings", response_model=ChatbotSettingsOut)
async def get_chatbot_settings(
    current_user: UserInDB = Depends(admin_only),
):
    """Admin: full chatbot settings (enabled, title, model)."""
    load_dotenv(dotenv_path=_env_path, override=True)
    return ChatbotSettingsOut(
        enabled=_get_chatbot_enabled(),
        title=_get_chatbot_title(),
        model=_get_chat_model(),
        custom_instructions=_get_chatbot_custom_instructions(),
        vector_db=_get_chatbot_vector_db(),
    )


@router.put("/settings", response_model=ChatbotSettingsOut)
async def update_chatbot_settings(
    body: ChatbotSettingsUpdate,
    current_user: UserInDB = Depends(admin_only),
):
    """Admin: update chatbot settings and persist to .env."""
    load_dotenv(dotenv_path=_env_path, override=True)
    env_vars = _read_env_dict()  # preserve all existing .env keys

    if body.enabled is not None:
        env_vars["CHATBOT_ENABLED"] = str(body.enabled).lower()
    if body.title is not None:
        env_vars["CHATBOT_TITLE"] = str(body.title).strip() or "Assistant"
    if body.model is not None:
        env_vars["OPENAI_CHAT_MODEL"] = str(body.model).strip() or "gpt-4o-mini"
    if body.custom_instructions is not None:
        env_vars["CHATBOT_CUSTOM_INSTRUCTIONS"] = _set_chatbot_custom_instructions(body.custom_instructions)
    if body.vector_db is not None:
        v = body.vector_db.strip().lower()
        env_vars["CHATBOT_VECTOR_DB"] = v if v in ("pinecone", "local") else "pinecone"

    _write_env(env_vars)
    load_dotenv(dotenv_path=_env_path, override=True)

    return ChatbotSettingsOut(
        enabled=_get_chatbot_enabled(),
        title=_get_chatbot_title(),
        model=_get_chat_model(),
        custom_instructions=_get_chatbot_custom_instructions(),
        vector_db=_get_chatbot_vector_db(),
    )
