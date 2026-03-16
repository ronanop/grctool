"""
Script to create an admin user
"""
import asyncio
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load .env file
backend_dir = Path(__file__).parent
env_path = backend_dir / ".env"
load_dotenv(dotenv_path=env_path)

sys.path.insert(0, str(backend_dir))

from app.database import db
from app.auth import get_password_hash

async def create_admin():
    username = "admin"
    password = "admin123"  # Default password - change after first login
    
    # Check if admin already exists
    existing = await db.users.find_one({"username": username})
    if existing:
        print(f"[WARNING] User '{username}' already exists!")
        print(f"   Role: {existing.get('role')}")
        print(f"   User ID: {existing.get('_id')}")
        
        # Check if it's an admin
        if existing.get('role') == 'admin':
            print(f"\n[INFO] Admin user already exists. If you can't login:")
            print(f"   1. The password might be different")
            print(f"   2. Try resetting the password")
            return
        else:
            print(f"\n[WARNING] User exists but is not an admin. Updating to admin...")
            await db.users.update_one(
                {"username": username},
                {"$set": {"role": "admin"}}
            )
            print(f"[SUCCESS] User '{username}' updated to admin role!")
            return
    
    # Create admin user
    user_dict = {
        "username": username,
        "password_hash": get_password_hash(password),
        "role": "admin",
        "department_id": None,
        "is_senior": False
    }
    
    result = await db.users.insert_one(user_dict)
    print(f"\n[SUCCESS] Admin user '{username}' created successfully!")
    print(f"   User ID: {result.inserted_id}")
    print(f"   Username: {username}")
    print(f"   Password: {password}")
    print(f"   Role: admin")
    print(f"\n[WARNING] Please change the password after first login!")
    print(f"\nLogin credentials:")
    print(f"   Username: {username}")
    print(f"   Password: {password}")

if __name__ == "__main__":
    asyncio.run(create_admin())
