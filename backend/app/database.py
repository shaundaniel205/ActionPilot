import os
import sqlite3
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from supabase import create_client, Client
from app.config import settings

# Initialize Supabase if keys are available
supabase_client: Optional[Client] = None
if not settings.USE_MOCK_DB:
    try:
        supabase_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
    except Exception as e:
        print(f"Failed to initialize Supabase client: {e}. Falling back to SQLite.")

# SQLite initialization helper
DB_PATH = "actionpilot_mock.db"

def get_sqlite_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_sqlite_db():
    """Initializes SQLite schema if using mock database"""
    if not settings.USE_MOCK_DB:
        return
    
    with get_sqlite_conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
                deadline TEXT NOT NULL,
                available_hours REAL NOT NULL DEFAULT 1.0,
                completed INTEGER NOT NULL DEFAULT 0,
                completed_at TEXT,
                created_at TEXT NOT NULL
            )
        """)
        conn.commit()

# Run SQLite initialization immediately
init_sqlite_db()

class TaskRepository:
    @staticmethod
    def _row_to_dict(row: sqlite3.Row) -> Dict[str, Any]:
        d = dict(row)
        d["completed"] = bool(d["completed"])
        return d

    @classmethod
    def list_tasks(cls, user_id: str) -> List[Dict[str, Any]]:
        if settings.USE_MOCK_DB or not supabase_client:
            with get_sqlite_conn() as conn:
                cursor = conn.execute(
                    "SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC", 
                    (user_id,)
                )
                return [cls._row_to_dict(row) for row in cursor.fetchall()]
        else:
            response = supabase_client.table("tasks").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
            return response.data

    @classmethod
    def create_task(cls, user_id: str, task_data: Dict[str, Any]) -> Dict[str, Any]:
        task_id = str(uuid.uuid4())
        created_at = datetime.now(timezone.utc).isoformat()
        
        # Parse and format deadline to ISO string
        deadline = task_data["deadline"]
        if isinstance(deadline, datetime):
            deadline = deadline.isoformat()

        record = {
            "id": task_id,
            "user_id": user_id,
            "title": task_data["title"],
            "description": task_data.get("description", ""),
            "priority": task_data["priority"],
            "deadline": deadline,
            "available_hours": float(task_data.get("available_hours", 1.0)),
            "completed": False,
            "completed_at": None,
            "created_at": created_at
        }

        if settings.USE_MOCK_DB or not supabase_client:
            with get_sqlite_conn() as conn:
                conn.execute(
                    """
                    INSERT INTO tasks (id, user_id, title, description, priority, deadline, available_hours, completed, completed_at, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        record["id"],
                        record["user_id"],
                        record["title"],
                        record["description"],
                        record["priority"],
                        record["deadline"],
                        record["available_hours"],
                        1 if record["completed"] else 0,
                        record["completed_at"],
                        record["created_at"]
                    )
                )
                conn.commit()
            return record
        else:
            response = supabase_client.table("tasks").insert(record).execute()
            if len(response.data) > 0:
                return response.data[0]
            raise Exception("Failed to insert task in Supabase")

    @classmethod
    def get_task(cls, user_id: str, task_id: str) -> Optional[Dict[str, Any]]:
        if settings.USE_MOCK_DB or not supabase_client:
            with get_sqlite_conn() as conn:
                cursor = conn.execute("SELECT * FROM tasks WHERE id = ? AND user_id = ?", (task_id, user_id))
                row = cursor.fetchone()
                return cls._row_to_dict(row) if row else None
        else:
            response = supabase_client.table("tasks").select("*").eq("id", task_id).eq("user_id", user_id).execute()
            return response.data[0] if len(response.data) > 0 else None

    @classmethod
    def update_task(cls, user_id: str, task_id: str, task_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        # Check if task exists
        existing = cls.get_task(user_id, task_id)
        if not existing:
            return None

        updates = {}
        if "title" in task_data:
            updates["title"] = task_data["title"]
        if "description" in task_data:
            updates["description"] = task_data["description"]
        if "priority" in task_data:
            updates["priority"] = task_data["priority"]
        if "deadline" in task_data:
            deadline = task_data["deadline"]
            if isinstance(deadline, datetime):
                deadline = deadline.isoformat()
            updates["deadline"] = deadline
        if "available_hours" in task_data:
            updates["available_hours"] = float(task_data["available_hours"])
        if "completed" in task_data:
            updates["completed"] = bool(task_data["completed"])
            if updates["completed"] and not existing.get("completed"):
                updates["completed_at"] = datetime.now(timezone.utc).isoformat()
            elif not updates["completed"]:
                updates["completed_at"] = None

        if settings.USE_MOCK_DB or not supabase_client:
            # Build SQLite update query
            fields = []
            values = []
            for k, v in updates.items():
                fields.append(f"{k} = ?")
                if k == "completed":
                    values.append(1 if v else 0)
                else:
                    values.append(v)
            values.extend([task_id, user_id])
            
            with get_sqlite_conn() as conn:
                conn.execute(
                    f"UPDATE tasks SET {', '.join(fields)} WHERE id = ? AND user_id = ?",
                    values
                )
                conn.commit()
            return cls.get_task(user_id, task_id)
        else:
            response = supabase_client.table("tasks").update(updates).eq("id", task_id).eq("user_id", user_id).execute()
            if len(response.data) > 0:
                return response.data[0]
            return None

    @classmethod
    def delete_task(cls, user_id: str, task_id: str) -> bool:
        if settings.USE_MOCK_DB or not supabase_client:
            with get_sqlite_conn() as conn:
                cursor = conn.execute("DELETE FROM tasks WHERE id = ? AND user_id = ?", (task_id, user_id))
                conn.commit()
                return cursor.rowcount > 0
        else:
            response = supabase_client.table("tasks").delete().eq("id", task_id).eq("user_id", user_id).execute()
            return len(response.data) > 0
