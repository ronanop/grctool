import os
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import ConnectionFailure
from dotenv import load_dotenv

# Load .env file from backend directory
backend_dir = Path(__file__).parent.parent
env_path = backend_dir / ".env"
load_dotenv(dotenv_path=env_path)

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/iso27001_compliance")
DATABASE_NAME = "iso27001_compliance"

client = AsyncIOMotorClient(MONGODB_URI)
db = client[DATABASE_NAME]

async def init_db():
    """Initialize database with indexes"""
    try:
        # Test connection
        await client.admin.command('ping')
        print("✅ Connected to MongoDB")
        
        # Create indexes
        await db.users.create_index("username", unique=True)
        await db.departments.create_index("name", unique=True)
        
        # Compliance frameworks indexes
        try:
            await db.compliance_frameworks.create_index("name", unique=True)
            await db.compliance_frameworks.create_index("is_active")
        except:
            pass  # Collection might not exist yet
        
        # ISO controls indexes - updated for multi-compliance
        await db.iso_controls.create_index("department_id")
        await db.iso_controls.create_index("compliance_framework_id")
        # Try to create new unique index, drop old one if exists
        try:
            await db.iso_controls.drop_index([("department_id", 1), ("control_id", 1)])
        except:
            pass  # Old index might not exist
        try:
            await db.iso_controls.create_index(
                [("department_id", 1), ("compliance_framework_id", 1), ("control_id", 1)], 
                unique=True,
                name="department_framework_control_unique"
            )
        except:
            pass  # Index might already exist
        
        await db.questions.create_index("iso_control_id")
        await db.questions.create_index("compliance_framework_id")
        # Migrate existing questions to have question_ids
        try:
            from bson import ObjectId
            
            # Get all questions without question_id, grouped by iso_control_id
            questions_without_id = await db.questions.find({
                "$or": [
                    {"question_id": {"$exists": False}},
                    {"question_id": None}
                ]
            }).to_list(length=10000)
            
            # Group by iso_control_id
            from collections import defaultdict
            questions_by_control = defaultdict(list)
            for q in questions_without_id:
                iso_control_id = q.get("iso_control_id")
                if iso_control_id:
                    questions_by_control[str(iso_control_id)].append(q)
            
            # Process each control
            for iso_control_id_str, questions_list in questions_by_control.items():
                iso_control_id_obj = ObjectId(iso_control_id_str)
                
                # Get existing questions with question_ids for this control
                existing_questions = await db.questions.find({
                    "iso_control_id": iso_control_id_obj,
                    "question_id": {"$exists": True, "$ne": None}
                }).sort("question_id", 1).to_list(length=1000)
                
                # Generate next question_id
                def get_next_question_id(existing_ids):
                    if not existing_ids:
                        return "a"
                    last_id = existing_ids[-1].get("question_id", "")
                    if not last_id:
                        return "a"
                    last_id = last_id.lower()
                    if len(last_id) == 1 and last_id.isalpha():
                        if last_id == "z":
                            return "aa"
                        return chr(ord(last_id) + 1)
                    if len(last_id) == 2 and last_id.isalpha():
                        if last_id == "zz":
                            return "aaa"
                        first_char = last_id[0]
                        second_char = last_id[1]
                        if second_char == "z":
                            return chr(ord(first_char) + 1) + "a"
                        return first_char + chr(ord(second_char) + 1)
                    return last_id[:-1] + chr(ord(last_id[-1]) + 1) if last_id[-1] != "z" else last_id + "a"
                
                existing_ids = [{"question_id": q.get("question_id", "")} for q in existing_questions]
                current_id = get_next_question_id(existing_ids)
                
                # Assign question_ids to questions without them
                for question in questions_list:
                    await db.questions.update_one(
                        {"_id": question["_id"]},
                        {"$set": {"question_id": current_id}}
                    )
                    # Move to next ID
                    existing_ids.append({"question_id": current_id})
                    current_id = get_next_question_id(existing_ids)
            
            # Create unique index (only applies to non-null question_ids)
            # First, try to drop existing indexes with conflicting names
            try:
                indexes = await db.questions.list_indexes().to_list(length=100)
                for idx in indexes:
                    idx_name = idx.get("name", "")
                    # Drop any index that matches our target index pattern
                    if "iso_control_id_1_question_id_1" in idx_name:
                        try:
                            await db.questions.drop_index(idx_name)
                        except:
                            pass
            except:
                pass  # If listing fails, try to drop by common name
            
            try:
                await db.questions.drop_index("iso_control_id_1_question_id_1")
            except:
                pass  # Index doesn't exist, that's fine
            
            try:
                # MongoDB doesn't support $ne: null in partial filter, use $exists and $type instead
                # Since we've migrated all questions to have question_id, we can use $type: "string"
                await db.questions.create_index(
                    [("iso_control_id", 1), ("question_id", 1)], 
                    unique=True,
                    name="iso_control_id_1_question_id_1_unique",
                    partialFilterExpression={"question_id": {"$exists": True, "$type": "string"}}
                )
            except Exception as idx_error:
                # If $type doesn't work, try with just $exists
                try:
                    await db.questions.create_index(
                        [("iso_control_id", 1), ("question_id", 1)], 
                        unique=True,
                        name="iso_control_id_1_question_id_1_unique",
                        partialFilterExpression={"question_id": {"$exists": True}}
                    )
                except Exception as idx_error2:
                    print(f"[WARNING] Could not create unique index: {idx_error2}")
                    # Try non-unique index as fallback
                    try:
                        await db.questions.create_index(
                            [("iso_control_id", 1), ("question_id", 1)],
                            name="iso_control_id_1_question_id_1"
                        )
                    except:
                        pass
            except Exception as idx_error:
                print(f"[WARNING] Could not create unique index: {idx_error}")
                # Try non-unique index as fallback
                try:
                    await db.questions.create_index([("iso_control_id", 1), ("question_id", 1)])
                except:
                    pass
        except Exception as e:
            print(f"[WARNING] Could not migrate question_ids: {e}")
            # Create non-unique index as fallback
            try:
                await db.questions.create_index([("iso_control_id", 1), ("question_id", 1)])
            except:
                pass
        await db.responses.create_index([("question_id", 1), ("user_id", 1)], unique=True)
        await db.responses.create_index("user_id")
        await db.control_responses.create_index([("iso_control_id", 1), ("user_id", 1)], unique=True)
        await db.control_responses.create_index("user_id")
        await db.policies.create_index("uploaded_by")
        await db.policies.create_index("uploaded_at")
        await db.policies.create_index("department_id")
        await db.agents.create_index("created_by")
        await db.agents.create_index("created_at")
        await db.agents.create_index("department_id")
        await db.agents.create_index("status")
        await db.rag_documents.create_index("department_id")
        await db.rag_documents.create_index("document_id", unique=True)
        await db.rag_documents.create_index("uploaded_at")
        await db.tasks.create_index("department_id")
        await db.tasks.create_index("created_by_user_id")
        await db.tasks.create_index("assigned_to_user_id")
        await db.tasks.create_index("status")
        await db.tasks.create_index("created_at")
        
        print("✅ Database indexes created")
    except ConnectionFailure:
        print("❌ Failed to connect to MongoDB")
        raise

