from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    AuditLog, Course, Enrollment, EnrollmentStatus, Instructor, Notification, RoleEnum, Section,
    Student, User, Waitlist, SEAT_HOLDING_STATUSES,
)
from app.schemas import InstructorOut, InstructorSectionOut, RosterEntryOut, RosterOut
from app.auth import require_role

router = APIRouter(tags=["staff"])


def _seats_taken(db: Session, section_id: int) -> int:
    return (
        db.query(func.count(Enrollment.id))
        .filter(Enrollment.section_id == section_id, Enrollment.status.in_(SEAT_HOLDING_STATUSES))
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


@router.get("/instructors", response_model=List[InstructorOut])
def list_instructors(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.registrar)),
):
    """All instructors, so a registrar can assign one to a section."""
    rows = (
        db.query(Instructor, User)
        .join(User, Instructor.user_id == User.id)
        .order_by(User.full_name)
        .all()
    )
    counts = dict(
        db.query(Section.instructor_id, func.count(Section.id))
        .filter(Section.instructor_id.isnot(None))
        .group_by(Section.instructor_id)
        .all()
    )
    return [
        InstructorOut(
            id=i.id, full_name=u.full_name, email=u.email, department=i.department,
            section_count=counts.get(i.id, 0),
        )
        for i, u in rows
    ]


@router.delete("/instructors/{instructor_id}")
def remove_instructor(
    instructor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.registrar)),
):
    """Delete an instructor account that has never taught or graded anything."""
    instructor = db.query(Instructor).filter(Instructor.id == instructor_id).first()
    if not instructor:
        raise HTTPException(status_code=404, detail="Instructor not found")
    user = db.query(User).filter(User.id == instructor.user_id).first()

    taught = (
        db.query(Section, Course)
        .join(Course, Section.course_id == Course.id)
        .filter(Section.instructor_id == instructor.id)
        .order_by(Section.term, Course.code)
        .all()
    )
    if taught:
        shown = ", ".join(f"{c.code} {s.term}" for s, c in taught[:4])
        more = f" and {len(taught) - 4} more" if len(taught) > 4 else ""
        raise HTTPException(
            status_code=400,
            detail=(
                f"{user.full_name} is assigned to {len(taught)} section(s) ({shown}{more}). "
                "Reassign or unassign them in Sections first."
            ),
        )

    has_history = (
        db.query(func.count(AuditLog.id)).filter(AuditLog.user_id == user.id).scalar()
    ) or 0
    if has_history:
        raise HTTPException(
            status_code=400,
            detail=(
                f"{user.full_name} has activity in the audit log (for example posted grades), "
                "so the account cannot be deleted. Unassign their sections instead."
            ),
        )

    email, name = user.email, user.full_name
    db.query(Notification).filter(Notification.user_id == user.id).delete()
    db.delete(instructor)
    db.flush()
    db.delete(user)
    db.add(AuditLog(
        user_id=current_user.id, action="instructor_delete", table_name="instructors",
        record_id=instructor_id, details=f"removed {name} <{email}>",
    ))
    db.commit()
    return {"status": "removed", "instructor_id": instructor_id}
