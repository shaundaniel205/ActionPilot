import pytest
from datetime import datetime, timezone
from app.scheduler import calculate_schedule, compress_schedule_durations, parse_iso_datetime

def test_parse_iso_datetime():
    dt = parse_iso_datetime("2026-06-29T10:00:00Z")
    assert dt.year == 2026
    assert dt.month == 6
    assert dt.day == 29
    assert dt.hour == 10
    assert dt.tzinfo is not None

def test_compress_schedule_durations():
    tasks = [
        {"id": "1", "priority": "high", "available_hours": 10.0, "completed": False},
        {"id": "2", "priority": "medium", "available_hours": 10.0, "completed": False},
        {"id": "3", "priority": "low", "available_hours": 10.0, "completed": False},
        {"id": "4", "priority": "low", "available_hours": 10.0, "completed": True}, # Completed should not compress
    ]
    compressed = compress_schedule_durations(tasks)
    
    assert compressed[0]["available_hours"] == 10.0
    assert compressed[1]["available_hours"] == 8.5
    assert compressed[2]["available_hours"] == 7.0
    assert compressed[3]["available_hours"] == 10.0

def test_calculate_schedule_sorting():
    # High priority should be scheduled first even if deadline is later than medium/low
    tasks = [
        {"id": "1", "title": "Low Task", "priority": "low", "deadline": "2026-07-05T17:00:00Z", "available_hours": 2.0, "completed": False},
        {"id": "2", "title": "High Task", "priority": "high", "deadline": "2026-07-10T17:00:00Z", "available_hours": 3.0, "completed": False},
        {"id": "3", "title": "Medium Task", "priority": "medium", "deadline": "2026-07-08T17:00:00Z", "available_hours": 4.0, "completed": False},
    ]
    # Starting Monday June 29, 2026, 9:00 AM
    start_dt = datetime(2026, 6, 29, 9, 0, tzinfo=timezone.utc)
    
    scheduled_tasks, insights = calculate_schedule(tasks, start_dt)
    
    # Check that sorting works: High (index 0) -> Medium (index 1) -> Low (index 2)
    # The output from calculate_schedule keeps uncompleted tasks sorted
    # Let's inspect the order in which they were scheduled
    uncompleted = [t for t in scheduled_tasks if not t.get("completed")]
    
    assert uncompleted[0]["priority"] == "high"
    assert uncompleted[1]["priority"] == "medium"
    assert uncompleted[2]["priority"] == "low"

def test_calculate_schedule_working_hours():
    # Starting Friday June 26, 2026 at 16:00 (4:00 PM)
    # Task takes 3 hours. Working hours: 9 AM to 5 PM (8 hours total)
    # Friday remaining: 1 hour (16:00 to 17:00)
    # Saturday & Sunday are skipped.
    # Monday remaining: 2 hours (9:00 to 11:00)
    tasks = [
        {"id": "1", "title": "Test Task", "priority": "high", "deadline": "2026-07-01T17:00:00Z", "available_hours": 3.0, "completed": False}
    ]
    start_dt = datetime(2026, 6, 26, 16, 0, tzinfo=timezone.utc) # Friday
    
    scheduled, _ = calculate_schedule(tasks, start_dt, work_start_hour=9, working_hours_per_day=8, skip_weekends=True)
    
    task = scheduled[0]
    assert task["scheduled_start"].startswith("2026-06-26T16:00:00")
    # Finish time should be Monday, June 29 at 11:00 AM
    assert task["scheduled_end"].startswith("2026-06-29T11:00:00")

def test_deadline_risk():
    # Task deadline is 2026-06-29 at 12:00 PM
    # Task takes 5 hours, starts at 9:00 AM. Ends at 2:00 PM (14:00) -> After deadline -> High Risk
    tasks = [
        {"id": "1", "title": "Overdue Task", "priority": "high", "deadline": "2026-06-29T12:00:00Z", "available_hours": 5.0, "completed": False}
    ]
    start_dt = datetime(2026, 6, 29, 9, 0, tzinfo=timezone.utc)
    
    scheduled, insights = calculate_schedule(tasks, start_dt)
    
    assert scheduled[0]["deadline_risk"] == "high"
    assert insights["high_risk_count"] == 1
