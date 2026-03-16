"""
Quick test to verify local MongoDB connection
"""
import asyncio
import sys
from pathlib import Path
from dotenv import load_dotenv
import os

# Load .env file
backend_dir = Path(__file__).parent
env_path = backend_dir / ".env"
load_dotenv(dotenv_path=env_path)

async def test_mongodb():
    try:
        from motor.motor_asyncio import AsyncIOMotorClient
        
        mongodb_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017/iso27001_compliance")
        print(f"Testing MongoDB connection...")
        print(f"MONGODB_URI: {mongodb_uri}")
        print()
        
        client = AsyncIOMotorClient(mongodb_uri)
        
        # Test connection
        result = await client.admin.command('ping')
        print("[SUCCESS] MongoDB connection successful!")
        print(f"Response: {result}")
        print()
        
        # Check if it's local
        if "localhost" in mongodb_uri or "127.0.0.1" in mongodb_uri:
            print("[SUCCESS] Using LOCAL MongoDB (offline mode)")
        elif "mongodb+srv://" in mongodb_uri or ".mongodb.net" in mongodb_uri:
            print("[WARNING] Using MongoDB Atlas (cloud) - requires internet!")
        else:
            print("[INFO] Using custom MongoDB URI")
        
        # List databases
        db_list = await client.list_database_names()
        print(f"\nAvailable databases: {db_list}")
        
        # Check our database
        db_name = "iso27001_compliance"
        if db_name in db_list:
            print(f"[SUCCESS] Database '{db_name}' exists")
        else:
            print(f"[INFO] Database '{db_name}' will be created on first use")
        
        client.close()
        return True
        
    except Exception as e:
        print(f"[ERROR] MongoDB connection failed: {str(e)}")
        print()
        print("Troubleshooting:")
        print("1. Make sure MongoDB is running locally")
        print("2. Check if MongoDB service is started (Windows: services.msc)")
        print("3. Verify MONGODB_URI in .env file is: mongodb://localhost:27017/iso27001_compliance")
        return False

if __name__ == "__main__":
    success = asyncio.run(test_mongodb())
    sys.exit(0 if success else 1)

