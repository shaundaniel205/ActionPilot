# ActionPilot — AI Productivity Companion

ActionPilot is a modern full-stack productivity dashboard designed to schedule tasks, identify deadline risks, and generate rule-based productivity insights. It integrates a **Next.js (TypeScript, Tailwind, Recharts)** frontend with a **FastAPI** scheduling backend and **Supabase** auth/database services.

It features a **Local Mock mode** (SQLite + Simulated Auth) that allows the application to run instantly out-of-the-box without configuring any external API keys or services.

deployment: https://action-pilot-woad.vercel.app/

## Core Features & Engines

1. **Rule-Based Scheduling Engine**:
   - Automatically schedules tasks sequentially inside standard **9:00 AM to 5:00 PM** working hours.
   - Skips weekends automatically to mirror realistic workweeks.
   - Schedules are computed dynamically in the FastAPI backend based on the user's local timezone (sent via frontend offset).
2. **Deadline Risk Assessment**:
   - **High**: The task completion is projected to finish *after* its deadline.
   - **Medium**: The task completion is close to the deadline (within 4 hours).
   - **Low**: The task completion is comfortably before the deadline.
3. **"I'm Behind" Recalculation**:
   - Compresses task estimates of pending tasks dynamically (Low priority compressed to 70%, Medium priority to 85%).
   - Persists the compressed hours to the database and replans the timeline instantly.
4. **Interactive 9-5 Timeline**:
   - A visual, vertical feed on the dashboard showing exactly when each task is scheduled to start and end.
5. **AI-Inspired Insights**:
   - Direct warnings for scheduling bottlenecks, recommendations on quick wins, focus priorities, and completion stats.
6. **Task Gamification**:
   - Completing tasks plays a satisfying celebratory confetti effect.

---

## Tech Stack

* **Frontend**: Next.js (App Router), TypeScript, Tailwind CSS, Recharts, Lucide Icons, Canvas Confetti.
* **Backend**: FastAPI (Python), PyJWT, pytest.
* **Database**: Supabase PostgreSQL (Production) / SQLite (Sandbox Mock Mode).

---

## Getting Started

### 1. Backend Setup

First, navigate to the `backend/` folder:
```bash
cd backend
```

Ensure Python 3.11+ is installed. Create a virtual environment and install the dependencies:
```bash
# Create venv
python -m venv venv

# Activate venv (Windows PowerShell)
.\venv\Scripts\Activate.ps1

# Install requirements
pip install -r requirements.txt
```

Launch the FastAPI server:
```bash
python main.py
```
The server will run on `http://127.0.0.1:8000`.

### 2. Frontend Setup

Navigate to the `frontend/` folder:
```bash
cd frontend
```

Install packages:
```bash
npm install
```

Start the development server:
```bash
npm run dev
```
The client app will run on `http://localhost:3000`.

---

## Database Configuration

By default, the application runs in **Local Mock mode (SQLite)**. To connect it to your Supabase project:

1. **Backend**:
   - Copy `backend/.env.example` to `backend/.env`
   - Fill in your `SUPABASE_URL` and `SUPABASE_ANON_KEY`
2. **Frontend**:
   - Copy `frontend/.env.example` to `frontend/.env.local`
   - Fill in your `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. **Database Schema**:
   - Execute the SQL statements from `backend/schema.sql` inside your Supabase SQL Editor.

---

## Running Tests

To run the backend scheduling unit tests:
```bash
cd backend
.\venv\Scripts\python -m pytest
```
