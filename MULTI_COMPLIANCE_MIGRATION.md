# Multi-Compliance Framework Migration Guide

## Overview
This document outlines the changes needed to make the application support multiple compliance frameworks (ISO 27001, SOC 2, GDPR, HIPAA, etc.) instead of just ISO 27001.

## Database Schema Changes

### New Collection: `compliance_frameworks`
```javascript
{
  _id: ObjectId,
  name: "ISO 27001",  // or "SOC 2", "GDPR", "HIPAA", etc.
  description: "Information Security Management System",
  version: "2022",  // optional
  is_active: true,
  created_at: ISODate,
  updated_at: ISODate
}
```

### Updated Collection: `iso_controls`
**New Field Required:**
- `compliance_framework_id`: ObjectId (references compliance_frameworks)

**Index Update:**
- Change unique index from `[("department_id", 1), ("control_id", 1)]` 
- To: `[("department_id", 1), ("compliance_framework_id", 1), ("control_id", 1)]`

### Updated Collection: `questions`
**New Field Required:**
- `compliance_framework_id`: ObjectId (references compliance_frameworks)

## Migration Steps

### Step 1: Create Default Compliance Framework
Before running the application, create a default "ISO 27001" compliance framework:

```python
# Run this script once
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime

async def create_default_framework():
    client = AsyncIOMotorClient("mongodb://localhost:27017/iso27001_compliance")
    db = client["iso27001_compliance"]
    
    # Check if default framework exists
    existing = await db.compliance_frameworks.find_one({"name": "ISO 27001"})
    if existing:
        print("Default framework already exists")
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
    print(f"Created default framework: {result.inserted_id}")
    return result.inserted_id

# Run migration
import asyncio
asyncio.run(create_default_framework())
```

### Step 2: Migrate Existing Data
Update all existing `iso_controls` and `questions` to reference the default framework:

```python
async def migrate_existing_data():
    client = AsyncIOMotorClient("mongodb://localhost:27017/iso27001_compliance")
    db = client["iso27001_compliance"]
    
    # Get default framework
    default_framework = await db.compliance_frameworks.find_one({"name": "ISO 27001"})
    if not default_framework:
        print("Error: Default framework not found. Run Step 1 first.")
        return
    
    framework_id = default_framework["_id"]
    
    # Update all iso_controls
    result = await db.iso_controls.update_many(
        {"compliance_framework_id": {"$exists": False}},
        {"$set": {"compliance_framework_id": framework_id}}
    )
    print(f"Updated {result.modified_count} ISO controls")
    
    # For questions, we need to get compliance_framework_id from the control
    # This is more complex - update questions based on their iso_control_id
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
    print(f"Updated {updated} questions")

# Run migration
import asyncio
asyncio.run(migrate_existing_data())
```

### Step 3: Update Database Indexes
```python
async def update_indexes():
    client = AsyncIOMotorClient("mongodb://localhost:27017/iso27001_compliance")
    db = client["iso27001_compliance"]
    
    # Drop old index
    try:
        await db.iso_controls.drop_index([("department_id", 1), ("control_id", 1)])
    except:
        pass
    
    # Create new index
    await db.iso_controls.create_index(
        [("department_id", 1), ("compliance_framework_id", 1), ("control_id", 1)],
        unique=True
    )
    
    # Add index for compliance_framework_id
    await db.iso_controls.create_index("compliance_framework_id")
    await db.questions.create_index("compliance_framework_id")
    await db.compliance_frameworks.create_index("name", unique=True)
    
    print("Indexes updated successfully")

# Run
import asyncio
asyncio.run(update_indexes())
```

## API Changes

### New Endpoints
- `POST /api/v1/admin/compliance-frameworks` - Create framework
- `GET /api/v1/admin/compliance-frameworks` - List frameworks
- `GET /api/v1/admin/compliance-frameworks/{id}` - Get framework
- `PUT /api/v1/admin/compliance-frameworks/{id}` - Update framework
- `DELETE /api/v1/admin/compliance-frameworks/{id}` - Delete framework

### Updated Endpoints
- `POST /api/v1/admin/iso-controls` - Now requires `compliance_framework_id`
- `GET /api/v1/admin/iso-controls` - Now accepts `compliance_framework_id` filter
- `POST /api/v1/admin/questions` - Now requires `compliance_framework_id`
- `GET /api/v1/user/iso-controls` - Should filter by selected framework
- `GET /api/v1/user/questions` - Should filter by selected framework

## Frontend Changes Needed

1. **Admin Panel:**
   - Add "Compliance Frameworks" management page
   - Update ISO Controls form to include framework selector
   - Update Questions form to include framework selector
   - Add framework filter to ISO Controls list

2. **User Interface:**
   - Add framework selector in checklist (store in localStorage or user profile)
   - Filter questions/controls by selected framework
   - Show framework name in UI

3. **User Profile:**
   - Optionally store default framework preference per user

## Testing Checklist

- [ ] Create default ISO 27001 framework
- [ ] Migrate existing controls and questions
- [ ] Create new framework (e.g., SOC 2)
- [ ] Create controls for new framework
- [ ] Create questions for new framework
- [ ] Verify users can switch between frameworks
- [ ] Verify responses are framework-specific
- [ ] Test proof approvals work with multiple frameworks
- [ ] Verify notifications work correctly

## Backward Compatibility

**Important:** Existing data must be migrated before deploying these changes. The application will fail if:
- `iso_controls` don't have `compliance_framework_id`
- `questions` don't have `compliance_framework_id`

Run the migration scripts before deploying!
