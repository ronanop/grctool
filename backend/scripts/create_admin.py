"""
Script to create the first admin user.
Run this script to initialize the first admin account.
"""
import asyncio
import sys
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file from backend directory
backend_dir = Path(__file__).parent.parent
env_path = backend_dir / ".env"
load_dotenv(dotenv_path=env_path)

# Add parent directory to path
sys.path.insert(0, str(backend_dir))

from app.database import db
from app.auth import get_password_hash
from bson import ObjectId

async def create_admin():
    username = input("Enter admin username (default: admin): ").strip() or "admin"
    password = input("Enter admin password (default: admin123): ").strip() or "admin123"
    
    # Check if user already exists
    existing = await db.users.find_one({"username": username})
    if existing:
        print(f"[ERROR] User '{username}' already exists!")
        return
    
    # Create admin user
    user_dict = {
        "username": username,
        "password_hash": get_password_hash(password),
        "role": "admin",
        "department_id": None
    }
    
    result = await db.users.insert_one(user_dict)
    print(f"[SUCCESS] Admin user '{username}' created successfully!")
    print(f"   User ID: {result.inserted_id}")
    print(f"   Please change the default password after first login.")

if __name__ == "__main__":
    asyncio.run(create_admin())

