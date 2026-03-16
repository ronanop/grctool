"""
Script to create the chatbot agent
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
from bson import ObjectId

async def create_chatbot_agent():
    agent_name = "Chatbot"
    
    # Check if chatbot agent already exists
    existing = await db.agents.find_one({"name": {"$regex": agent_name, "$options": "i"}})
    if existing:
        print(f"[INFO] Chatbot agent already exists!")
        print(f"   ID: {existing.get('_id')}")
        print(f"   Name: {existing.get('name')}")
        print(f"   Status: {existing.get('status')}")
        return
    
    # Create chatbot agent
    agent_dict = {
        "name": agent_name,
        "description": "AI-powered compliance assistant chatbot with RAG capabilities",
        "department_id": None,  # Global agent
        "status": "active",
        "created_by": None,  # System-created
        "created_at": None,
        "updated_at": None
    }
    
    result = await db.agents.insert_one(agent_dict)
    print(f"[SUCCESS] Chatbot agent created successfully!")
    print(f"   Agent ID: {result.inserted_id}")
    print(f"   Name: {agent_name}")
    print(f"   Description: {agent_dict['description']}")
    print(f"\nYou can now configure the chatbot by clicking on this agent in the Agents page.")

if __name__ == "__main__":
    asyncio.run(create_chatbot_agent())
