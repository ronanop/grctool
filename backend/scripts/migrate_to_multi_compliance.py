#!/usr/bin/env python3
"""
Migration script to add multi-compliance framework support
Run this script BEFORE deploying the updated code
"""
import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
from dotenv import load_dotenv
import os

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/iso27001_compliance")
DATABASE_NAME = os.getenv("DATABASE_NAME", "iso27001_compliance")

async def create_default_framework(db):
    """Create default ISO 27001 compliance framework"""
    print("Step 1: Creating default ISO 27001 framework...")
    
    # Check if default framework exists
    existing = await db.compliance_frameworks.find_one({"name": "ISO 27001"})
    if existing:
        print(f"✓ Default framework already exists: {existing['_id']}")
        return existing["_id"]
    
    # Create default framework
    framework = {
        "name": "ISO 27001",
        "description": "Information Security Management System",
        "version": "2022",
        "is_active": True,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    result = await db.compliance_frameworks.insert_one(framework)
    print(f"✓ Created default framework: {result.inserted_id}")
    return result.inserted_id

async def migrate_iso_controls(db, framework_id):
    """Migrate existing ISO controls to include compliance_framework_id"""
    print("\nStep 2: Migrating ISO controls...")
    
    result = await db.iso_controls.update_many(
        {"compliance_framework_id": {"$exists": False}},
        {"$set": {"compliance_framework_id": framework_id}}
    )
    print(f"✓ Updated {result.modified_count} ISO controls")
    return result.modified_count

async def migrate_questions(db):
    """Migrate existing questions to include compliance_framework_id"""
    print("\nStep 3: Migrating questions...")
    
    questions = await db.questions.find({"compliance_framework_id": {"$exists": False}}).to_list(length=10000)
    updated = 0
    
    for question in questions:
        control = await db.iso_controls.find_one({"_id": question["iso_control_id"]})
        if control and control.get("compliance_framework_id"):
            await db.questions.update_one(
                {"_id": question["_id"]},
                {"$set": {"compliance_framework_id": control["compliance_framework_id"]}}
            )
            updated += 1
    
    print(f"✓ Updated {updated} questions")
    return updated

async def update_indexes(db):
    """Update database indexes"""
    print("\nStep 4: Updating database indexes...")
    
    # Drop old unique index if it exists
    try:
        await db.iso_controls.drop_index([("department_id", 1), ("control_id", 1)])
        print("✓ Dropped old index")
    except Exception as e:
        print(f"  (Old index not found or already dropped: {e})")
    
    # Create new unique index
    try:
        await db.iso_controls.create_index(
            [("department_id", 1), ("compliance_framework_id", 1), ("control_id", 1)],
            unique=True,
            name="department_framework_control_unique"
        )
        print("✓ Created new unique index on iso_controls")
    except Exception as e:
        print(f"  (Index may already exist: {e})")
    
    # Create indexes for compliance_framework_id
    try:
        await db.iso_controls.create_index("compliance_framework_id")
        print("✓ Created index on iso_controls.compliance_framework_id")
    except Exception as e:
        print(f"  (Index may already exist: {e})")
    
    try:
        await db.questions.create_index("compliance_framework_id")
        print("✓ Created index on questions.compliance_framework_id")
    except Exception as e:
        print(f"  (Index may already exist: {e})")
    
    try:
        await db.compliance_frameworks.create_index("name", unique=True)
        print("✓ Created unique index on compliance_frameworks.name")
    except Exception as e:
        print(f"  (Index may already exist: {e})")

async def verify_migration(db):
    """Verify migration was successful"""
    print("\nStep 5: Verifying migration...")
    
    # Check for controls without framework_id
    controls_without = await db.iso_controls.count_documents({"compliance_framework_id": {"$exists": False}})
    if controls_without > 0:
        print(f"⚠ WARNING: {controls_without} controls still missing compliance_framework_id")
        return False
    
    # Check for questions without framework_id
    questions_without = await db.questions.count_documents({"compliance_framework_id": {"$exists": False}})
    if questions_without > 0:
        print(f"⚠ WARNING: {questions_without} questions still missing compliance_framework_id")
        return False
    
    print("✓ All controls and questions have compliance_framework_id")
    return True

async def main():
    """Run migration"""
    print("=" * 60)
    print("Multi-Compliance Framework Migration")
    print("=" * 60)
    
    try:
        client = AsyncIOMotorClient(MONGODB_URI)
        db = client[DATABASE_NAME]
        
        # Test connection
        await client.admin.command('ping')
        print("✓ Connected to MongoDB\n")
        
        # Run migration steps
        framework_id = await create_default_framework(db)
        await migrate_iso_controls(db, framework_id)
        await migrate_questions(db)
        await update_indexes(db)
        success = await verify_migration(db)
        
        print("\n" + "=" * 60)
        if success:
            print("✓ Migration completed successfully!")
            print("\nYou can now deploy the updated application code.")
        else:
            print("⚠ Migration completed with warnings.")
            print("Please review the warnings above before deploying.")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n✗ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(main())
