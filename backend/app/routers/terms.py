from fastapi import APIRouter

from app.settings import CURRENT_TERM

router = APIRouter(prefix="/terms", tags=["terms"])


@router.get("/current")
def current_term():
    """The term that is open for enrollment."""
    return {"current_term": CURRENT_TERM}
