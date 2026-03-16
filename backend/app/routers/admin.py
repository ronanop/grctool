from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from typing import List, Optional
from datetime import datetime
import os
import uuid
from pathlib import Path
from io import BytesIO
from pydantic import BaseModel
try:
    import openpyxl
    OPENPYXL_AVAILABLE = True
except ImportError:
    OPENPYXL_AVAILABLE = False
from app.auth import get_current_active_user, require_role
from app.database import db
from app.models import (
    UserInDB, Role, DepartmentCreate, DepartmentResponse, DepartmentUpdate,
    ISOControlCreate, ISOControlResponse, ISOControlUpdate,
    QuestionCreate, QuestionResponse, QuestionUpdate, 
    UserResponse, ResponseResponse, DepartmentStats,
    PolicyCreate, PolicyResponse, PolicyUpdate,
    AgentCreate, AgentResponse, AgentUpdate,
    ComplianceFrameworkCreate, ComplianceFrameworkResponse, ComplianceFrameworkUpdate
)
from app.services.rag_service import get_gpu_info
from bson import ObjectId
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
Path(UPLOAD_DIR).mkdir(parents=True, exist_ok=True)

# Require admin role for all routes
admin_only = require_role([Role.ADMIN])

# ========== DEPARTMENT MANAGEMENT ==========
@router.post("/departments", response_model=DepartmentResponse, status_code=status.HTTP_201_CREATED)
async def create_department(
    department: DepartmentCreate,
    current_user: UserInDB = Depends(admin_only)
):
    """Create a new department with optional compliance framework associations"""
    existing = await db.departments.find_one({"name": department.name})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Department already exists"
        )
    
    # Validate compliance frameworks if provided
    framework_ids = []
    if department.compliance_framework_ids:
        for framework_id in department.compliance_framework_ids:
            framework = await db.compliance_frameworks.find_one({"_id": framework_id})
            if not framework:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Compliance framework with ID {framework_id} not found"
                )
            framework_ids.append(framework_id)
    
    dept_dict = {
        "name": department.name,
        "compliance_framework_ids": framework_ids
    }
    result = await db.departments.insert_one(dept_dict)
    dept_dict["_id"] = result.inserted_id
    return DepartmentResponse(**dept_dict)

@router.get("/departments", response_model=List[DepartmentResponse])
async def get_departments(
    compliance_framework_id: Optional[str] = None,
    current_user: UserInDB = Depends(admin_only)
):
    """Get all departments, optionally filtered by compliance framework"""
    query = {}
    if compliance_framework_id:
        query["compliance_framework_ids"] = ObjectId(compliance_framework_id)
    
    departments = await db.departments.find(query).to_list(length=100)
    # Ensure compliance_framework_ids exists for backward compatibility
    for dept in departments:
        if "compliance_framework_ids" not in dept:
            dept["compliance_framework_ids"] = []
    return [DepartmentResponse(**dept) for dept in departments]

@router.get("/departments/{department_id}", response_model=DepartmentResponse)
async def get_department(
    department_id: str,
    current_user: UserInDB = Depends(admin_only)
):
    """Get a specific department"""
    dept = await db.departments.find_one({"_id": ObjectId(department_id)})
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    # Ensure compliance_framework_ids exists for backward compatibility
    if "compliance_framework_ids" not in dept:
        dept["compliance_framework_ids"] = []
    return DepartmentResponse(**dept)

@router.put("/departments/{department_id}", response_model=DepartmentResponse)
async def update_department(
    department_id: str,
    department_update: DepartmentUpdate,
    current_user: UserInDB = Depends(admin_only)
):
    """Update a department, including its compliance framework associations"""
    dept = await db.departments.find_one({"_id": ObjectId(department_id)})
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    
    update_dict = {}
    if department_update.name is not None:
        # Check if new name conflicts with existing department
        existing = await db.departments.find_one({
            "name": department_update.name,
            "_id": {"$ne": ObjectId(department_id)}
        })
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Department name already exists"
            )
        update_dict["name"] = department_update.name
    
    if department_update.compliance_framework_ids is not None:
        # Validate all compliance frameworks
        framework_ids = []
        for framework_id in department_update.compliance_framework_ids:
            framework = await db.compliance_frameworks.find_one({"_id": framework_id})
            if not framework:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Compliance framework with ID {framework_id} not found"
                )
            framework_ids.append(framework_id)
        update_dict["compliance_framework_ids"] = framework_ids
    
    if not update_dict:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    await db.departments.update_one(
        {"_id": ObjectId(department_id)},
        {"$set": update_dict}
    )
    
    updated_dept = await db.departments.find_one({"_id": ObjectId(department_id)})
    # Ensure compliance_framework_ids exists
    if "compliance_framework_ids" not in updated_dept:
        updated_dept["compliance_framework_ids"] = []
    return DepartmentResponse(**updated_dept)

@router.delete("/departments/{department_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_department(
    department_id: str,
    current_user: UserInDB = Depends(admin_only)
):
    """Delete a department"""
    result = await db.departments.delete_one({"_id": ObjectId(department_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Department not found")
    return None

@router.delete("/departments/{department_id}/responses", status_code=status.HTTP_200_OK)
async def clear_department_responses(
    department_id: str,
    current_user: UserInDB = Depends(admin_only)
):
    """Clear all control responses and question responses for a department (control-wise)"""
    # Verify department exists
    dept = await db.departments.find_one({"_id": ObjectId(department_id)})
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    
    # Get all ISO controls for this department
    iso_controls = await db.iso_controls.find(
        {"department_id": ObjectId(department_id)}
    ).to_list(length=1000)
    
    if not iso_controls:
        return {
            "message": "No ISO controls found for this department",
            "control_responses_deleted": 0,
            "question_responses_deleted": 0
        }
    
    iso_control_ids = [ObjectId(c["_id"]) for c in iso_controls]
    
    # Delete all control responses for these ISO controls
    control_responses_result = await db.control_responses.delete_many(
        {"iso_control_id": {"$in": iso_control_ids}}
    )
    
    # Get all questions for these ISO controls
    questions = await db.questions.find(
        {"iso_control_id": {"$in": iso_control_ids}}
    ).to_list(length=10000)
    
    question_ids = [ObjectId(q["_id"]) for q in questions]
    
    # Delete all question responses for these questions
    question_responses_result = await db.responses.delete_many(
        {"question_id": {"$in": question_ids}}
    )
    
    return {
        "message": f"Successfully cleared all responses for department '{dept['name']}'",
        "control_responses_deleted": control_responses_result.deleted_count,
        "question_responses_deleted": question_responses_result.deleted_count,
        "iso_controls_affected": len(iso_control_ids),
        "questions_affected": len(question_ids)
    }

# ========== COMPLIANCE FRAMEWORKS ==========
@router.post("/compliance-frameworks", response_model=ComplianceFrameworkResponse, status_code=status.HTTP_201_CREATED)
async def create_compliance_framework(
    framework: ComplianceFrameworkCreate,
    current_user: UserInDB = Depends(admin_only)
):
    """Create a new compliance framework"""
    framework_dict = {
        "name": framework.name,
        "description": framework.description,
        "version": framework.version,
        "is_active": framework.is_active,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    result = await db.compliance_frameworks.insert_one(framework_dict)
    framework_dict["_id"] = result.inserted_id
    return ComplianceFrameworkResponse(**framework_dict)

@router.get("/compliance-frameworks", response_model=List[ComplianceFrameworkResponse])
async def get_compliance_frameworks(
    active_only: Optional[bool] = None,
    current_user: UserInDB = Depends(admin_only)
):
    """Get all compliance frameworks"""
    query = {}
    if active_only:
        query["is_active"] = True
    
    frameworks = await db.compliance_frameworks.find(query).sort("name", 1).to_list(length=1000)
    return [ComplianceFrameworkResponse(**f) for f in frameworks]

@router.get("/compliance-frameworks/{framework_id}", response_model=ComplianceFrameworkResponse)
async def get_compliance_framework(
    framework_id: str,
    current_user: UserInDB = Depends(admin_only)
):
    """Get a specific compliance framework"""
    framework = await db.compliance_frameworks.find_one({"_id": ObjectId(framework_id)})
    if not framework:
        raise HTTPException(status_code=404, detail="Compliance framework not found")
    return ComplianceFrameworkResponse(**framework)

@router.put("/compliance-frameworks/{framework_id}", response_model=ComplianceFrameworkResponse)
async def update_compliance_framework(
    framework_id: str,
    framework_update: ComplianceFrameworkUpdate,
    current_user: UserInDB = Depends(admin_only)
):
    """Update a compliance framework"""
    framework = await db.compliance_frameworks.find_one({"_id": ObjectId(framework_id)})
    if not framework:
        raise HTTPException(status_code=404, detail="Compliance framework not found")
    
    update_dict = {"updated_at": datetime.utcnow()}
    if framework_update.name is not None:
        update_dict["name"] = framework_update.name
    if framework_update.description is not None:
        update_dict["description"] = framework_update.description
    if framework_update.version is not None:
        update_dict["version"] = framework_update.version
    if framework_update.is_active is not None:
        update_dict["is_active"] = framework_update.is_active
    
    await db.compliance_frameworks.update_one(
        {"_id": ObjectId(framework_id)},
        {"$set": update_dict}
    )
    
    updated_framework = await db.compliance_frameworks.find_one({"_id": ObjectId(framework_id)})
    return ComplianceFrameworkResponse(**updated_framework)

@router.delete("/compliance-frameworks/{framework_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_compliance_framework(
    framework_id: str,
    current_user: UserInDB = Depends(admin_only)
):
    """Delete a compliance framework (only if no controls are using it)"""
    # Check if any controls are using this framework
    controls_count = await db.iso_controls.count_documents({"compliance_framework_id": ObjectId(framework_id)})
    if controls_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete compliance framework. {controls_count} control(s) are using it."
        )
    
    result = await db.compliance_frameworks.delete_one({"_id": ObjectId(framework_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Compliance framework not found")
    return None

# ========== ISO CONTROL MANAGEMENT ==========
@router.post("/iso-controls", response_model=ISOControlResponse, status_code=status.HTTP_201_CREATED)
async def create_iso_control(
    iso_control: ISOControlCreate,
    current_user: UserInDB = Depends(admin_only)
):
    """Create a new ISO control"""
    # Validate department exists
    dept = await db.departments.find_one({"_id": ObjectId(iso_control.department_id)})
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    
    # Validate compliance framework exists
    framework = await db.compliance_frameworks.find_one({"_id": ObjectId(iso_control.compliance_framework_id)})
    if not framework:
        raise HTTPException(status_code=404, detail="Compliance framework not found")
    
    # Check if control_id already exists for this department and framework
    existing = await db.iso_controls.find_one({
        "department_id": ObjectId(iso_control.department_id),
        "compliance_framework_id": ObjectId(iso_control.compliance_framework_id),
        "control_id": iso_control.control_id
    })
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ISO Control ID already exists for this department and compliance framework"
        )
    
    control_dict = {
        "department_id": ObjectId(iso_control.department_id),
        "compliance_framework_id": ObjectId(iso_control.compliance_framework_id),
        "control_id": iso_control.control_id,
        "control_name": iso_control.control_name
    }
    result = await db.iso_controls.insert_one(control_dict)
    control_dict["_id"] = result.inserted_id
    return ISOControlResponse(**control_dict)

@router.get("/iso-controls", response_model=List[ISOControlResponse])
async def get_iso_controls(
    department_id: Optional[str] = None,
    compliance_framework_id: Optional[str] = None,
    current_user: UserInDB = Depends(admin_only)
):
    """Get all ISO controls, optionally filtered by department or compliance framework"""
    query = {}
    if department_id:
        query["department_id"] = ObjectId(department_id)
    if compliance_framework_id:
        query["compliance_framework_id"] = ObjectId(compliance_framework_id)
    
    controls = await db.iso_controls.find(query).to_list(length=1000)
    return [ISOControlResponse(**c) for c in controls]

@router.get("/iso-controls/{control_id}", response_model=ISOControlResponse)
async def get_iso_control(
    control_id: str,
    current_user: UserInDB = Depends(admin_only)
):
    """Get a specific ISO control"""
    control = await db.iso_controls.find_one({"_id": ObjectId(control_id)})
    if not control:
        raise HTTPException(status_code=404, detail="ISO Control not found")
    return ISOControlResponse(**control)

@router.put("/iso-controls/{control_id}", response_model=ISOControlResponse)
async def update_iso_control(
    control_id: str,
    control_update: ISOControlUpdate,
    current_user: UserInDB = Depends(admin_only)
):
    """Update an ISO control"""
    update_dict = {}
    if control_update.control_id is not None:
        update_dict["control_id"] = control_update.control_id
    if control_update.control_name is not None:
        update_dict["control_name"] = control_update.control_name
    if control_update.department_id is not None:
        dept = await db.departments.find_one({"_id": ObjectId(control_update.department_id)})
        if not dept:
            raise HTTPException(status_code=404, detail="Department not found")
        update_dict["department_id"] = ObjectId(control_update.department_id)
    if control_update.compliance_framework_id is not None:
        framework = await db.compliance_frameworks.find_one({"_id": ObjectId(control_update.compliance_framework_id)})
        if not framework:
            raise HTTPException(status_code=404, detail="Compliance framework not found")
        update_dict["compliance_framework_id"] = ObjectId(control_update.compliance_framework_id)
    
    if not update_dict:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    result = await db.iso_controls.update_one(
        {"_id": ObjectId(control_id)},
        {"$set": update_dict}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="ISO Control not found")
    
    updated_control = await db.iso_controls.find_one({"_id": ObjectId(control_id)})
    return ISOControlResponse(**updated_control)

@router.delete("/iso-controls/{control_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_iso_control(
    control_id: str,
    current_user: UserInDB = Depends(admin_only)
):
    """Delete an ISO control and automatically delete all linked questions, responses, and tasks"""
    # Verify control exists
    control = await db.iso_controls.find_one({"_id": ObjectId(control_id)})
    if not control:
        raise HTTPException(status_code=404, detail="ISO Control not found")
    
    # Get all questions linked to this control
    questions = await db.questions.find({"iso_control_id": ObjectId(control_id)}).to_list(length=1000)
    question_ids = [q["_id"] for q in questions]
    
    # Get all responses for these questions to get response IDs
    if question_ids:
        responses = await db.responses.find({"question_id": {"$in": question_ids}}).to_list(length=1000)
        response_ids = [r["_id"] for r in responses]
        
        # Delete all tasks linked to these questions or responses
        if question_ids:
            await db.tasks.delete_many({"question_id": {"$in": question_ids}})
        if response_ids:
            await db.tasks.delete_many({"response_id": {"$in": response_ids}})
        
        # Delete all responses for these questions
        await db.responses.delete_many({"question_id": {"$in": question_ids}})
    
    # Delete all questions linked to this control
    if question_ids:
        await db.questions.delete_many({"iso_control_id": ObjectId(control_id)})
    
    # Finally, delete the control itself
    result = await db.iso_controls.delete_one({"_id": ObjectId(control_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="ISO Control not found")
    
    return None

# ========== QUESTION MANAGEMENT ==========
@router.post("/questions", response_model=QuestionResponse, status_code=status.HTTP_201_CREATED)
async def create_question(
    question: QuestionCreate,
    current_user: UserInDB = Depends(admin_only)
):
    """Create a new question - auto-creates ISO Control if it doesn't exist"""
    # Validate department exists
    dept = await db.departments.find_one({"_id": ObjectId(question.department_id)})
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    
    # Validate compliance framework exists
    framework = await db.compliance_frameworks.find_one({"_id": ObjectId(question.compliance_framework_id)})
    if not framework:
        raise HTTPException(status_code=404, detail="Compliance framework not found")
    
    # Find or create ISO control by control_id, department_id, and compliance_framework_id
    iso_control = await db.iso_controls.find_one({
        "control_id": question.control_id,
        "department_id": ObjectId(question.department_id),
        "compliance_framework_id": ObjectId(question.compliance_framework_id)
    })
    
    if not iso_control:
        # Auto-create the ISO Control if it doesn't exist
        control_dict = {
            "department_id": ObjectId(question.department_id),
            "compliance_framework_id": ObjectId(question.compliance_framework_id),
            "control_id": question.control_id,
            "control_name": question.control_name
        }
        control_result = await db.iso_controls.insert_one(control_dict)
        control_dict["_id"] = control_result.inserted_id
        iso_control = control_dict
    
    # Get existing questions for this control to determine next question_id
    existing_questions = await db.questions.find(
        {"iso_control_id": iso_control["_id"]}
    ).sort("question_id", 1).to_list(length=100)
    
    # Generate next question_id (a, b, c, ..., z, aa, ab, ...)
    def get_next_question_id(existing_ids):
        if not existing_ids:
            return "a"
        
        # Get the last question_id
        last_id = existing_ids[-1].get("question_id", "")
        
        if not last_id:
            return "a"
        
        # Convert to lowercase for consistency
        last_id = last_id.lower()
        
        # If it's a single letter, get next letter
        if len(last_id) == 1 and last_id.isalpha():
            if last_id == "z":
                return "aa"
            return chr(ord(last_id) + 1)
        
        # Handle multi-letter IDs (aa, ab, etc.)
        if len(last_id) == 2 and last_id.isalpha():
            if last_id == "zz":
                return "aaa"
            first_char = last_id[0]
            second_char = last_id[1]
            if second_char == "z":
                return chr(ord(first_char) + 1) + "a"
            return first_char + chr(ord(second_char) + 1)
        
        # For longer IDs, just increment the last character
        return last_id[:-1] + chr(ord(last_id[-1]) + 1) if last_id[-1] != "z" else last_id + "a"
    
    existing_ids = [{"question_id": q.get("question_id", "")} for q in existing_questions]
    next_question_id = get_next_question_id(existing_ids)
    
    # Create the question
    question_dict = {
        "iso_control_id": iso_control["_id"],
        "compliance_framework_id": ObjectId(question.compliance_framework_id),
        "question_id": next_question_id,
        "text": question.text
    }
    result = await db.questions.insert_one(question_dict)
    question_dict["_id"] = result.inserted_id
    return QuestionResponse(**question_dict)

@router.get("/questions", response_model=List[QuestionResponse])
async def get_questions(
    iso_control_id: Optional[str] = None,
    department_id: Optional[str] = None,
    compliance_framework_id: Optional[str] = None,
    current_user: UserInDB = Depends(admin_only)
):
    """Get all questions, optionally filtered by ISO control, department, or compliance framework"""
    query = {}
    if iso_control_id:
        query["iso_control_id"] = ObjectId(iso_control_id)
    elif department_id:
        # Get all ISO controls for this department, then get their questions
        iso_control_query = {"department_id": ObjectId(department_id)}
        if compliance_framework_id:
            iso_control_query["compliance_framework_id"] = ObjectId(compliance_framework_id)
        
        iso_controls = await db.iso_controls.find(iso_control_query).distinct("_id")
        query["iso_control_id"] = {"$in": iso_controls}
    elif compliance_framework_id:
        # Filter by compliance framework only: get all ISO controls for this framework, then get their questions
        iso_control_query = {"compliance_framework_id": ObjectId(compliance_framework_id)}
        iso_controls = await db.iso_controls.find(iso_control_query).distinct("_id")
        if iso_controls:
            query["iso_control_id"] = {"$in": iso_controls}
        else:
            # No controls found for this framework, return empty result
            query["iso_control_id"] = {"$in": []}
    
    questions = await db.questions.find(query).to_list(length=1000)
    return [QuestionResponse(**q) for q in questions]

@router.get("/questions/{question_id}", response_model=QuestionResponse)
async def get_question(
    question_id: str,
    current_user: UserInDB = Depends(admin_only)
):
    """Get a specific question"""
    question = await db.questions.find_one({"_id": ObjectId(question_id)})
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    return QuestionResponse(**question)

@router.put("/questions/{question_id}", response_model=QuestionResponse)
async def update_question(
    question_id: str,
    question_update: QuestionUpdate,
    current_user: UserInDB = Depends(admin_only)
):
    """Update a question"""
    update_dict = {}
    if question_update.text is not None:
        update_dict["text"] = question_update.text
    
    # Handle ISO control update - can use either control_id+department_id or iso_control_id
    if question_update.control_id is not None:
        if not question_update.department_id:
            raise HTTPException(
                status_code=400, 
                detail="department_id is required when updating control_id"
            )
        # Find or create ISO control by control_id, department_id, and compliance_framework_id
        control_query = {
            "control_id": question_update.control_id,
            "department_id": ObjectId(question_update.department_id)
        }
        if question_update.compliance_framework_id:
            control_query["compliance_framework_id"] = ObjectId(question_update.compliance_framework_id)
        
        iso_control = await db.iso_controls.find_one(control_query)
        if not iso_control:
            # Auto-create if it doesn't exist (but control_name and compliance_framework_id are required)
            if not question_update.control_name:
                raise HTTPException(
                    status_code=400,
                    detail="control_name is required when creating a new ISO Control"
                )
            if not question_update.compliance_framework_id:
                raise HTTPException(
                    status_code=400,
                    detail="compliance_framework_id is required when creating a new ISO Control"
                )
            control_dict = {
                "department_id": ObjectId(question_update.department_id),
                "compliance_framework_id": ObjectId(question_update.compliance_framework_id),
                "control_id": question_update.control_id,
                "control_name": question_update.control_name
            }
            control_result = await db.iso_controls.insert_one(control_dict)
            control_dict["_id"] = control_result.inserted_id
            iso_control = control_dict
        update_dict["iso_control_id"] = iso_control["_id"]
        if question_update.compliance_framework_id:
            update_dict["compliance_framework_id"] = ObjectId(question_update.compliance_framework_id)
    elif question_update.iso_control_id is not None:
        # Validate ISO control exists
        iso_control = await db.iso_controls.find_one({"_id": ObjectId(question_update.iso_control_id)})
        if not iso_control:
            raise HTTPException(status_code=404, detail="ISO Control not found")
        update_dict["iso_control_id"] = ObjectId(question_update.iso_control_id)
    
    if not update_dict:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    result = await db.questions.update_one(
        {"_id": ObjectId(question_id)},
        {"$set": update_dict}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Question not found")
    
    updated_question = await db.questions.find_one({"_id": ObjectId(question_id)})
    return QuestionResponse(**updated_question)

@router.delete("/questions/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_question(
    question_id: str,
    current_user: UserInDB = Depends(admin_only)
):
    """Delete a question"""
    result = await db.questions.delete_one({"_id": ObjectId(question_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Question not found")
    return None

# ========== BULK IMPORT QUESTIONS ==========
class BulkImportResult(BaseModel):
    total_rows: int
    successful: int
    failed: int
    skipped: int
    errors: List[dict] = []
    warnings: List[str] = []

@router.post("/questions/bulk-import", response_model=BulkImportResult)
async def bulk_import_questions(
    file: UploadFile = File(...),
    import_mode: str = Form("create_only"),  # create_only, update_existing, replace_all
    current_user: UserInDB = Depends(admin_only)
):
    """
    Bulk import questions from Excel file.
    
    Excel format:
    - Column A: compliance_framework (framework name)
    - Column B: department (department name)
    - Column C: control_id (e.g., A.9.2.1)
    - Column D: control_name (e.g., Access control)
    - Column E: question_text (the question)
    - Column F: question_id (optional, auto-generated if not provided)
    
    Import modes:
    - create_only: Only creates new questions, skips existing
    - update_existing: Updates existing questions if found
    - replace_all: Deletes all questions for controls in file, then creates new ones
    """
    # Read file content first
    contents = await file.read()
    
    # Check file type
    is_csv = file.filename.endswith('.csv')
    is_excel = file.filename.endswith(('.xlsx', '.xls'))
    
    if not (is_csv or is_excel):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only Excel files (.xlsx, .xls) or CSV files (.csv) are supported"
        )
    
    # Initialize variables
    header_map = {}
    rows = None
    worksheet = None
    
    try:
        if is_csv:
            # Handle CSV file: decode with UTF-8 (never use utf-8-sig; strip BOM manually)
            import csv
            import io
            csv_content = None
            for encoding in ("utf-8", "cp1252", "latin-1"):
                try:
                    csv_content = contents.decode(encoding, errors="replace")
                    break
                except (LookupError, ValueError):
                    continue
            if csv_content is None:
                csv_content = contents.decode("utf-8", errors="replace")
            if csv_content.startswith("\ufeff"):
                csv_content = csv_content[1:]
            csv_reader = csv.DictReader(io.StringIO(csv_content))
            rows = list(csv_reader)
            
            if not rows:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="CSV file is empty or has no data rows"
                )
            
            # Validate headers (case-insensitive)
            expected_headers = ['compliance_framework', 'department', 'control_id', 'control_name', 'question_text', 'question_id']
            csv_headers = [h.strip() for h in (csv_reader.fieldnames or [])]
            csv_headers_lower = [h.lower() for h in csv_headers]
            required_headers_lower = [h.lower() for h in expected_headers[:5]]
            
            missing_headers = [h for h in required_headers_lower if h not in csv_headers_lower]
            if missing_headers:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid CSV format. Missing required columns: {', '.join(missing_headers)}. Found columns: {', '.join(csv_headers)}"
                )
            
            # Create header mapping for case-insensitive access
            for expected in expected_headers:
                for csv_header in csv_headers:
                    if csv_header.lower() == expected.lower():
                        header_map[expected] = csv_header
                        break
        else:
            # Handle Excel file - check if openpyxl is available
            if not OPENPYXL_AVAILABLE:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="openpyxl library is required for Excel import. Install it with: pip install openpyxl. Please restart the server after installation."
                )
            
            workbook = openpyxl.load_workbook(BytesIO(contents), data_only=True)
            worksheet = workbook.active
            
            # Build header map from row 1 (case-insensitive) so column order doesn't matter
            expected_headers = ['compliance_framework', 'department', 'control_id', 'control_name', 'question_text', 'question_id']
            first_row = next(worksheet.iter_rows(min_row=1, max_row=1, values_only=False), None)
            if not first_row:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid Excel format. File has no header row."
                )
            def normalize_header(s: str) -> str:
                return (s or "").lower().strip().replace(" ", "_").replace("-", "_")

            excel_headers = [str(c.value).strip() if c.value else "" for c in first_row]
            for col_idx, cell_value in enumerate(excel_headers):
                cv_normalized = normalize_header(cell_value)
                for expected in expected_headers:
                    if normalize_header(expected) == cv_normalized and expected not in header_map:
                        header_map[expected] = col_idx
                        break
            missing_headers = [h for h in expected_headers[:5] if h not in header_map]
            if missing_headers:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid Excel format. Missing required columns: {', '.join(missing_headers)}. Expected (case-insensitive): compliance_framework, department, control_id, control_name, question_text. Found: {', '.join(excel_headers) or '(empty)'}"
                )
        
        # Process rows
        result = BulkImportResult(
            total_rows=0,
            successful=0,
            failed=0,
            skipped=0,
            errors=[],
            warnings=[]
        )
        
        # Track controls to replace if mode is replace_all
        controls_to_replace = set()
        
        # Create row iterator based on file type
        if is_csv:
            row_iterator = enumerate(rows, start=2)
        else:
            row_iterator = enumerate(worksheet.iter_rows(min_row=2, values_only=False), start=2)
        
        for row_idx, row_data in row_iterator:
            try:
                # Extract values based on file type
                if is_csv:
                    # CSV: row_data is a dict
                    if not row_data or not any(str(v).strip() for v in row_data.values() if v):
                        continue  # Skip empty rows
                    
                    # Use header mapping for case-insensitive access
                    framework_name = str(row_data.get(header_map.get('compliance_framework', 'compliance_framework'), '') or '').strip()
                    department_name = str(row_data.get(header_map.get('department', 'department'), '') or '').strip()
                    control_id = str(row_data.get(header_map.get('control_id', 'control_id'), '') or '').strip()
                    control_name = str(row_data.get(header_map.get('control_name', 'control_name'), '') or '').strip()
                    question_text = str(row_data.get(header_map.get('question_text', 'question_text'), '') or '').strip()
                    question_id = str(row_data.get(header_map.get('question_id', 'question_id'), '') or '').strip() or None
                else:
                    # Excel: row_data is a row of cells; use header_map (column index) for correct column mapping
                    if not any(cell.value for cell in row_data):
                        continue  # Skip empty rows
                    
                    def excel_cell(key: str):
                        idx = header_map.get(key)
                        if idx is None or idx >= len(row_data):
                            return None
                        v = row_data[idx].value
                        return str(v).strip() if v is not None and str(v).strip() else None
                    
                    framework_name = excel_cell("compliance_framework")
                    department_name = excel_cell("department")
                    control_id = excel_cell("control_id")
                    control_name = excel_cell("control_name")
                    question_text = excel_cell("question_text")
                    question_id = excel_cell("question_id") or None
                
                result.total_rows += 1
                
                # Validate required fields and report which are missing
                required = [
                    ("compliance_framework", framework_name),
                    ("department", department_name),
                    ("control_id", control_id),
                    ("control_name", control_name),
                    ("question_text", question_text),
                ]
                missing = [name for name, val in required if not val or not str(val).strip()]
                if missing:
                    result.failed += 1
                    result.errors.append({
                        "row": row_idx,
                        "error": f"Missing required fields: {', '.join(missing)}",
                        "data": {
                            "framework": framework_name or "",
                            "department": department_name or "",
                            "control_id": control_id or "",
                            "control_name": control_name or "",
                            "question_text": (question_text or "")[:50] + ("..." if (question_text or "") and len(question_text or "") > 50 else ""),
                        }
                    })
                    continue
                
                # Find compliance framework
                framework = await db.compliance_frameworks.find_one({"name": framework_name})
                if not framework:
                    result.failed += 1
                    result.errors.append({
                        "row": row_idx,
                        "error": f"Compliance framework '{framework_name}' not found",
                        "data": {"framework": framework_name}
                    })
                    continue
                
                # Find or create department (create with name from file if not existing)
                framework_id = framework["_id"]
                department = await db.departments.find_one({"name": department_name})
                if not department:
                    # Create department with name as in uploaded file; link to current framework
                    dept_dict = {
                        "name": department_name,
                        "compliance_framework_ids": [framework_id]
                    }
                    insert_result = await db.departments.insert_one(dept_dict)
                    dept_dict["_id"] = insert_result.inserted_id
                    department = dept_dict
                    result.warnings.append(f"Row {row_idx}: Created new department '{department_name}'")
                else:
                    # Ensure department is linked to this framework (for existing departments)
                    cf_ids = department.get("compliance_framework_ids") or []
                    if framework_id not in cf_ids:
                        await db.departments.update_one(
                            {"_id": department["_id"]},
                            {"$addToSet": {"compliance_framework_ids": framework_id}}
                        )
                
                department_id = department["_id"]
                
                # Find or create ISO control
                iso_control = await db.iso_controls.find_one({
                    "control_id": control_id,
                    "department_id": department_id,
                    "compliance_framework_id": framework_id
                })
                
                if not iso_control:
                    # Auto-create the ISO Control
                    control_dict = {
                        "department_id": department_id,
                        "compliance_framework_id": framework_id,
                        "control_id": control_id,
                        "control_name": control_name
                    }
                    control_result = await db.iso_controls.insert_one(control_dict)
                    control_dict["_id"] = control_result.inserted_id
                    iso_control = control_dict
                
                iso_control_id = iso_control["_id"]
                controls_to_replace.add(str(iso_control_id))
                
                # Generate question_id if not provided
                if not question_id:
                    existing_questions = await db.questions.find(
                        {"iso_control_id": iso_control_id}
                    ).sort("question_id", 1).to_list(length=100)
                    
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
                    question_id = get_next_question_id(existing_ids)
                
                # Check if question already exists
                existing_question = await db.questions.find_one({
                    "iso_control_id": iso_control_id,
                    "question_id": question_id
                })
                
                if existing_question:
                    if import_mode == "create_only":
                        result.skipped += 1
                        result.warnings.append(f"Row {row_idx}: Question {question_id} already exists for control {control_id}, skipped")
                        continue
                    elif import_mode == "update_existing":
                        # Update existing question
                        await db.questions.update_one(
                            {"_id": existing_question["_id"]},
                            {"$set": {
                                "text": question_text,
                                "compliance_framework_id": framework_id
                            }}
                        )
                        result.successful += 1
                        continue
                    elif import_mode == "replace_all":
                        # Will be handled after processing all rows
                        pass
                
                # Create new question
                question_dict = {
                    "iso_control_id": iso_control_id,
                    "compliance_framework_id": framework_id,
                    "question_id": question_id,
                    "text": question_text
                }
                await db.questions.insert_one(question_dict)
                result.successful += 1
                
            except Exception as e:
                result.failed += 1
                result.errors.append({
                    "row": row_idx,
                    "error": str(e),
                    "data": {}
                })
        
        # Handle replace_all mode: delete existing questions for controls in file
        if import_mode == "replace_all" and controls_to_replace:
            for control_id_str in controls_to_replace:
                await db.questions.delete_many({"iso_control_id": ObjectId(control_id_str)})
            result.warnings.append(f"Deleted all existing questions for {len(controls_to_replace)} control(s) before importing new ones")
        
        return result
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        # Log the full error for debugging
        import traceback
        error_details = traceback.format_exc()
        print(f"Bulk import error: {error_details}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error processing file: {str(e)}"
        )

# ========== USER MANAGEMENT ==========
@router.get("/users", response_model=List[UserResponse])
async def get_users(current_user: UserInDB = Depends(admin_only)):
    """Get all users"""
    users = await db.users.find().to_list(length=1000)
    # Ensure is_senior field exists for all users (default to False if missing)
    for user in users:
        if 'is_senior' not in user:
            user['is_senior'] = False
    return [UserResponse(**user) for user in users]

@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: str,
    current_user: UserInDB = Depends(admin_only)
):
    """Get a specific user"""
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse(**user)

@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: str,
    current_user: UserInDB = Depends(admin_only)
):
    """Delete a user"""
    result = await db.users.delete_one({"_id": ObjectId(user_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return None

# ========== RESPONSES & PROOFS ==========
@router.get("/responses", response_model=List[ResponseResponse])
async def get_all_responses(
    department_id: Optional[str] = None,
    user_id: Optional[str] = None,
    current_user: UserInDB = Depends(admin_only)
):
    """Get all responses (Admin only)"""
    query = {}
    if department_id:
        # Get questions for this department first
        question_ids = await db.questions.find(
            {"department_id": ObjectId(department_id)}
        ).distinct("_id")
        query["question_id"] = {"$in": question_ids}
    if user_id:
        query["user_id"] = ObjectId(user_id)
    
    responses = await db.responses.find(query).to_list(length=10000)
    return [ResponseResponse(**r) for r in responses]

@router.get("/responses/{response_id}/proof")
async def download_proof(
    response_id: str,
    current_user: UserInDB = Depends(admin_only)
):
    """Download proof file for a response"""
    from fastapi.responses import FileResponse
    
    response = await db.responses.find_one({"_id": ObjectId(response_id)})
    if not response:
        raise HTTPException(status_code=404, detail="Response not found")
    
    if not response.get("proof_url"):
        raise HTTPException(status_code=404, detail="No proof file uploaded")
    
    file_path = response["proof_url"]
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Proof file not found")
    
    return FileResponse(
        file_path,
        media_type="application/octet-stream",
        filename=os.path.basename(file_path)
    )

# ========== DASHBOARD ==========
@router.get("/dashboard/stats", response_model=List[DepartmentStats])
async def get_dashboard_stats(current_user: UserInDB = Depends(admin_only)):
    """Get dashboard statistics per department"""
    departments = await db.departments.find().to_list(length=100)
    stats = []
    
    for dept in departments:
        dept_id = dept["_id"]
        dept_name = dept["name"]
        framework_ids = dept.get("compliance_framework_ids", [])
        
        # Get framework details
        frameworks = []
        if framework_ids:
            framework_list = await db.compliance_frameworks.find(
                {"_id": {"$in": framework_ids}}
            ).to_list(length=100)
            frameworks = [
                {
                    "id": str(f["_id"]),
                    "name": f.get("name", ""),
                    "version": f.get("version", "")
                }
                for f in framework_list
            ]
        
        # Get all ISO controls for this department
        iso_controls = await db.iso_controls.find(
            {"department_id": dept_id}
        ).distinct("_id")
        
        # Count total questions for this department (through ISO controls)
        total_questions = await db.questions.count_documents(
            {"iso_control_id": {"$in": iso_controls}}
        )
        
        # Count answered questions (responses exist)
        question_ids = await db.questions.find(
            {"iso_control_id": {"$in": iso_controls}}
        ).distinct("_id")
        answered_questions = await db.responses.count_documents(
            {"question_id": {"$in": question_ids}}
        ) if question_ids else 0
        
        completion_percentage = (
            (answered_questions / total_questions * 100) if total_questions > 0 else 0
        )
        
        stats.append(DepartmentStats(
            department_id=dept_id,
            department_name=dept_name,
            total_questions=total_questions,
            answered_questions=answered_questions,
            completion_percentage=round(completion_percentage, 2),
            compliance_framework_ids=framework_ids,
            compliance_frameworks=frameworks
        ))
    
    return stats

# ========== POLICY MANAGEMENT ==========
POLICY_UPLOAD_DIR = os.path.join(UPLOAD_DIR, "policies")
Path(POLICY_UPLOAD_DIR).mkdir(parents=True, exist_ok=True)

@router.post("/policies", response_model=PolicyResponse, status_code=status.HTTP_201_CREATED)
async def upload_policy(
    file: UploadFile = File(...),
    name: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    department_id: str = Form(...),
    current_user: UserInDB = Depends(admin_only)
):
    """Upload a policy file to a department-specific folder"""
    # Validate department exists
    try:
        dept_id_obj = ObjectId(department_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid department ID format")
    
    dept = await db.departments.find_one({"_id": dept_id_obj})
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    
    # Validate file type (allow common document formats)
    allowed_extensions = {'.pdf', '.doc', '.docx', '.txt', '.xls', '.xlsx', '.pptx', '.ppt'}
    file_extension = os.path.splitext(file.filename)[1].lower()
    
    if file_extension not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type not allowed. Allowed types: {', '.join(allowed_extensions)}"
        )
    
    MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
    file_content = await file.read()
    file_size = len(file_content)
    
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size exceeds maximum limit of 50MB"
        )
    
    # Create department-specific folder (sanitize department name for filesystem)
    dept_name = dept["name"].replace("/", "_").replace("\\", "_").replace(":", "_")
    dept_folder = os.path.join(POLICY_UPLOAD_DIR, dept_name)
    Path(dept_folder).mkdir(parents=True, exist_ok=True)
    
    # Generate unique filename
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = os.path.join(dept_folder, unique_filename)
    
    try:
        with open(file_path, "wb") as buffer:
            buffer.write(file_content)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save file: {str(e)}"
        )
    
    # Use provided name or derive from filename
    policy_name = name or os.path.splitext(file.filename)[0]
    
    # Create policy record
    policy_dict = {
        "name": policy_name,
        "description": description,
        "department_id": dept_id_obj,
        "file_url": file_path,
        "file_name": file.filename,
        "file_size": file_size,
        "file_type": file_extension,
        "uploaded_by": ObjectId(current_user.id),
        "uploaded_at": datetime.utcnow()
    }
    
    result = await db.policies.insert_one(policy_dict)
    policy_dict["_id"] = result.inserted_id
    
    return PolicyResponse(**policy_dict)

@router.get("/policies", response_model=List[PolicyResponse])
async def get_policies(
    department_id: Optional[str] = None,
    current_user: UserInDB = Depends(admin_only)
):
    """Get all policies, optionally filtered by department"""
    try:
        query = {}
        if department_id:
            try:
                query["department_id"] = ObjectId(department_id)
            except:
                raise HTTPException(status_code=400, detail="Invalid department ID format")
        
        policies = await db.policies.find(query).sort("uploaded_at", -1).to_list(length=1000)
        # Handle empty collection gracefully
        if not policies:
            return []
        return [PolicyResponse(**p) for p in policies]
    except HTTPException:
        raise
    except Exception as e:
        # If collection doesn't exist yet, return empty list
        print(f"Error fetching policies: {e}")
        return []

@router.get("/policies/{policy_id}", response_model=PolicyResponse)
async def get_policy(
    policy_id: str,
    current_user: UserInDB = Depends(admin_only)
):
    """Get a specific policy"""
    policy = await db.policies.find_one({"_id": ObjectId(policy_id)})
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    return PolicyResponse(**policy)

@router.put("/policies/{policy_id}", response_model=PolicyResponse)
async def update_policy(
    policy_id: str,
    policy_update: PolicyUpdate,
    current_user: UserInDB = Depends(admin_only)
):
    """Update a policy (name, description, and department)"""
    policy = await db.policies.find_one({"_id": ObjectId(policy_id)})
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    
    update_dict = {}
    if policy_update.name is not None:
        update_dict["name"] = policy_update.name
    if policy_update.description is not None:
        update_dict["description"] = policy_update.description
    if policy_update.department_id is not None:
        # Validate new department exists
        dept = await db.departments.find_one({"_id": ObjectId(policy_update.department_id)})
        if not dept:
            raise HTTPException(status_code=404, detail="Department not found")
        update_dict["department_id"] = ObjectId(policy_update.department_id)
    
    if not update_dict:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    result = await db.policies.update_one(
        {"_id": ObjectId(policy_id)},
        {"$set": update_dict}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Policy not found")
    
    updated_policy = await db.policies.find_one({"_id": ObjectId(policy_id)})
    return PolicyResponse(**updated_policy)

@router.delete("/policies/{policy_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_policy(
    policy_id: str,
    current_user: UserInDB = Depends(admin_only)
):
    """Delete a policy and its file"""
    policy = await db.policies.find_one({"_id": ObjectId(policy_id)})
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    
    # Delete the file if it exists
    file_path = policy.get("file_url")
    if file_path and os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception as e:
            print(f"Warning: Failed to delete policy file: {e}")
    
    # Delete the policy record
    await db.policies.delete_one({"_id": ObjectId(policy_id)})
    return None

@router.get("/policies/{policy_id}/download")
async def download_policy(
    policy_id: str,
    current_user: UserInDB = Depends(admin_only)
):
    """Download a policy file"""
    from fastapi.responses import FileResponse
    
    policy = await db.policies.find_one({"_id": ObjectId(policy_id)})
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    
    file_path = policy.get("file_url")
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Policy file not found")
    
    return FileResponse(
        file_path,
        media_type="application/octet-stream",
        filename=policy.get("file_name", "policy.pdf")
    )

# ========== AGENT MANAGEMENT ==========
@router.post("/agents", response_model=AgentResponse, status_code=status.HTTP_201_CREATED)
async def create_agent(
    agent: AgentCreate,
    current_user: UserInDB = Depends(admin_only)
):
    """Create a new agent"""
    # Validate department if provided
    if agent.department_id:
        dept = await db.departments.find_one({"_id": ObjectId(agent.department_id)})
        if not dept:
            raise HTTPException(status_code=404, detail="Department not found")
    
    agent_dict = {
        "name": agent.name,
        "description": agent.description,
        "department_id": ObjectId(agent.department_id) if agent.department_id else None,
        "status": agent.status or "active",
        "created_by": ObjectId(current_user.id),
        "created_at": datetime.utcnow(),
        "updated_at": None
    }
    
    result = await db.agents.insert_one(agent_dict)
    agent_dict["_id"] = result.inserted_id
    
    return AgentResponse(**agent_dict)

@router.get("/agents", response_model=List[AgentResponse])
async def get_agents(
    department_id: Optional[str] = None,
    current_user: UserInDB = Depends(admin_only)
):
    """Get all agents, optionally filtered by department"""
    try:
        query = {}
        if department_id:
            try:
                query["department_id"] = ObjectId(department_id)
            except:
                raise HTTPException(status_code=400, detail="Invalid department ID format")
        
        agents = await db.agents.find(query).sort("created_at", -1).to_list(length=1000)
        if not agents:
            return []
        return [AgentResponse(**a) for a in agents]
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching agents: {e}")
        return []

@router.get("/agents/{agent_id}", response_model=AgentResponse)
async def get_agent(
    agent_id: str,
    current_user: UserInDB = Depends(admin_only)
):
    """Get a specific agent"""
    agent = await db.agents.find_one({"_id": ObjectId(agent_id)})
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return AgentResponse(**agent)

@router.put("/agents/{agent_id}", response_model=AgentResponse)
async def update_agent(
    agent_id: str,
    agent_update: AgentUpdate,
    current_user: UserInDB = Depends(admin_only)
):
    """Update an agent"""
    agent = await db.agents.find_one({"_id": ObjectId(agent_id)})
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    update_dict = {}
    if agent_update.name is not None:
        update_dict["name"] = agent_update.name
    if agent_update.description is not None:
        update_dict["description"] = agent_update.description
    if agent_update.status is not None:
        update_dict["status"] = agent_update.status
    if agent_update.department_id is not None:
        if agent_update.department_id:
            dept = await db.departments.find_one({"_id": ObjectId(agent_update.department_id)})
            if not dept:
                raise HTTPException(status_code=404, detail="Department not found")
            update_dict["department_id"] = ObjectId(agent_update.department_id)
        else:
            update_dict["department_id"] = None
    
    if not update_dict:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    update_dict["updated_at"] = datetime.utcnow()
    
    result = await db.agents.update_one(
        {"_id": ObjectId(agent_id)},
        {"$set": update_dict}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    updated_agent = await db.agents.find_one({"_id": ObjectId(agent_id)})
    return AgentResponse(**updated_agent)

@router.delete("/agents/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_agent(
    agent_id: str,
    current_user: UserInDB = Depends(admin_only)
):
    """Delete an agent"""
    agent = await db.agents.find_one({"_id": ObjectId(agent_id)})
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    await db.agents.delete_one({"_id": ObjectId(agent_id)})
    return None

# ========== OEM / PARTNER INTEGRATIONS (Archer-style) ==========
OEM_SEED = [
    {
        "slug": "oracle",
        "name": "Oracle (HCM / ERP)",
        "what_it_does": "Employee HR data, payroll info, finance, procurement, approvals, vendor records",
        "fetch_methods": "REST/SOAP APIs, database connectors, scheduled CSV/file import",
        "icon": "database",
    },
    {
        "slug": "sap",
        "name": "SAP (ERP / SuccessFactors)",
        "what_it_does": "Business operations, finance, asset/procurement data, HR lifecycle (joiner/mover/leaver)",
        "fetch_methods": "SAP APIs/OData, middleware (Boomi/MuleSoft), scheduled file import",
        "icon": "business",
    },
    {
        "slug": "workday",
        "name": "Workday",
        "what_it_does": "Employee master data, org structure, role changes, HR operations + finance details",
        "fetch_methods": "Workday APIs, integration platforms, scheduled file export/import",
        "icon": "people",
    },
    {
        "slug": "dynamics365",
        "name": "Microsoft Dynamics 365 (ERP)",
        "what_it_does": "Finance operations, workflows/approvals, vendor/customer master, business process data",
        "fetch_methods": "Dynamics 365 APIs, connectors, scheduled CSV/file import",
        "icon": "settings",
    },
    {
        "slug": "peoplesoft",
        "name": "PeopleSoft",
        "what_it_does": "HR, payroll, employee administration, enterprise data",
        "fetch_methods": "APIs, direct database queries, file-based imports",
        "icon": "folder",
    },
    {
        "slug": "servicenow",
        "name": "ServiceNow (ITSM)",
        "what_it_does": "IT tickets, incidents, change management, problem records, remediation tasks",
        "fetch_methods": "ServiceNow APIs, integration connectors, scheduled sync jobs",
        "icon": "support",
    },
    {
        "slug": "splunk_qradar",
        "name": "Splunk / QRadar (SIEM)",
        "what_it_does": "Security logs, alerts, threat events, monitoring data",
        "fetch_methods": "API-based alert feeds, SIEM connectors, event ingestion mappings",
        "icon": "security",
    },
    # Identity / Directory
    {
        "slug": "active-directory-entra",
        "name": "Active Directory (AD) / Azure Active Directory (Entra ID)",
        "what_it_does": "User identities, login credentials, groups, roles, access permissions, SSO/MFA policies",
        "fetch_methods": "LDAP/AD connectors, Microsoft Graph API (for Entra ID), scheduled exports",
        "icon": "people",
    },
    {
        "slug": "okta",
        "name": "Okta (IAM)",
        "what_it_does": "Single Sign-On (SSO), user authentication, MFA, app access assignments, identity lifecycle",
        "fetch_methods": "Okta APIs, integration platform sync, scheduled reports/imports",
        "icon": "people",
    },
    # Cloud
    {
        "slug": "aws",
        "name": "AWS (Cloud)",
        "what_it_does": "Cloud infrastructure services (servers, storage, databases), IAM roles, security configs, logs",
        "fetch_methods": "AWS APIs (SDK), CloudTrail/Security Hub feeds, middleware/integration connectors",
        "icon": "database",
    },
    {
        "slug": "azure",
        "name": "Microsoft Azure (Cloud)",
        "what_it_does": "Cloud resources, subscriptions, IAM roles, policies, security posture, activity logs",
        "fetch_methods": "Azure REST APIs, Microsoft Defender for Cloud exports, integration tools",
        "icon": "database",
    },
    {
        "slug": "gcp",
        "name": "Google Cloud Platform (GCP)",
        "what_it_does": "Cloud compute, storage, IAM access, policies, logs, resource inventory",
        "fetch_methods": "GCP APIs, audit log exports, connector/middleware integration",
        "icon": "database",
    },
    # Vulnerability management
    {
        "slug": "nessus-tenable",
        "name": "Nessus (Tenable)",
        "what_it_does": "Vulnerability scan results, CVEs, asset security posture, risk severity reports",
        "fetch_methods": "Scanner APIs, scheduled scan report import (CSV/XML), integration pipelines",
        "icon": "security",
    },
    {
        "slug": "qualys",
        "name": "Qualys",
        "what_it_does": "Vulnerability management, asset inventory, patch/security findings, compliance scan results",
        "fetch_methods": "Qualys APIs, automated report exports, scheduled integration sync",
        "icon": "security",
    },
    {
        "slug": "rapid7",
        "name": "Rapid7 (InsightVM / Nexpose)",
        "what_it_does": "Vulnerability assessment data, risk scores, asset exposure, remediation tracking",
        "fetch_methods": "Rapid7 APIs, scheduled exports/imports, middleware integration",
        "icon": "security",
    },
    # EDR / Endpoint / Microsoft security
    {
        "slug": "crowdstrike-falcon",
        "name": "CrowdStrike Falcon (EDR)",
        "what_it_does": "Endpoint security events, threat detections, device inventory, incident details",
        "fetch_methods": "CrowdStrike APIs, alert ingestion feeds, SIEM-to-Archer integration",
        "icon": "security",
    },
    {
        "slug": "microsoft-defender",
        "name": "Microsoft Defender (Endpoint / Identity / Cloud)",
        "what_it_does": "Threat alerts, endpoint security incidents, identity risk, security posture signals",
        "fetch_methods": "Microsoft Security APIs, Defender alert feeds, integration tools",
        "icon": "security",
    },
    # DLP / Compliance
    {
        "slug": "microsoft-purview",
        "name": "Microsoft Purview (DLP / Compliance)",
        "what_it_does": "Data loss prevention alerts, sensitive data labels, compliance policies, audit events",
        "fetch_methods": "Microsoft Purview APIs, M365 compliance export feeds, scheduled reporting imports",
        "icon": "folder",
    },
    {
        "slug": "symantec-dlp",
        "name": "Symantec DLP",
        "what_it_does": "DLP incidents, policy violations, sensitive data movement monitoring, user activity events",
        "fetch_methods": "APIs/connectors, incident export files, middleware-based sync",
        "icon": "security",
    },
]


class OEMAgentConfigUpdate(BaseModel):
    enabled: Optional[bool] = None
    api_base_url: Optional[str] = None
    auth_type: Optional[str] = None  # e.g. api_key, oauth2, basic
    schedule_cron: Optional[str] = None
    notes: Optional[str] = None


async def _ensure_oem_seed():
    """Ensure OEM agents exist in DB (seed if empty; add any new OEM_SEED entries)."""
    existing_slugs = set()
    async for a in db.oem_agents.find({}, {"slug": 1}):
        existing_slugs.add(a.get("slug"))
    for oem in OEM_SEED:
        slug = oem.get("slug")
        if slug and slug not in existing_slugs:
            doc = {
                **oem,
                "enabled": False,
                "config": {},
                "updated_at": datetime.utcnow(),
            }
            await db.oem_agents.insert_one(doc)
            existing_slugs.add(slug)


def _serialize_oem(doc):
    if not doc:
        return None
    d = dict(doc)
    d["id"] = str(d.pop("_id", ""))
    return d


@router.get("/oem-agents")
async def get_oem_agents(current_user: UserInDB = Depends(admin_only)):
    """List all OEM/partner integration agents (Archer-style)."""
    await _ensure_oem_seed()
    cursor = db.oem_agents.find({}).sort("slug", 1)
    agents = await cursor.to_list(length=100)
    return [_serialize_oem(a) for a in agents]


@router.get("/oem-agents/{slug}")
async def get_oem_agent(slug: str, current_user: UserInDB = Depends(admin_only)):
    """Get one OEM agent by slug."""
    await _ensure_oem_seed()
    doc = await db.oem_agents.find_one({"slug": slug})
    if not doc:
        raise HTTPException(status_code=404, detail="OEM agent not found")
    return _serialize_oem(doc)


@router.put("/oem-agents/{slug}")
async def update_oem_agent(slug: str, body: OEMAgentConfigUpdate, current_user: UserInDB = Depends(admin_only)):
    """Update OEM agent configuration (enable/disable, API URL, schedule, notes)."""
    doc = await db.oem_agents.find_one({"slug": slug})
    if not doc:
        raise HTTPException(status_code=404, detail="OEM agent not found")
    update = {"updated_at": datetime.utcnow()}
    if body.enabled is not None:
        update["enabled"] = body.enabled
    config = dict(doc.get("config") or {})
    if body.api_base_url is not None:
        config["api_base_url"] = body.api_base_url
    if body.auth_type is not None:
        config["auth_type"] = body.auth_type
    if body.schedule_cron is not None:
        config["schedule_cron"] = body.schedule_cron
    if body.notes is not None:
        config["notes"] = body.notes
    if config != (doc.get("config") or {}):
        update["config"] = config
    await db.oem_agents.update_one({"slug": slug}, {"$set": update})
    updated = await db.oem_agents.find_one({"slug": slug})
    return _serialize_oem(updated)


# ========== GPU INFO ==========
@router.get("/gpu-info")
async def get_gpu_info_endpoint(current_user: UserInDB = Depends(admin_only)):
    """Get GPU information and acceleration status"""
    try:
        gpu_info = get_gpu_info()
        return {
            "success": True,
            "gpu_info": gpu_info
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "gpu_info": {"device": "cpu", "gpu_available": False}
        }
