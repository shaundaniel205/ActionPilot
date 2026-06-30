from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.config import settings
from app.database import supabase_client

security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """
    Extracts user_id from the authorization bearer token.
    Supports mock auth for local sandbox and Supabase JWT verification for production.
    """
    token = credentials.credentials
    
    # Handle Mock Mode
    if settings.USE_MOCK_DB:
        if token.startswith("mock-"):
            return token  # Return the mock token itself as the user_id (e.g. "mock-user-123")
        # Fallback if someone hits mock DB with something else, let it pass if it's alphanumeric
        if len(token) > 0:
            return f"mock-{token}"
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid mock token. Must be a non-empty string starting with 'mock-'."
        )

    # Handle Supabase Production Mode
    if not supabase_client:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase client is not initialized, and mock mode is disabled."
        )
        
    try:
        # Verify user token against Supabase API
        response = supabase_client.auth.get_user(token)
        if not response or not response.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Supabase session token."
            )
        return str(response.user.id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication failed: {str(e)}"
        )
