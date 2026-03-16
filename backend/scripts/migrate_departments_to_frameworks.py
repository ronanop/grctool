#!/usr/bin/env python3
"""
Migration script to add compliance_framework_ids to existing departments
Run this script to update existing departments with empty framework arrays
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

async def migrate_departments():
    """Add compliance_framework_ids field to existing departments"""
    print("=" * 60)
    print("Department Compliance Framework Migration")
    print("=" * 60)
    
    try:
        client = AsyncIOMotorClient(MONGODB_URI)
        db = client[DATABASE_NAME]
        
        # Test connection
        await client.admin.command('ping')
        print("✓ Connected to MongoDB\n")
        
        # Get default ISO 27001 framework (if exists)
        default_framework = await db.compliance_frameworks.find_one({"name": "ISO 27001"})
        default_framework_id = default_framework["_id"] if default_framework else None
        
        # Find all departments without compliance_framework_ids
        departments = await db.departments.find({"compliance_framework_ids": {"$exists": False}}).to_list(length=1000)
        
        if not departments:
            print("✓ All departments already have compliance_framework_ids field")
            return
        
        print(f"Found {len(departments)} departments without compliance_framework_ids\n")
        
        updated = 0
        for dept in departments:
            # If default framework exists, assign it to existing departments
            # Otherwise, leave empty array (admin can assign later)
            framework_ids = [default_framework_id] if default_framework_id else []
            
            await db.departments.update_one(
                {"_id": dept["_id"]},
                {"$set": {"compliance_framework_ids": framework_ids}}
            )
            
            framework_info = f" (assigned to ISO 27001)" if default_framework_id else " (no frameworks assigned)"
            print(f"✓ Updated department: {dept.get('name', 'Unknown')}{framework_info}")
            updated += 1
        
        print(f"\n✓ Migration completed successfully!")
        print(f"  - Updated {updated} department(s)")
        if default_framework_id:
            print(f"  - Assigned existing departments to ISO 27001 framework")
        else:
            print(f"  - No default framework found - departments left unassigned")
            print(f"  - You can assign frameworks via the admin panel")
        
        print("=" * 60)
        
    except Exception as e:
        print(f"\n✗ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(migrate_departments())
