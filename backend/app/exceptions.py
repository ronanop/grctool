from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi import HTTPException
from pymongo.errors import DuplicateKeyError
import traceback

async def validation_exception_handler(request: Request, exc: RequestValidationError):
    # Convert errors to serializable format
    errors = []
    for error in exc.errors():
        error_dict = {
            "type": error.get("type"),
            "loc": error.get("loc"),
            "msg": error.get("msg"),
            "input": str(error.get("input")) if error.get("input") is not None else None,
        }
        # Handle ctx if it exists
        if "ctx" in error:
            ctx = error["ctx"]
            error_dict["ctx"] = {}
            for key, value in ctx.items():
                error_dict["ctx"][key] = str(value) if value is not None else None
        errors.append(error_dict)
    
    response = JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": errors},
    )
    # Ensure CORS headers are included
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    return response

async def duplicate_key_exception_handler(request: Request, exc: DuplicateKeyError):
    response = JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"detail": "Duplicate key error: A record with this value already exists"},
    )
    # Ensure CORS headers are included
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    return response

async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions with CORS headers"""
    response = JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=exc.headers or {}
    )
    # Ensure CORS headers are included
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    return response

async def general_exception_handler(request: Request, exc: Exception):
    """Handle all other exceptions with CORS headers"""
    print(f"Unhandled exception: {exc}")
    traceback.print_exc()
    response = JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"},
    )
    # Ensure CORS headers are included
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    return response

