"""
Script to check database structure and collections
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

from app.database import db, client

async def check_database():
    print("=" * 60)
    print("DATABASE STRUCTURE CHECK")
    print("=" * 60)
    
    # Test connection
    try:
        await client.admin.command('ping')
        print("\n[SUCCESS] MongoDB connection successful!")
    except Exception as e:
        print(f"\n[ERROR] MongoDB connection failed: {e}")
        return
    
    # Get database name
    db_name = db.name
    print(f"\nDatabase Name: {db_name}")
    
    # List all collections
    print("\n" + "-" * 60)
    print("COLLECTIONS IN DATABASE:")
    print("-" * 60)
    
    collections = await db.list_collection_names()
    
    if not collections:
        print("[WARNING] No collections found in database!")
        print("The database appears to be empty.")
    else:
        print(f"\nFound {len(collections)} collection(s):")
        for i, coll_name in enumerate(sorted(collections), 1):
            count = await db[coll_name].count_documents({})
            print(f"  {i}. {coll_name}: {count} document(s)")
    
    # Check each expected collection
    print("\n" + "-" * 60)
    print("EXPECTED COLLECTIONS CHECK:")
    print("-" * 60)
    
    expected_collections = [
        "users",
        "departments",
        "compliance_frameworks",
        "iso_controls",
        "questions",
        "responses",
        "control_responses",
        "rag_documents",
        "policies",
        "agents",
        "tasks",
        "notifications"
    ]
    
    missing = []
    for coll_name in expected_collections:
        exists = coll_name in collections
        if exists:
            count = await db[coll_name].count_documents({})
            print(f"  [OK] {coll_name}: {count} document(s)")
        else:
            print(f"  [MISSING] {coll_name}: Collection does not exist")
            missing.append(coll_name)
    
    # Check users specifically
    print("\n" + "-" * 60)
    print("USERS CHECK:")
    print("-" * 60)
    
    if "users" in collections:
        users = await db.users.find({}).to_list(length=100)
        print(f"\nTotal users: {len(users)}")
        
        if users:
            print("\nUser list:")
            for user in users:
                username = user.get("username", "Unknown")
                role = user.get("role", "Unknown")
                dept_id = user.get("department_id")
                is_senior = user.get("is_senior", False)
                print(f"  - {username} (role: {role}, senior: {is_senior}, dept: {dept_id})")
        else:
            print("\n[WARNING] No users found in database!")
    else:
        print("\n[ERROR] Users collection does not exist!")
    
    # Check departments
    print("\n" + "-" * 60)
    print("DEPARTMENTS CHECK:")
    print("-" * 60)
    
    if "departments" in collections:
        departments = await db.departments.find({}).to_list(length=100)
        print(f"\nTotal departments: {len(departments)}")
        
        if departments:
            print("\nDepartment list:")
            for dept in departments:
                name = dept.get("name", "Unknown")
                dept_id = dept.get("_id")
                frameworks = dept.get("compliance_framework_ids", [])
                print(f"  - {name} (ID: {dept_id}, frameworks: {len(frameworks)})")
        else:
            print("\n[WARNING] No departments found in database!")
    else:
        print("\n[WARNING] Departments collection does not exist!")
    
    # Check indexes
    print("\n" + "-" * 60)
    print("INDEXES CHECK:")
    print("-" * 60)
    
    for coll_name in collections:
        indexes = await db[coll_name].list_indexes().to_list(length=100)
        if indexes:
            print(f"\n{coll_name} indexes:")
            for idx in indexes:
                idx_name = idx.get("name", "Unknown")
                keys = idx.get("key", {})
                unique = idx.get("unique", False)
                unique_str = " (UNIQUE)" if unique else ""
                print(f"  - {idx_name}: {keys}{unique_str}")
    
    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY:")
    print("=" * 60)
    
    if missing:
        print(f"\n[WARNING] Missing collections: {', '.join(missing)}")
        print("These collections will be created automatically when first used.")
    else:
        print("\n[SUCCESS] All expected collections exist!")
    
    if "users" in collections:
        user_count = await db.users.count_documents({})
        admin_count = await db.users.count_documents({"role": "admin"})
        if user_count == 0:
            print("\n[WARNING] No users in database! You need to create at least one admin user.")
        elif admin_count == 0:
            print("\n[WARNING] No admin users found! You need to create an admin user.")
        else:
            print(f"\n[OK] Found {user_count} user(s), including {admin_count} admin(s).")
    
    print("\n" + "=" * 60)

if __name__ == "__main__":
    asyncio.run(check_database())
