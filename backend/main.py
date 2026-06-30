import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routes import tasks

app = FastAPI(
    title="ActionPilot API",
    description="AI Productivity Companion Rule-Based Scheduling Engine Backend",
    version="1.0.0"
)

# Configure CORS to allow frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all for development simplicity; restrict in production if needed
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(tasks.router)

@app.get("/")
def read_root():
    return {
        "status": "online",
        "app": "ActionPilot API Engine",
        "mock_mode": settings.USE_MOCK_DB
    }

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True
    )
