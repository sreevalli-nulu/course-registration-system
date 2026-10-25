from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Section
from app.settings import CURRENT_TERM

router = APIRouter(prefix="/terms", tags=["terms"])


@router.get("/current")
def current_term():
    """The term that is open for enrollment."""
    return {"current_term": CURRENT_TERM}


def _term_key(term: str):
    """Sort key for terms like 'Spring2026': by year, then season."""
    year = int(term[-4:]) if term[-4:].isdigit() else 0
    season = {"spring": 0, "summer": 1, "fall": 2, "winter": 3}.get(term[:-4].lower(), 9)
    return (year, season)


@router.get("")
def list_terms(db: Session = Depends(get_db)):
    """Every term that has at least one section, newest first."""
    rows = db.query(Section.term).distinct().all()
    terms = sorted({r[0] for r in rows} | {CURRENT_TERM}, key=_term_key, reverse=True)
    return {"current_term": CURRENT_TERM, "terms": terms}
