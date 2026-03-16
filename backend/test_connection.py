"""
Quick test script to verify MongoDB connection
"""
import asyncio
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load .env file from backend directory
backend_dir = Path(__file__).parent
env_path = backend_dir / ".env"
load_dotenv(dotenv_path=env_path)

async def test_connection():
    try:
        from app.database import client, db
        
        # Test connection
        await client.admin.command('ping')
        print("[SUCCESS] Successfully connected to MongoDB!")
        
        # Get database info
        db_name = db.name
        print(f"[SUCCESS] Connected to database: {db_name}")
        
        # List collections
        collections = await db.list_collection_names()
        print(f"[SUCCESS] Collections in database: {collections if collections else 'None (database is empty)'}")
        
        return True
    except Exception as e:
        print(f"[ERROR] Connection failed: {str(e)}")
        return False

if __name__ == "__main__":
    success = asyncio.run(test_connection())
    sys.exit(0 if success else 1)

