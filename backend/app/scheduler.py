from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Tuple

def parse_iso_datetime(dt_str: str) -> datetime:
    """Parses ISO format strings safely to offset-aware datetime."""
    try:
        # Handle 'Z' suffix by replacing with '+00:00'
        clean_str = dt_str.replace("Z", "+00:00")
        return datetime.fromisoformat(clean_str)
    except Exception:
        # Fallback to current time UTC
        return datetime.now(timezone.utc)

def calculate_schedule(
    tasks: List[Dict[str, Any]],
    start_time: datetime,
    work_start_hour: int = 9,
    working_hours_per_day: float = 8.0,
    skip_weekends: bool = True
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Schedules a list of uncompleted tasks sequentially based on rule-based logic:
    1. Sort tasks: High priority first, then Medium, then Low. Within each priority, earlier deadlines first.
    2. Sequentially allocate task hours inside work days (e.g. 9:00 to 17:00).
    3. Skip weekends if toggle is True.
    4. Calculate scheduled_start and scheduled_end for each task.
    5. Determine deadline risk for each task.
    6. Generate insights.
    """
    # Separate completed and uncompleted tasks
    completed_tasks = [t for t in tasks if t.get("completed")]
    uncompleted_tasks = [t for t in tasks if not t.get("completed")]

    # Sort uncompleted tasks
    def get_sort_key(t: Dict[str, Any]):
        priority_map = {"high": 0, "medium": 1, "low": 2}
        p_val = priority_map.get(t.get("priority", "medium").lower(), 1)
        dl = parse_iso_datetime(t.get("deadline", ""))
        return (p_val, dl)

    uncompleted_tasks.sort(key=get_sort_key)

    # Schedule parameters
    work_end_hour = work_start_hour + int(working_hours_per_day)
    current_cursor = start_time

    # Ensure start cursor is within working hours and not on weekend
    def adjust_cursor_to_working_hours(dt: datetime) -> datetime:
        # Skip weekend first
        if skip_weekends:
            while dt.weekday() >= 5: # 5 = Saturday, 6 = Sunday
                dt = dt + timedelta(days=1)
                dt = dt.replace(hour=work_start_hour, minute=0, second=0, microsecond=0)

        # Check if past daily end hour
        if dt.hour >= work_end_hour or (dt.hour == work_end_hour and (dt.minute > 0 or dt.second > 0)):
            # Advance to tomorrow start
            dt = dt + timedelta(days=1)
            dt = dt.replace(hour=work_start_hour, minute=0, second=0, microsecond=0)
            return adjust_cursor_to_working_hours(dt)
        # Check if before daily start hour
        elif dt.hour < work_start_hour:
            dt = dt.replace(hour=work_start_hour, minute=0, second=0, microsecond=0)
            return adjust_cursor_to_working_hours(dt)
        
        return dt

    scheduled_tasks = []

    for task in uncompleted_tasks:
        current_cursor = adjust_cursor_to_working_hours(current_cursor)
        
        # Calculate task start
        task_start = current_cursor
        remaining_hours = float(task.get("available_hours", 1.0))
        
        # Sequentially allocate hours across days if needed
        while remaining_hours > 0:
            current_cursor = adjust_cursor_to_working_hours(current_cursor)
            
            # Find remaining work hours for the current cursor's day
            today_end = current_cursor.replace(hour=work_end_hour, minute=0, second=0, microsecond=0)
            available_today = (today_end - current_cursor).total_seconds() / 3600.0
            
            if remaining_hours <= available_today:
                # Task fits in today
                current_cursor = current_cursor + timedelta(hours=remaining_hours)
                remaining_hours = 0
            else:
                # Task takes remainder of today and overflows
                remaining_hours -= available_today
                current_cursor = today_end
                
        task_end = current_cursor
        
        # Calculate deadline risk
        deadline = parse_iso_datetime(task.get("deadline", ""))
        
        # Check if scheduled end is after deadline
        if task_end > deadline:
            risk = "high"
        # Check if scheduled end is very close to deadline (within 4 hours or 20% of remaining time)
        elif (deadline - task_end).total_seconds() < 4 * 3600:
            risk = "medium"
        else:
            risk = "low"
            
        scheduled_task = {
            **task,
            "scheduled_start": task_start.isoformat(),
            "scheduled_end": task_end.isoformat(),
            "deadline_risk": risk
        }
        scheduled_tasks.append(scheduled_task)

    # For completed tasks, set default status
    for task in completed_tasks:
        task_copy = {**task}
        task_copy["scheduled_start"] = task_copy.get("created_at")
        task_copy["scheduled_end"] = task_copy.get("completed_at") or task_copy.get("created_at")
        task_copy["deadline_risk"] = "low"
        scheduled_tasks.append(task_copy)

    # Generate insights
    insights = generate_insights(scheduled_tasks, start_time, work_start_hour, working_hours_per_day)

    return scheduled_tasks, insights

def generate_insights(
    scheduled_tasks: List[Dict[str, Any]],
    current_time: datetime,
    work_start_hour: int,
    working_hours_per_day: float
) -> Dict[str, Any]:
    """Generates rule-based productivity insights."""
    uncompleted = [t for t in scheduled_tasks if not t.get("completed")]
    completed = [t for t in scheduled_tasks if t.get("completed")]
    
    total_uncompleted_hours = sum(float(t.get("available_hours", 0)) for t in uncompleted)
    high_risk_tasks = [t for t in uncompleted if t.get("deadline_risk") == "high"]
    medium_risk_tasks = [t for t in uncompleted if t.get("deadline_risk") == "medium"]
    
    recommendations = []
    
    # 1. Total workload recommendation
    if len(high_risk_tasks) > 0:
        recommendations.append({
            "type": "danger",
            "title": f"Workload Conflict: {len(high_risk_tasks)} task(s) at High Risk",
            "message": f"Tasks like '{high_risk_tasks[0]['title']}' will miss their deadlines under the current schedule. Click 'I'm Behind' to compress lower-priority tasks or shift deadlines."
        })
    elif len(medium_risk_tasks) > 0:
        recommendations.append({
            "type": "warning",
            "title": f"Tight Schedule: {len(medium_risk_tasks)} task(s) at Medium Risk",
            "message": f"Tasks like '{medium_risk_tasks[0]['title']}' are close to missing deadlines. Focus on minimizing interruptions today."
        })
    elif len(uncompleted) > 0:
        recommendations.append({
            "type": "success",
            "title": "Schedule Clear",
            "message": "All scheduled tasks are projected to finish before their deadlines! You're in a great position."
        })
    
    # 2. Priority advice
    high_priority_uncompleted = [t for t in uncompleted if t.get("priority") == "high"]
    if len(high_priority_uncompleted) > 0:
        recommendations.append({
            "type": "info",
            "title": "Focus Strategy",
            "message": f"You have {len(high_priority_uncompleted)} high-priority task(s) active. Prioritize completing these before moving to medium or low tasks."
        })
    
    # 3. Quick wins
    quick_wins = [t for t in uncompleted if float(t.get("available_hours", 0)) <= 1.0]
    if len(quick_wins) > 0:
        recommendations.append({
            "type": "info",
            "title": "Quick Win Available",
            "message": f"'{quick_wins[0]['title']}' is estimated to take {quick_wins[0]['available_hours']} hours. Knocking it out first can build immediate momentum."
        })

    # 4. Success / Streak statistics
    if len(completed) > 0:
        recommendations.append({
            "type": "success",
            "title": "Keep it Up!",
            "message": f"You have successfully completed {len(completed)} task(s). Continue executing to maintain your flow."
        })

    # Find first free slot
    first_free_slot = current_time.isoformat()
    if len(uncompleted) > 0:
        # The final task's scheduled_end is our first complete free slot
        ends = []
        for t in uncompleted:
            try:
                ends.append(datetime.fromisoformat(t["scheduled_end"]))
            except Exception:
                pass
        if ends:
            first_free_slot = max(ends).isoformat()

    return {
        "total_tasks": len(scheduled_tasks),
        "completed_count": len(completed),
        "uncompleted_count": len(uncompleted),
        "total_uncompleted_hours": total_uncompleted_hours,
        "high_risk_count": len(high_risk_tasks),
        "medium_risk_count": len(medium_risk_tasks),
        "first_free_slot": first_free_slot,
        "recommendations": recommendations
    }

def compress_schedule_durations(
    tasks: List[Dict[str, Any]],
    low_priority_factor: float = 0.70,
    medium_priority_factor: float = 0.85
) -> List[Dict[str, Any]]:
    """
    Applies rule-based task duration compression to tasks that are not completed.
    Low priority: reduced to 70% of original time.
    Medium priority: reduced to 85% of original time.
    High priority: unchanged (100%).
    """
    updated_tasks = []
    for task in tasks:
        task_copy = {**task}
        if not task_copy.get("completed"):
            priority = task_copy.get("priority", "medium").lower()
            orig_hours = float(task_copy.get("available_hours", 1.0))
            if priority == "low":
                task_copy["available_hours"] = round(orig_hours * low_priority_factor, 2)
            elif priority == "medium":
                task_copy["available_hours"] = round(orig_hours * medium_priority_factor, 2)
        updated_tasks.append(task_copy)
    return updated_tasks
