from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Section, Enrollment, EnrollmentStatus, RoleEnum
from app.schemas import SectionOut, SectionCreate
from app.auth import require_role

router = APIRouter(prefix="/sections", tags=["sections"])


def _with_seats_taken(db: Session, section: Section) -> SectionOut:
    seats_taken = (
        db.query(func.count(Enrollment.id))
        .filter(
            Enrollment.section_id == section.id,
            Enrollment.status == EnrollmentStatus.enrolled,
        )
        .scalar()
    )
    out = SectionOut.model_validate(section)
    out.seats_taken = seats_taken or 0
    return out


@router.get("", response_model=List[SectionOut])
def list_sections(course_id: Optional[int] = Query(default=None), db: Session = Depends(get_db)):
    query = db.query(Section)
    if course_id is not None:
        query = query.filter(Section.course_id == course_id)
    sections = query.order_by(Section.term, Section.section_number).all()
    return [_with_seats_taken(db, s) for s in sections]


@router.get("/{section_id}", response_model=SectionOut)
def get_section(section_id: int, db: Session = Depends(get_db)):
    section = db.query(Section).filter(Section.id == section_id).first()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    return _with_seats_taken(db, section)


@router.post(
    "",
    response_model=SectionOut,
    status_code=201,
    dependencies=[Depends(require_role(RoleEnum.registrar))],
)
def create_section(payload: SectionCreate, db: Session = Depends(get_db)):
    section = Section(**payload.model_dump())
    db.add(section)
    db.commit()
    db.refresh(section)
    return _with_seats_taken(db, section)
