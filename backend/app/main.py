from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from app.database import init_db
from app.routers import auth, admin, user, rag, openai_chat, chatbot_settings, local_vd
from app.exceptions import (
    validation_exception_handler,
    http_exception_handler,
    general_exception_handler
)

app = FastAPI(title="ISO 27001 Compliance Portal API", version="1.0.0")

# CORS Configuration - MUST be added before exception handlers
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception handlers - order matters, most specific first
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, general_exception_handler)

# Initialize database on startup
@app.on_event("startup")
async def startup_event():
    await init_db()

# Include routers
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["Admin"])
app.include_router(user.router, prefix="/api/v1/user", tags=["User"])
app.include_router(rag.router, prefix="/api/v1/rag", tags=["RAG"])
app.include_router(local_vd.router, prefix="/api/v1/local-vd", tags=["Local VD"])
app.include_router(openai_chat.router, prefix="/api/v1/chat", tags=["Chat"])
app.include_router(chatbot_settings.router, prefix="/api/v1/chatbot-settings", tags=["Chatbot Settings"])

@app.get("/")
async def root():
    return {"message": "ISO 27001 Compliance Portal API"}

