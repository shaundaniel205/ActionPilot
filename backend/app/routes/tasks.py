from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from app.auth import get_current_user
from app.database import TaskRepository
from app.scheduler import calculate_schedule, compress_schedule_durations, parse_iso_datetime

router = APIRouter(prefix="/api/tasks", tags=["tasks"])

class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = ""
    priority: str = Field("medium", pattern="^(low|medium|high)$")
    deadline: str  # ISO string
    available_hours: float = Field(1.0, gt=0)

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = Field(None, pattern="^(low|medium|high)$")
    deadline: Optional[str] = None
    available_hours: Optional[float] = Field(None, gt=0)
    completed: Optional[bool] = None

class RecalculateRequest(BaseModel):
    current_time: Optional[str] = None
    low_priority_factor: Optional[float] = 0.70
    medium_priority_factor: Optional[float] = 0.85

@router.get("")
def get_tasks(
    current_time: Optional[str] = Query(None, description="User's local time in ISO format"),
    user_id: str = Depends(get_current_user)
):
    """
    Get all tasks for the authenticated user, calculated schedule, risks, and insights.
    """
    tasks = TaskRepository.list_tasks(user_id)
    
    # Parse current time or default to UTC now
    if current_time:
        start_dt = parse_iso_datetime(current_time)
    else:
        start_dt = datetime.now(timezone.utc)
        
    scheduled_tasks, insights = calculate_schedule(tasks, start_dt)
    
    return {
        "tasks": scheduled_tasks,
        "insights": insights
    }

@router.post("")
def create_task(
    task_data: TaskCreate,
    current_time: Optional[str] = Query(None),
    user_id: str = Depends(get_current_user)
):
    """
    Create a new task for the authenticated user.
    """
    try:
        # Validate deadline format
        parse_iso_datetime(task_data.deadline)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid deadline ISO format."
        )
        
    new_task = TaskRepository.create_task(user_id, task_data.model_dump())
    
    # Recalculate schedule after insertion
    tasks = TaskRepository.list_tasks(user_id)
    if current_time:
        start_dt = parse_iso_datetime(current_time)
    else:
        start_dt = datetime.now(timezone.utc)
        
    scheduled_tasks, insights = calculate_schedule(tasks, start_dt)
    
    return {
        "task": new_task,
        "tasks": scheduled_tasks,
        "insights": insights
    }

@router.put("/{task_id}")
def update_task(
    task_id: str,
    task_data: TaskUpdate,
    current_time: Optional[str] = Query(None),
    user_id: str = Depends(get_current_user)
):
    """
    Update a task (e.g. edit fields, check off as completed).
    """
    if task_data.deadline:
        try:
            parse_iso_datetime(task_data.deadline)
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid deadline ISO format."
            )
            
    updated = TaskRepository.update_task(user_id, task_id, task_data.model_dump(exclude_unset=True))
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found or unauthorized."
        )
        
    # Recalculate schedule
    tasks = TaskRepository.list_tasks(user_id)
    if current_time:
        start_dt = parse_iso_datetime(current_time)
    else:
        start_dt = datetime.now(timezone.utc)
        
    scheduled_tasks, insights = calculate_schedule(tasks, start_dt)
    
    return {
        "task": updated,
        "tasks": scheduled_tasks,
        "insights": insights
    }

@router.delete("/{task_id}")
def delete_task(
    task_id: str,
    current_time: Optional[str] = Query(None),
    user_id: str = Depends(get_current_user)
):
    """
    Delete a task.
    """
    deleted = TaskRepository.delete_task(user_id, task_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found or unauthorized."
        )
        
    # Recalculate schedule
    tasks = TaskRepository.list_tasks(user_id)
    if current_time:
        start_dt = parse_iso_datetime(current_time)
    else:
        start_dt = datetime.now(timezone.utc)
        
    scheduled_tasks, insights = calculate_schedule(tasks, start_dt)
    
    return {
        "success": True,
        "tasks": scheduled_tasks,
        "insights": insights
    }

@router.post("/recalculate")
def recalculate_behind(
    req: RecalculateRequest,
    user_id: str = Depends(get_current_user)
):
    """
    Recalculates the schedule when user is behind:
    1. Compresses task estimates for all uncompleted tasks (Low -> 70%, Medium -> 85%).
    2. Persists compressed values to the database.
    3. Generates the updated schedule and recommendations.
    """
    tasks = TaskRepository.list_tasks(user_id)
    
    # Compress active tasks
    compressed_tasks = compress_schedule_durations(
        tasks,
        low_priority_factor=req.low_priority_factor or 0.70,
        medium_priority_factor=req.medium_priority_factor or 0.85
    )
    
    # Persist the compressed estimates to SQLite/Supabase
    for c_task in compressed_tasks:
        if not c_task.get("completed"):
            TaskRepository.update_task(
                user_id, 
                c_task["id"], 
                {"available_hours": c_task["available_hours"]}
            )
            
    # Re-fetch from DB to get clean, updated records
    updated_tasks = TaskRepository.list_tasks(user_id)
    
    # Parse starting time
    if req.current_time:
        start_dt = parse_iso_datetime(req.current_time)
    else:
        start_dt = datetime.now(timezone.utc)
        
    scheduled_tasks, insights = calculate_schedule(updated_tasks, start_dt)
    
    return {
        "tasks": scheduled_tasks,
        "insights": insights,
        "message": "Your task estimates have been compressed, and the schedule was successfully updated!"
    }
