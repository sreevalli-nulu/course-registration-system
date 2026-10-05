from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    Course, Enrollment, EnrollmentStatus, Instructor, RoleEnum, Section,
    Student, User, Waitlist,
)
from app.schemas import InstructorSectionOut, RosterEntryOut, RosterOut
from app.auth import require_role

router = APIRouter(tags=["staff"])


def _seats_taken(db: Session, section_id: int) -> int:
    return (
        db.query(func.count(Enrollment.id))
        .filter(Enrollment.section_id == section_id, Enrollment.status == EnrollmentStatus.enrolled)
        .scalar()
    ) or 0


@router.get("/sections/{section_id}/roster", response_model=RosterOut)
def section_roster(
    section_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.registrar, RoleEnum.instructor)),
):
    """Students enrolled in a section, with the enrollment_id needed for grading."""
    section = db.query(Section).filter(Section.id == section_id).first()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

    # Instructors may only see the roster of sections they teach
    if current_user.role == RoleEnum.instructor:
        instructor = db.query(Instructor).filter(Instructor.user_id == current_user.id).first()
        if not instructor or section.instructor_id != instructor.id:
            raise HTTPException(status_code=403, detail="You can only view rosters for your own sections")

    course = db.query(Course).filter(Course.id == section.course_id).first()
    rows = (
        db.query(Enrollment, Student, User)
        .join(Student, Enrollment.student_id == Student.id)
        .join(User, Student.user_id == User.id)
        .filter(
            Enrollment.section_id == section.id,
            Enrollment.status.in_([EnrollmentStatus.enrolled, EnrollmentStatus.completed]),
        )
        .order_by(User.full_name)
        .all()
    )
    return RosterOut(
        section_id=section.id, course_code=course.code, course_title=course.title,
        term=section.term, section_number=section.section_number,
        capacity=section.capacity, seats_taken=_seats_taken(db, section.id),
        students=[
            RosterEntryOut(
                enrollment_id=e.id, student_id=st.id, student_number=st.student_number,
                full_name=u.full_name, status=e.status.value, grade=e.grade,
            )
            for e, st, u in rows
        ],
    )


@router.get("/instructors/me/sections", response_model=List[InstructorSectionOut])
def my_sections(
    term: Optional[str] = Query(default=None, description="e.g. Fall2026"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.instructor)),
):
    """The sections the logged-in instructor teaches."""
    instructor = db.query(Instructor).filter(Instructor.user_id == current_user.id).first()
    if not instructor:
        raise HTTPException(status_code=404, detail="Instructor profile not found")

    query = (
        db.query(Section, Course)
        .join(Course, Section.course_id == Course.id)
        .filter(Section.instructor_id == instructor.id)
    )
    if term:
        query = query.filter(Section.term == term)

    out = []
    for section, course in query.order_by(Section.term, Course.code, Section.section_number).all():
        waitlist_count = (
            db.query(func.count(Waitlist.id)).filter(Waitlist.section_id == section.id).scalar()
        ) or 0
        out.append(InstructorSectionOut(
            section_id=section.id, course_code=course.code, course_title=course.title,
            credits=course.credits, term=section.term, section_number=section.section_number,
            room=section.room, meeting_time=section.meeting_time, capacity=section.capacity,
            seats_taken=_seats_taken(db, section.id), waitlist_count=waitlist_count,
        ))
    return out