from datetime import datetime
from typing import Optional, Any, List
from pydantic import BaseModel, Field, GetJsonSchemaHandler
from pydantic.json_schema import JsonSchemaValue
from pydantic_core import core_schema
from bson import ObjectId
from enum import Enum

class PyObjectId(ObjectId):
    @classmethod
    def __get_pydantic_core_schema__(
        cls, source_type: Any, handler: Any
    ) -> core_schema.CoreSchema:
        def validate(value: Any) -> ObjectId:
            if isinstance(value, ObjectId):
                return value
            if isinstance(value, str):
                if ObjectId.is_valid(value):
                    return ObjectId(value)
                raise ValueError("Invalid ObjectId string")
            if isinstance(value, bytes):
                return ObjectId(value)
            raise ValueError("Invalid ObjectId")
        
        return core_schema.no_info_plain_validator_function(validate)

    @classmethod
    def __get_pydantic_json_schema__(
        cls, _core_schema: core_schema.CoreSchema, handler: GetJsonSchemaHandler
    ) -> JsonSchemaValue:
        return {"type": "string", "format": "objectid"}

class Role(str, Enum):
    ADMIN = "admin"
    USER = "user"

class ResponseStatus(str, Enum):
    YES = "Yes"
    NO = "No"

# User Models
class UserBase(BaseModel):
    username: str
    role: Role
    department_id: Optional[PyObjectId] = None
    is_senior: Optional[bool] = False

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: PyObjectId = Field(alias="_id")
    
    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

class UserInDB(UserResponse):
    password_hash: str

# Department Models
class DepartmentBase(BaseModel):
    name: str
    compliance_framework_ids: Optional[List[PyObjectId]] = []  # List of compliance frameworks this department belongs to

class DepartmentCreate(DepartmentBase):
    pass

class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    compliance_framework_ids: Optional[List[PyObjectId]] = None

class DepartmentResponse(DepartmentBase):
    id: PyObjectId = Field(alias="_id")
    
    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

# Compliance Framework Models
class ComplianceFrameworkBase(BaseModel):
    name: str  # e.g., "ISO 27001", "SOC 2", "GDPR", "HIPAA"
    description: Optional[str] = None
    version: Optional[str] = None  # e.g., "2022", "Type II"
    is_active: bool = True

class ComplianceFrameworkCreate(ComplianceFrameworkBase):
    pass

class ComplianceFrameworkUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    version: Optional[str] = None
    is_active: Optional[bool] = None

class ComplianceFrameworkResponse(ComplianceFrameworkBase):
    id: PyObjectId = Field(alias="_id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

# ISO Control Models (now supports multiple compliance frameworks)
class ISOControlBase(BaseModel):
    department_id: PyObjectId
    compliance_framework_id: PyObjectId  # References Compliance Framework
    control_id: str  # e.g., "A.9.2.1" for ISO 27001, "CC6.1" for SOC 2
    control_name: str  # e.g., "Access control"

class ISOControlCreate(BaseModel):
    department_id: PyObjectId
    compliance_framework_id: PyObjectId
    control_id: str
    control_name: str

class ISOControlUpdate(BaseModel):
    control_id: Optional[str] = None
    control_name: Optional[str] = None
    department_id: Optional[PyObjectId] = None
    compliance_framework_id: Optional[PyObjectId] = None

class ISOControlResponse(ISOControlBase):
    id: PyObjectId = Field(alias="_id")
    
    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

# Question Models
class QuestionBase(BaseModel):
    iso_control_id: PyObjectId  # References ISO Control, not department directly
    question_id: Optional[str] = None  # Sequential ID within control (a, b, c, ...)
    text: str

class QuestionCreate(BaseModel):
    control_id: str  # ISO Control ID (e.g., "A.9.2.1")
    control_name: str  # Control name (e.g., "Access control")
    department_id: PyObjectId  # Department ID to find/create the control
    compliance_framework_id: PyObjectId  # Compliance Framework ID
    text: str

class QuestionUpdate(BaseModel):
    text: Optional[str] = None
    control_id: Optional[str] = None  # ISO Control ID (e.g., "A.9.2.1")
    control_name: Optional[str] = None  # Control name (required if creating new control)
    department_id: Optional[PyObjectId] = None  # Required if control_id is provided
    compliance_framework_id: Optional[PyObjectId] = None  # Compliance Framework ID
    iso_control_id: Optional[PyObjectId] = None  # Alternative: direct ISO Control ObjectId

class QuestionResponse(QuestionBase):
    id: PyObjectId = Field(alias="_id")
    
    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

# Control Response Models (for control-level Yes/No)
class ControlResponseBase(BaseModel):
    iso_control_id: PyObjectId
    status: ResponseStatus  # Yes = control is being followed, No = not followed
    user_id: PyObjectId

class ControlResponseCreate(BaseModel):
    iso_control_id: PyObjectId
    status: ResponseStatus

class ControlResponseResponse(ControlResponseBase):
    id: PyObjectId = Field(alias="_id")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

# Response Models
class ResponseBase(BaseModel):
    question_id: PyObjectId
    status: ResponseStatus
    proof_url: Optional[str] = None

class ResponseCreate(ResponseBase):
    pass

class ResponseUpdate(BaseModel):
    status: Optional[ResponseStatus] = None
    proof_url: Optional[str] = None

class ResponseResponse(ResponseBase):
    id: PyObjectId = Field(alias="_id")
    user_id: PyObjectId
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

# Auth Models
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

# Dashboard Models
class DepartmentStats(BaseModel):
    department_id: PyObjectId
    department_name: str
    total_questions: int
    answered_questions: int
    completion_percentage: float
    compliance_framework_ids: Optional[List[PyObjectId]] = []
    compliance_frameworks: Optional[List[dict]] = []  # Framework details with name, version
    
    class Config:
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

# Policy Models
class PolicyBase(BaseModel):
    name: str = Field(..., min_length=1)
    description: Optional[str] = None
    department_id: PyObjectId
    file_url: str
    file_name: str
    file_size: Optional[int] = None
    file_type: Optional[str] = None

class PolicyCreate(BaseModel):
    name: str = Field(..., min_length=1)
    description: Optional[str] = None
    department_id: PyObjectId

class PolicyUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    department_id: Optional[PyObjectId] = None

class PolicyResponse(PolicyBase):
    id: PyObjectId = Field(alias="_id")
    uploaded_by: PyObjectId
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

# Agent Models
class AgentBase(BaseModel):
    name: str = Field(..., min_length=1)
    description: Optional[str] = None
    department_id: Optional[PyObjectId] = None
    status: Optional[str] = "active"  # active, inactive

class AgentCreate(AgentBase):
    pass

class AgentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    department_id: Optional[PyObjectId] = None
    status: Optional[str] = None

class AgentResponse(AgentBase):
    id: PyObjectId = Field(alias="_id")
    created_by: PyObjectId
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None
    
    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

# Chat Models
class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str

class ChatRequest(BaseModel):
    message: str
    conversation_history: Optional[List[ChatMessage]] = []
    image_base64: Optional[str] = None  # Base64 encoded image (for JSON requests)
    extracted_text_from_image: Optional[str] = None  # Pre-extracted text from image

class ChatResponse(BaseModel):
    response: str
    conversation_history: List[ChatMessage]

# Task Models
class TaskStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"

class TaskPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"

class ProofApprovalStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"

class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    status: TaskStatus = TaskStatus.PENDING
    priority: TaskPriority = TaskPriority.MEDIUM
    assigned_to_user_id: Optional[PyObjectId] = None
    due_date: Optional[datetime] = None
    # Proof approval fields
    response_id: Optional[PyObjectId] = None
    question_id: Optional[PyObjectId] = None
    proof_url: Optional[str] = None
    approval_status: Optional[ProofApprovalStatus] = None
    submitted_by_user_id: Optional[PyObjectId] = None

class TaskCreate(TaskBase):
    pass

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    assigned_to_user_id: Optional[PyObjectId] = None
    due_date: Optional[datetime] = None
    approval_status: Optional[ProofApprovalStatus] = None

class TaskResponse(TaskBase):
    id: PyObjectId = Field(alias="_id")
    created_by_user_id: PyObjectId
    department_id: PyObjectId
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}

# Proof Approval Models
class ProofApprovalRequest(BaseModel):
    response_id: str
    approval_status: ProofApprovalStatus
    comments: Optional[str] = None

# Notification Models
class NotificationType(str, Enum):
    PROOF_REJECTED = "proof_rejected"
    PROOF_APPROVED = "proof_approved"
    TASK_ASSIGNED = "task_assigned"
    GENERAL = "general"

class NotificationBase(BaseModel):
    user_id: PyObjectId
    type: NotificationType
    title: str
    message: str
    is_read: bool = False
    response_id: Optional[PyObjectId] = None
    task_id: Optional[PyObjectId] = None
    related_data: Optional[dict] = None  # For storing additional context like rejection comments

class NotificationCreate(BaseModel):
    user_id: str
    type: NotificationType
    title: str
    message: str
    response_id: Optional[str] = None
    task_id: Optional[str] = None
    related_data: Optional[dict] = None

class NotificationUpdate(BaseModel):
    is_read: Optional[bool] = None

class NotificationResponse(NotificationBase):
    id: PyObjectId = Field(alias="_id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}