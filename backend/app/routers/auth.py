from datetime import timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Header
from fastapi.security import OAuth2PasswordRequestForm
from app.auth import authenticate_user, create_access_token, get_current_active_user, get_current_user_optional, get_password_hash, ACCESS_TOKEN_EXPIRE_MINUTES
from app.database import db
from app.models import UserCreate, UserResponse, Token, UserInDB, Role
from bson import ObjectId

router = APIRouter()

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate, authorization: Optional[str] = Header(None)):
    """Register a new user (Admin only, or first admin without auth)"""
    from app.database import db
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"Registering user: username={user_data.username}, is_senior={user_data.is_senior}")
    
    # Check if any admin exists
    admin_count = await db.users.count_documents({"role": "admin"})
    
    # If no admin exists and user is trying to create an admin, allow it
    if admin_count == 0 and user_data.role == Role.ADMIN:
        # Allow first admin creation without authentication
        pass
    else:
        # Require authentication for subsequent user creation
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required"
            )
        token = authorization.replace("Bearer ", "")
        current_user = await get_current_user_optional(token)
        if not current_user or current_user.role != Role.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admins can create users"
            )
    
    # Check if user exists
    existing_user = await db.users.find_one({"username": user_data.username})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists"
        )
    
    # Validate department if provided
    if user_data.department_id:
        department = await db.departments.find_one({"_id": ObjectId(user_data.department_id)})
        if not department:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Department not found"
            )
    
    # Create user
    # Ensure is_senior is properly set (explicitly check for True, default to False)
    is_senior_value = False
    if hasattr(user_data, 'is_senior'):
        if user_data.is_senior is True:
            is_senior_value = True
        elif user_data.is_senior is not None:
            # Handle string "true" or other truthy values
            is_senior_value = bool(user_data.is_senior)
    
    print(f"DEBUG: Registering user {user_data.username}, is_senior from model: {user_data.is_senior}, setting to: {is_senior_value}")
    
    user_dict = {
        "username": user_data.username,
        "password_hash": get_password_hash(user_data.password),
        "role": user_data.role.value,
        "department_id": ObjectId(user_data.department_id) if user_data.department_id else None,
        "is_senior": is_senior_value
    }
    
    print(f"DEBUG: User dict before insert: {user_dict}")
    
    result = await db.users.insert_one(user_dict)
    user_dict["_id"] = result.inserted_id
    
    # Verify the saved user
    saved_user = await db.users.find_one({"_id": result.inserted_id})
    print(f"DEBUG: Saved user from DB: is_senior={saved_user.get('is_senior', 'NOT FOUND')}")
    
    return UserResponse(**user_dict)

@router.post("/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """Login endpoint - returns token and user info"""
    user = await authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role.value}, expires_delta=access_token_expires
    )
    # Return token and user info together to avoid extra API call
    # Convert UserInDB to UserResponse (excludes password_hash)
    user_dict = user.dict()
    user_dict.pop('password_hash', None)  # Remove password hash
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": UserResponse(**user_dict)
    }

@router.get("/me", response_model=UserResponse)
async def read_users_me(current_user: UserInDB = Depends(get_current_active_user)):
    """Get current user information"""
    return current_user

