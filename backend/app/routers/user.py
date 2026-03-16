from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from typing import List, Optional
from datetime import datetime
import os
import uuid
from pathlib import Path
from app.auth import get_current_active_user
from app.database import db
from app.models import (
    UserInDB, QuestionResponse, ResponseCreate, ResponseResponse, ResponseUpdate, ResponseStatus,
    ISOControlResponse, ControlResponseCreate, ControlResponseResponse, DepartmentStats, UserResponse,
    TaskCreate, TaskResponse, TaskUpdate, TaskStatus, TaskPriority, ProofApprovalStatus, ProofApprovalRequest,
    NotificationCreate, NotificationResponse, NotificationUpdate, NotificationType
)
from bson import ObjectId
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
Path(UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
async def create_proof_approval_task(
    response_id: ObjectId,
    question_id: ObjectId,
    proof_url: str,
    submitted_by_user_id: ObjectId,
    department_id: ObjectId
):
    """Create a task for senior users to approve a proof"""
    # Find senior users in the department
    senior_users = await db.users.find({
        "department_id": department_id,
        "is_senior": True
    }).to_list(length=100)
    
    if not senior_users:
        # No senior users found, skip task creation
        return None
    
    # Get question text for task description
    question = await db.questions.find_one({"_id": question_id})
    question_text = question.get("text", "Question") if question else "Question"
    
    # Get user who submitted the proof
    submitting_user = await db.users.find_one({"_id": submitted_by_user_id})
    submitting_username = submitting_user.get("username", "User") if submitting_user else "User"
    
    # Create task for the first senior user
    senior_user_id = ObjectId(senior_users[0]["_id"])
    
    task_dict = {
        "title": f"Proof Approval Required: {question_text[:50]}...",
        "description": f"User {submitting_username} has submitted a proof for the following question:\n\n{question_text}\n\nPlease review and approve or reject the proof.",
        "status": TaskStatus.PENDING.value,
        "priority": TaskPriority.MEDIUM.value,
        "assigned_to_user_id": senior_user_id,
        "due_date": None,
        "response_id": response_id,
        "question_id": question_id,
        "proof_url": proof_url,
        "approval_status": ProofApprovalStatus.PENDING.value,
        "submitted_by_user_id": submitted_by_user_id,
        "created_by_user_id": submitted_by_user_id,
        "department_id": department_id,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    # Check if task already exists for this response
    existing_task = await db.tasks.find_one({
        "response_id": response_id,
        "approval_status": ProofApprovalStatus.PENDING.value
    })
    
    if existing_task:
        # Update existing task if proof URL changed
        await db.tasks.update_one(
            {"_id": existing_task["_id"]},
            {"$set": {
                "proof_url": proof_url,
                "updated_at": datetime.utcnow()
            }}
        )
        return existing_task["_id"]
    else:
        # Create new task
        result = await db.tasks.insert_one(task_dict)
        return result.inserted_id



# ========== ISO CONTROLS ==========
@router.get("/iso-controls", response_model=List[ISOControlResponse])
async def get_my_iso_controls(
    compliance_framework_id: Optional[str] = None,
    current_user: UserInDB = Depends(get_current_active_user)
):
    """Get ISO controls for the current user's department, optionally filtered by compliance framework"""
    if not current_user.department_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not assigned to a department"
        )
    
    # Build query
    query = {"department_id": ObjectId(current_user.department_id)}
    if compliance_framework_id:
        query["compliance_framework_id"] = ObjectId(compliance_framework_id)
    
    # Get all ISO controls for user's department
    iso_controls = await db.iso_controls.find(query).to_list(length=1000)
    
    return [ISOControlResponse(**c) for c in iso_controls]

# ========== CONTROL RESPONSES ==========
@router.post("/control-responses", response_model=ControlResponseResponse, status_code=status.HTTP_201_CREATED)
async def create_control_response(
    control_response: ControlResponseCreate,
    current_user: UserInDB = Depends(get_current_active_user)
):
    """Create or update a control-level response (Is this control being followed?)"""
    if not current_user.department_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not assigned to a department"
        )
    
    # Validate ISO control exists and belongs to user's department
    try:
        iso_control_id_obj = ObjectId(control_response.iso_control_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid ISO Control ID format")
    
    iso_control = await db.iso_controls.find_one({"_id": iso_control_id_obj})
    if not iso_control:
        raise HTTPException(status_code=404, detail="ISO Control not found")
    
    if iso_control["department_id"] != ObjectId(current_user.department_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="ISO Control does not belong to your department"
        )
    
    # Check if control response already exists
    existing = await db.control_responses.find_one({
        "iso_control_id": iso_control_id_obj,
        "user_id": ObjectId(current_user.id)
    })
    
    if existing:
        # Update existing
        await db.control_responses.update_one(
            {"_id": existing["_id"]},
            {"$set": {"status": control_response.status.value}}
        )
        updated = await db.control_responses.find_one({"_id": existing["_id"]})
        return ControlResponseResponse(**updated)
    else:
        # Create new
        response_dict = {
            "iso_control_id": iso_control_id_obj,
            "user_id": ObjectId(current_user.id),
            "status": control_response.status.value
        }
        result = await db.control_responses.insert_one(response_dict)
        response_dict["_id"] = result.inserted_id
        return ControlResponseResponse(**response_dict)

@router.get("/control-responses", response_model=List[ControlResponseResponse])
async def get_my_control_responses(current_user: UserInDB = Depends(get_current_active_user)):
    """Get all control responses by the current user"""
    responses = await db.control_responses.find(
        {"user_id": ObjectId(current_user.id)}
    ).to_list(length=1000)
    
    return [ControlResponseResponse(**r) for r in responses]

# ========== QUESTIONS ==========
@router.get("/questions", response_model=List[QuestionResponse])
async def get_my_questions(
    iso_control_id: Optional[str] = None,
    compliance_framework_id: Optional[str] = None,
    current_user: UserInDB = Depends(get_current_active_user)
):
    """Get questions for the current user's department, optionally filtered by ISO control or compliance framework"""
    if not current_user.department_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not assigned to a department"
        )
    
    # Get all ISO controls for user's department
    query = {"department_id": ObjectId(current_user.department_id)}
    if iso_control_id:
        query["_id"] = ObjectId(iso_control_id)
    if compliance_framework_id:
        query["compliance_framework_id"] = ObjectId(compliance_framework_id)
    
    iso_controls = await db.iso_controls.find(query).distinct("_id")
    
    if not iso_controls:
        return []
    
    # Get all questions for these ISO controls
    question_query = {"iso_control_id": {"$in": iso_controls}}
    if compliance_framework_id:
        question_query["compliance_framework_id"] = ObjectId(compliance_framework_id)
    
    questions = await db.questions.find(question_query).to_list(length=1000)
    
    return [QuestionResponse(**q) for q in questions]

# ========== RESPONSES ==========
@router.post("/responses", response_model=ResponseResponse, status_code=status.HTTP_201_CREATED)
async def create_response(
    response: ResponseCreate,
    current_user: UserInDB = Depends(get_current_active_user)
):
    """Create or update a response to a question"""
    if not current_user.department_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not assigned to a department"
        )
    
    # Validate question exists and belongs to user's department (through ISO control)
    try:
        question_id_obj = ObjectId(response.question_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid Question ID format")
    
    question = await db.questions.find_one({"_id": question_id_obj})
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    
    # Get the ISO control for this question
    iso_control = await db.iso_controls.find_one({"_id": ObjectId(question["iso_control_id"])})
    if not iso_control:
        raise HTTPException(status_code=404, detail="ISO Control not found for this question")
    
    # Check if ISO control belongs to user's department
    if iso_control["department_id"] != ObjectId(current_user.department_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Question does not belong to your department"
        )
    
    # Validate: If status is "Yes", proof_url must be provided (unless updating existing with proof)
    if response.status == ResponseStatus.YES and not response.proof_url:
        # Check if there's an existing response with proof_url
        existing_check = await db.responses.find_one({
            "question_id": question_id_obj,
            "user_id": ObjectId(current_user.id)
        })
        if not existing_check or not existing_check.get("proof_url"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Proof file is required when answer is 'Yes'"
            )
    
    # Check if response already exists
    existing_response = await db.responses.find_one({
        "question_id": question_id_obj,
        "user_id": ObjectId(current_user.id)
    })
    
    if existing_response:
        # Update existing response
        update_dict = {
            "status": response.status.value,
            "proof_url": response.proof_url
        }
        await db.responses.update_one(
            {"_id": existing_response["_id"]},
            {"$set": update_dict}
        )
        updated_response = await db.responses.find_one({"_id": existing_response["_id"]})
        # Create/update task for senior users if proof is uploaded
        if response.proof_url:
            await create_proof_approval_task(
                response_id=existing_response["_id"],
                question_id=question_id_obj,
                proof_url=response.proof_url,
                submitted_by_user_id=ObjectId(current_user.id),
                department_id=ObjectId(current_user.department_id)
            )
        return ResponseResponse(**updated_response)
    else:
        # Create new response
        response_dict = {
            "question_id": question_id_obj,
            "user_id": ObjectId(current_user.id),
            "status": response.status.value,
            "proof_url": response.proof_url,
            "timestamp": datetime.utcnow()
        }
        result = await db.responses.insert_one(response_dict)
        # Create task for senior users if proof is uploaded
        if response.proof_url:
            await create_proof_approval_task(
                response_id=response_dict["_id"],
                question_id=question_id_obj,
                proof_url=response.proof_url,
                submitted_by_user_id=ObjectId(current_user.id),
                department_id=ObjectId(current_user.department_id)
            )

        response_dict["_id"] = result.inserted_id
        return ResponseResponse(**response_dict)

@router.put("/responses/{response_id}", response_model=ResponseResponse)
async def update_response(
    response_id: str,
    response_update: ResponseUpdate,
    current_user: UserInDB = Depends(get_current_active_user)
):
    """Update an existing response"""
    # Get existing response
    existing_response = await db.responses.find_one({"_id": ObjectId(response_id)})
    if not existing_response:
        raise HTTPException(status_code=404, detail="Response not found")
    
    # Verify ownership
    if existing_response["user_id"] != ObjectId(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your own responses"
        )
    
    # Validate: If status is "Yes", proof_url must be provided
    new_status = response_update.status or ResponseStatus(existing_response["status"])
    if new_status == ResponseStatus.YES and not response_update.proof_url and not existing_response.get("proof_url"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Proof file is required when answer is 'Yes'"
        )
    
    update_dict = {}
    if response_update.status is not None:
        update_dict["status"] = response_update.status.value
    if response_update.proof_url is not None:
        update_dict["proof_url"] = response_update.proof_url
    
    if update_dict:
        await db.responses.update_one(
            {"_id": ObjectId(response_id)},
            {"$set": update_dict}
        )
    
    updated_response = await db.responses.find_one({"_id": ObjectId(response_id)})
    # Create/update task for senior users if proof is uploaded
    if response_update.proof_url and updated_response:
        await create_proof_approval_task(
            response_id=ObjectId(response_id),
            question_id=ObjectId(updated_response["question_id"]),
            proof_url=response_update.proof_url,
            submitted_by_user_id=ObjectId(current_user.id),
            department_id=ObjectId(current_user.department_id)
        )
    return ResponseResponse(**updated_response)

@router.get("/responses", response_model=List[ResponseResponse])
async def get_my_responses(current_user: UserInDB = Depends(get_current_active_user)):
    """Get all responses by the current user"""
    responses = await db.responses.find(
        {"user_id": ObjectId(current_user.id)}
    ).to_list(length=10000)
    
    # Ensure timestamp is set for responses that don't have it (migration for old data)
    for r in responses:
        if r.get("timestamp") is None:
            r["timestamp"] = datetime.utcnow()
    
    return [ResponseResponse(**r) for r in responses]

@router.get("/responses/{response_id}", response_model=ResponseResponse)
async def get_response(
    response_id: str,
    current_user: UserInDB = Depends(get_current_active_user)
):
    """Get a specific response"""
    response = await db.responses.find_one({"_id": ObjectId(response_id)})
    if not response:
        raise HTTPException(status_code=404, detail="Response not found")
    
    # Verify ownership
    if response["user_id"] != ObjectId(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view your own responses"
        )
    
    return ResponseResponse(**response)

# ========== FILE UPLOAD ==========
@router.post("/upload-proof")
async def upload_proof(
    file: UploadFile = File(...),
    current_user: UserInDB = Depends(get_current_active_user)
):
    """Upload a proof file (supports PDF, images, documents, etc.)"""
    # Validate file type (allow common document formats)
    allowed_extensions = {'.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.gif', '.txt', '.xls', '.xlsx', '.csv'}
    file_extension = os.path.splitext(file.filename)[1].lower()
    
    if file_extension not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type not allowed. Allowed types: {', '.join(allowed_extensions)}"
        )
    
    # Check file size (max 10MB) and read content
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
    file_content = await file.read()
    
    if len(file_content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size exceeds maximum limit of 10MB"
        )
    
    # Generate unique filename
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    # Ensure upload directory exists
    Path(UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
    
    # Save file using the already-read content
    try:
        with open(file_path, "wb") as buffer:
            buffer.write(file_content)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save file: {str(e)}"
        )
    
    # Return the file path (relative to uploads directory)
    return {"proof_url": file_path, "filename": file.filename}

@router.get("/responses/{response_id}/proof")
async def download_proof(
    response_id: str,
    current_user: UserInDB = Depends(get_current_active_user)
):
    """Download proof file for own response or for senior users reviewing approvals"""
    from fastapi.responses import FileResponse
    
    response = await db.responses.find_one({"_id": ObjectId(response_id)})
    if not response:
        raise HTTPException(status_code=404, detail="Response not found")
    
    # Check if user is senior and has a pending approval task for this response
    is_senior = current_user.is_senior if hasattr(current_user, 'is_senior') else False
    can_access = False
    
    if response["user_id"] == ObjectId(current_user.id):
        # User owns the response
        can_access = True
    elif is_senior and current_user.department_id:
        # Check if senior user has a pending approval task for this response
        task = await db.tasks.find_one({
            "response_id": ObjectId(response_id),
            "department_id": ObjectId(current_user.department_id),
            "approval_status": ProofApprovalStatus.PENDING.value
        })
        if task:
            can_access = True
    
    if not can_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only download your own proof files or proofs pending your approval"
        )
    
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

# ========== SENIOR USER DASHBOARD ==========
@router.get("/dashboard/stats", response_model=DepartmentStats)
async def get_department_stats(current_user: UserInDB = Depends(get_current_active_user)):
    """Get dashboard statistics for senior user's department"""
    if not current_user.department_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not assigned to a department"
        )
    
    dept_id = ObjectId(current_user.department_id)
    
    # Get department name
    dept = await db.departments.find_one({"_id": dept_id})
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    
    dept_name = dept["name"]
    
    # Get all ISO controls for this department
    iso_controls = await db.iso_controls.find(
        {"department_id": dept_id}
    ).distinct("_id")
    
    # Count total questions for this department (through ISO controls)
    total_questions = await db.questions.count_documents(
        {"iso_control_id": {"$in": iso_controls}}
    )
    
    # Count answered questions (responses exist) - count all users in the department
    question_ids = await db.questions.find(
        {"iso_control_id": {"$in": iso_controls}}
    ).distinct("_id")
    
    # Get all users in this department
    dept_users = await db.users.find(
        {"department_id": dept_id}
    ).distinct("_id")
    
    answered_questions = await db.responses.count_documents(
        {"question_id": {"$in": question_ids}, "user_id": {"$in": dept_users}}
    ) if question_ids and dept_users else 0
    
    completion_percentage = (
        (answered_questions / total_questions * 100) if total_questions > 0 else 0
    )
    
    return DepartmentStats(
        department_id=dept_id,
        department_name=dept_name,
        total_questions=total_questions,
        answered_questions=answered_questions,
        completion_percentage=round(completion_percentage, 2)
    )

@router.get("/department/users", response_model=List[UserResponse])
async def get_department_users(current_user: UserInDB = Depends(get_current_active_user)):
    """Get all users in the senior user's department"""
    if not current_user.department_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not assigned to a department"
        )
    
    dept_id = ObjectId(current_user.department_id)
    
    # Get all users in this department (excluding password_hash)
    users = await db.users.find(
        {"department_id": dept_id},
        {"password_hash": 0}  # Exclude password hash
    ).to_list(length=1000)
    
    # Ensure is_senior field exists for all users
    for user in users:
        if 'is_senior' not in user:
            user['is_senior'] = False
    
    return [UserResponse(**user) for user in users]

# ========== TASKS MANAGEMENT ==========
@router.post("/tasks", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    task: TaskCreate,
    current_user: UserInDB = Depends(get_current_active_user)
):
    """Create a new task (Senior users only)"""
    # Check if user is senior
    is_senior = current_user.is_senior if hasattr(current_user, 'is_senior') else False
    if not is_senior:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only senior users can create tasks"
        )
    
    if not current_user.department_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not assigned to a department"
        )
    
    dept_id = ObjectId(current_user.department_id)
    
    # Validate assigned user if provided
    if task.assigned_to_user_id:
        assigned_user = await db.users.find_one({"_id": ObjectId(task.assigned_to_user_id)})
        if not assigned_user:
            raise HTTPException(status_code=404, detail="Assigned user not found")
        if assigned_user.get("department_id") != dept_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Assigned user must be in the same department"
            )
    
    task_dict = {
        "title": task.title,
        "description": task.description,
        "status": task.status.value,
        "priority": task.priority.value,
        "assigned_to_user_id": ObjectId(task.assigned_to_user_id) if task.assigned_to_user_id else None,
        "due_date": task.due_date,
        "created_by_user_id": ObjectId(current_user.id),
        "department_id": dept_id,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    result = await db.tasks.insert_one(task_dict)
    task_dict["_id"] = result.inserted_id
    return TaskResponse(**task_dict)

@router.get("/tasks", response_model=List[TaskResponse])
async def get_tasks(current_user: UserInDB = Depends(get_current_active_user)):
    """Get all tasks for senior user's department"""
    # Check if user is senior
    is_senior = current_user.is_senior if hasattr(current_user, 'is_senior') else False
    if not is_senior:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only senior users can view tasks"
        )
    
    if not current_user.department_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not assigned to a department"
        )
    
    dept_id = ObjectId(current_user.department_id)
    
    tasks = await db.tasks.find({"department_id": dept_id}).sort("created_at", -1).to_list(length=1000)
    return [TaskResponse(**task) for task in tasks]

@router.put("/tasks/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: str,
    task_update: TaskUpdate,
    current_user: UserInDB = Depends(get_current_active_user)
):
    """Update a task (Senior users only)"""
    # Check if user is senior
    is_senior = current_user.is_senior if hasattr(current_user, 'is_senior') else False
    if not is_senior:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only senior users can update tasks"
        )
    
    task = await db.tasks.find_one({"_id": ObjectId(task_id)})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Verify task belongs to user's department
    if task["department_id"] != ObjectId(current_user.department_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Task does not belong to your department"
        )
    
    # Validate assigned user if provided
    if task_update.assigned_to_user_id:
        assigned_user = await db.users.find_one({"_id": ObjectId(task_update.assigned_to_user_id)})
        if not assigned_user:
            raise HTTPException(status_code=404, detail="Assigned user not found")
        if assigned_user.get("department_id") != ObjectId(current_user.department_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Assigned user must be in the same department"
            )
    
    update_dict = {"updated_at": datetime.utcnow()}
    if task_update.title is not None:
        update_dict["title"] = task_update.title
    if task_update.description is not None:
        update_dict["description"] = task_update.description
    if task_update.status is not None:
        update_dict["status"] = task_update.status.value
    if task_update.priority is not None:
        update_dict["priority"] = task_update.priority.value
    if task_update.assigned_to_user_id is not None:
        update_dict["assigned_to_user_id"] = ObjectId(task_update.assigned_to_user_id) if task_update.assigned_to_user_id else None
    if task_update.due_date is not None:
        update_dict["due_date"] = task_update.due_date
    
    await db.tasks.update_one({"_id": ObjectId(task_id)}, {"$set": update_dict})
    updated_task = await db.tasks.find_one({"_id": ObjectId(task_id)})
    return TaskResponse(**updated_task)

@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: str,
    current_user: UserInDB = Depends(get_current_active_user)
):
    """Delete a task (Senior users only)"""
    # Check if user is senior
    is_senior = current_user.is_senior if hasattr(current_user, 'is_senior') else False
    if not is_senior:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only senior users can delete tasks"
        )
    
    task = await db.tasks.find_one({"_id": ObjectId(task_id)})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Verify task belongs to user's department
    if task["department_id"] != ObjectId(current_user.department_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Task does not belong to your department"
        )
    
    await db.tasks.delete_one({"_id": ObjectId(task_id)})
    return None

# ========== PROOF APPROVAL ==========
@router.get("/proof-approvals", response_model=List[TaskResponse])
async def get_pending_proof_approvals(current_user: UserInDB = Depends(get_current_active_user)):
    """Get all pending proof approvals for senior user's department"""
    # Check if user is senior
    is_senior = current_user.is_senior if hasattr(current_user, 'is_senior') else False
    if not is_senior:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only senior users can view proof approvals"
        )
    
    if not current_user.department_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not assigned to a department"
        )
    
    dept_id = ObjectId(current_user.department_id)
    
    # Get all tasks with pending proof approvals in the department
    tasks = await db.tasks.find({
        "department_id": dept_id,
        "approval_status": ProofApprovalStatus.PENDING.value,
        "response_id": {"$ne": None}  # Only tasks related to proof approvals
    }).sort("created_at", -1).to_list(length=1000)
    
    return [TaskResponse(**task) for task in tasks]

@router.post("/proof-approvals/{task_id}/approve", response_model=TaskResponse)
async def approve_proof(
    task_id: str,
    approval_request: ProofApprovalRequest,
    current_user: UserInDB = Depends(get_current_active_user)
):
    """Approve or reject a proof (Senior users only)"""
    # Check if user is senior
    is_senior = current_user.is_senior if hasattr(current_user, 'is_senior') else False
    if not is_senior:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only senior users can approve proofs"
        )
    
    # Get the task
    task = await db.tasks.find_one({"_id": ObjectId(task_id)})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Verify task belongs to user's department
    if task["department_id"] != ObjectId(current_user.department_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Task does not belong to your department"
        )
    
    # Verify it's a proof approval task
    if not task.get("response_id") or task.get("approval_status") != ProofApprovalStatus.PENDING.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This is not a pending proof approval task"
        )
    
    # Verify response_id matches
    if str(task["response_id"]) != approval_request.response_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Response ID does not match the task"
        )
    
    # Update task with approval status
    update_dict = {
        "approval_status": approval_request.approval_status.value,
        "status": TaskStatus.COMPLETED.value if approval_request.approval_status != ProofApprovalStatus.PENDING else TaskStatus.PENDING.value,
        "updated_at": datetime.utcnow()
    }
    
    # Add comments to description if provided
    if approval_request.comments:
        current_description = task.get("description", "")
        update_dict["description"] = f"{current_description}\n\nSenior User Comments: {approval_request.comments}"
    
    await db.tasks.update_one(
        {"_id": ObjectId(task_id)},
        {"$set": update_dict}
    )
    
    # Create notification for the user who submitted the proof if rejected
    if approval_request.approval_status == ProofApprovalStatus.REJECTED and task.get("submitted_by_user_id"):
        # Get question and response details for notification
        response = await db.responses.find_one({"_id": ObjectId(approval_request.response_id)})
        question = None
        if response:
            question = await db.questions.find_one({"_id": ObjectId(response["question_id"])})
        
        question_text = question.get("text", "Question") if question else "Question"
        notification_dict = {
            "user_id": ObjectId(task["submitted_by_user_id"]),
            "type": NotificationType.PROOF_REJECTED.value,
            "title": "Proof Rejected",
            "message": f"Your proof for the question '{question_text[:100]}...' has been rejected.",
            "is_read": False,
            "response_id": ObjectId(approval_request.response_id),
            "task_id": ObjectId(task_id),
            "related_data": {
                "question_text": question_text,
                "rejection_comments": approval_request.comments or "",
                "question_id": str(response["question_id"]) if response else None
            },
            "created_at": datetime.utcnow()
        }
        await db.notifications.insert_one(notification_dict)
    
    # Create notification for the user who submitted the proof if rejected
    if approval_request.approval_status == ProofApprovalStatus.REJECTED and task.get("submitted_by_user_id"):
        # Get question and response details for notification
        response = await db.responses.find_one({"_id": ObjectId(approval_request.response_id)})
        question = None
        if response:
            question = await db.questions.find_one({"_id": ObjectId(response["question_id"])})
        
        question_text = question.get("text", "Question") if question else "Question"
        notification_dict = {
            "user_id": ObjectId(task["submitted_by_user_id"]),
            "type": NotificationType.PROOF_REJECTED.value,
            "title": "Proof Rejected",
            "message": f"Your proof for the question '{question_text[:100]}...' has been rejected.",
            "is_read": False,
            "response_id": ObjectId(approval_request.response_id),
            "task_id": ObjectId(task_id),
            "related_data": {
                "question_text": question_text,
                "rejection_comments": approval_request.comments or "",
                "question_id": str(response["question_id"]) if response else None
            },
            "created_at": datetime.utcnow()
        }
        await db.notifications.insert_one(notification_dict)
    
    # Update the response if approved/rejected (optional - you might want to add an approval_status field to responses)
    updated_task = await db.tasks.find_one({"_id": ObjectId(task_id)})
    return TaskResponse(**updated_task)

# ========== NOTIFICATIONS ==========
@router.get("/notifications", response_model=List[NotificationResponse])
async def get_my_notifications(current_user: UserInDB = Depends(get_current_active_user)):
    """Get all notifications for the current user"""
    notifications = await db.notifications.find(
        {"user_id": ObjectId(current_user.id)}
    ).sort("created_at", -1).to_list(length=1000)
    
    return [NotificationResponse(**n) for n in notifications]

@router.get("/notifications/unread", response_model=List[NotificationResponse])
async def get_unread_notifications(current_user: UserInDB = Depends(get_current_active_user)):
    """Get unread notifications for the current user"""
    notifications = await db.notifications.find(
        {"user_id": ObjectId(current_user.id), "is_read": False}
    ).sort("created_at", -1).to_list(length=1000)
    
    return [NotificationResponse(**n) for n in notifications]

@router.get("/notifications/unread/count")
async def get_unread_notifications_count(current_user: UserInDB = Depends(get_current_active_user)):
    """Get count of unread notifications for the current user"""
    count = await db.notifications.count_documents(
        {"user_id": ObjectId(current_user.id), "is_read": False}
    )
    return {"count": count}

@router.put("/notifications/{notification_id}", response_model=NotificationResponse)
async def update_notification(
    notification_id: str,
    notification_update: NotificationUpdate,
    current_user: UserInDB = Depends(get_current_active_user)
):
    """Update a notification (mark as read/unread)"""
    notification = await db.notifications.find_one({"_id": ObjectId(notification_id)})
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    # Verify ownership
    if notification["user_id"] != ObjectId(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your own notifications"
        )
    
    update_dict = {}
    if notification_update.is_read is not None:
        update_dict["is_read"] = notification_update.is_read
    
    if update_dict:
        await db.notifications.update_one(
            {"_id": ObjectId(notification_id)},
            {"$set": update_dict}
        )
    
    updated_notification = await db.notifications.find_one({"_id": ObjectId(notification_id)})
    return NotificationResponse(**updated_notification)

@router.put("/notifications/mark-all-read", status_code=status.HTTP_200_OK)
async def mark_all_notifications_read(current_user: UserInDB = Depends(get_current_active_user)):
    """Mark all notifications as read for the current user"""
    await db.notifications.update_many(
        {"user_id": ObjectId(current_user.id), "is_read": False},
        {"$set": {"is_read": True}}
    )
    return {"message": "All notifications marked as read"}