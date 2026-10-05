from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    AuditLog, Course, Enrollment, EnrollmentStatus, Instructor, Prerequisite,
    RoleEnum, Section, Student, User, Waitlist,
)
from app.schemas import (
    CourseDetailOut, CoursePrereqOut, CourseUpdate, SectionOut, SectionUpdate,
    WaitlistEntryOut, WaitlistOut,
)
from app.auth import require_role
from app.routers.enrollments import _get_transitive_prerequisites, promote_from_waitlist
from app.routers.sections import _with_seats_taken

router = APIRouter(tags=["admin"])


def _course_detail(db: Session, course: Course) -> CourseDetailOut:
    prereqs = (
        db.query(Course)
        .join(Prerequisite, Prerequisite.prerequisite_course_id == Course.id)
        .filter(Prerequisite.course_id == course.id)
        .order_by(Course.code)
        .all()
    )
    return CourseDetailOut(
        id=course.id, code=course.code, title=course.title, credits=course.credits,
        description=course.description,
        prerequisites=[CoursePrereqOut(id=c.id, code=c.code, title=c.title) for c in prereqs],
    )


@router.get("/courses/{course_id}/prerequisites", response_model=List[CoursePrereqOut])
def course_prerequisites(course_id: int, db: Session = Depends(get_db)):
    """Direct prerequisites of a course (public, for the catalog)."""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return _course_detail(db, course).prerequisites


@router.put("/courses/{course_id}", response_model=CourseDetailOut)
def update_course(
    course_id: int,
    payload: CourseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.registrar)),
):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    changes = payload.model_dump(exclude_unset=True)

    if "prerequisite_course_ids" in changes and changes["prerequisite_course_ids"] is not None:
        new_ids = set(changes["prerequisite_course_ids"])
        if course.id in new_ids:
            raise HTTPException(status_code=400, detail="A course cannot be its own prerequisite")
        found = {c.id: c for c in db.query(Course).filter(Course.id.in_(new_ids)).all()} if new_ids else {}
        missing = new_ids - set(found)
        if missing:
            raise HTTPException(
                status_code=400, detail=f"Prerequisite course not found: {sorted(missing)}"
            )
        # Adding "course requires p" creates a cycle if p already (transitively) requires course
        for pid in new_ids:
            if course.id in _get_transitive_prerequisites(db, pid):
                raise HTTPException(
                    status_code=400,
                    detail=f"Circular prerequisite: {found[pid].code} already requires {course.code}",
                )
        db.query(Prerequisite).filter(Prerequisite.course_id == course.id).delete()
        for pid in new_ids:
            db.add(Prerequisite(course_id=course.id, prerequisite_course_id=pid))

    for field in ("title", "credits", "description"):
        if field in changes and changes[field] is not None:
            setattr(course, field, changes[field])

    db.add(AuditLog(
        user_id=current_user.id, action="course_update", table_name="courses",
        record_id=course.id, details=f"fields={sorted(changes)}",
    ))
    db.commit()
    db.refresh(course)
    return _course_detail(db, course)


@router.put("/sections/{section_id}", response_model=SectionOut)
def update_section(
    section_id: int,
    payload: SectionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.registrar)),
):
    # Lock the section: capacity changes must not race with enrolments
    section = db.query(Section).filter(Section.id == section_id).with_for_update().first()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

    changes = payload.model_dump(exclude_unset=True)

    if changes.get("instructor_id") is not None:
        if not db.query(Instructor).filter(Instructor.id == changes["instructor_id"]).first():
            raise HTTPException(status_code=400, detail="Instructor not found")

    if "capacity" in changes and changes["capacity"] is not None:
        seats_taken = (
            db.query(func.count(Enrollment.id))
            .filter(Enrollment.section_id == section.id, Enrollment.status == EnrollmentStatus.enrolled)
            .scalar()
        ) or 0
        if changes["capacity"] < seats_taken:
            raise HTTPException(
                status_code=400,
                detail=f"Capacity cannot be lower than the {seats_taken} students already enrolled",
            )

    new_term = changes.get("term") or section.term
    new_number = changes.get("section_number") or section.section_number
    clash = (
        db.query(Section)
        .filter(
            Section.course_id == section.course_id,
            Section.term == new_term,
            Section.section_number == new_number,
            Section.id != section.id,
        )
        .first()
    )
    if clash:
        raise HTTPException(status_code=400, detail="That course already has a section with this term and number")

    for field in ("instructor_id", "room", "meeting_time"):
        if field in changes:
            setattr(section, field, changes[field])      # these may be set to null
    for field in ("term", "section_number", "capacity"):
        if changes.get(field) is not None:
            setattr(section, field, changes[field])

    db.add(AuditLog(
        user_id=current_user.id, action="section_update", table_name="sections",
        record_id=section.id, details=f"fields={sorted(changes)}",
    ))

    # More seats than before? Let waitlisted students in, longest-waiting first.
    promote_from_waitlist(db, section)

    db.commit()
    db.refresh(section)
    return _with_seats_taken(db, section)


@router.get("/waitlist/{section_id}", response_model=WaitlistOut)
def view_waitlist(
    section_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.registrar, RoleEnum.instructor)),
):
    section = db.query(Section).filter(Section.id == section_id).first()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

    # Instructors may only see waitlists for sections they teach
    if current_user.role == RoleEnum.instructor:
        instructor = db.query(Instructor).filter(Instructor.user_id == current_user.id).first()
        if not instructor or section.instructor_id != instructor.id:
            raise HTTPException(status_code=403, detail="You can only view waitlists for your own sections")

    course = db.query(Course).filter(Course.id == section.course_id).first()
    seats_taken = (
        db.query(func.count(Enrollment.id))
        .filter(Enrollment.section_id == section.id, Enrollment.status == EnrollmentStatus.enrolled)
        .scalar()
    ) or 0
    rows = (
        db.query(Waitlist, Student, User)
        .join(Student, Waitlist.student_id == Student.id)
        .join(User, Student.user_id == User.id)
        .filter(Waitlist.section_id == section.id)
        .order_by(Waitlist.position)
        .all()
    )
    return WaitlistOut(
        section_id=section.id, course_code=course.code, term=section.term,
        section_number=section.section_number, capacity=section.capacity,
        seats_taken=seats_taken,
        entries=[
            WaitlistEntryOut(
                position=w.position, student_id=st.id, student_number=st.student_number,
                full_name=u.full_name, added_at=w.added_at,
            )
            for w, st, u in rows
        ],
    )