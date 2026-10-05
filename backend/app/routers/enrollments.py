from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, or_, text
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    Section, Enrollment, EnrollmentStatus, Waitlist, Student,
    AuditLog, RoleEnum, Course, User,
)
from app.schemas import EnrollmentCreate, EnrollmentResponse, DropResponse
from app.auth import require_role

router = APIRouter(prefix="/enrollments", tags=["enrollments"])


PREREQ_RECURSIVE_SQL = text("""
    WITH RECURSIVE prereq_chain AS (
        SELECT prerequisite_course_id AS course_id
        FROM prerequisites
        WHERE course_id = :course_id
        UNION
        SELECT p.prerequisite_course_id
        FROM prerequisites p
        JOIN prereq_chain pc ON p.course_id = pc.course_id
    )
    SELECT course_id FROM prereq_chain
""")


def _get_transitive_prerequisites(db: Session, course_id: int) -> set:
    rows = db.execute(PREREQ_RECURSIVE_SQL, {"course_id": course_id}).fetchall()
    return {r[0] for r in rows}


def _student_completed_course_ids(db: Session, student_id: int) -> set:
    rows = (
        db.query(Section.course_id)
        .join(Enrollment, Enrollment.section_id == Section.id)
        .filter(
            Enrollment.student_id == student_id,
            Enrollment.status == EnrollmentStatus.completed,
            or_(Enrollment.grade.is_(None), Enrollment.grade != "F"),
        )
        .all()
    )
    return {r[0] for r in rows}

def promote_from_waitlist(db: Session, section: Section) -> list:
    """Move waitlisted students into open seats, longest-waiting first.

    Returns the promoted student ids. The caller must already hold the lock on
    the section row and is responsible for committing.
    """
    db.flush()  # make sure pending drops/capacity changes are visible to the count below
    seats_taken = (
        db.query(func.count(Enrollment.id))
        .filter(Enrollment.section_id == section.id, Enrollment.status == EnrollmentStatus.enrolled)
        .scalar()
    ) or 0

    promoted_ids = []
    while seats_taken < section.capacity:
        next_in_line = (
            db.query(Waitlist)
            .filter(Waitlist.section_id == section.id)
            .order_by(Waitlist.position)
            .first()
        )
        if not next_in_line:
            break

        # A student who dropped this section earlier still has a row for it
        # (student_id + section_id is unique), so reuse that row.
        row = (
            db.query(Enrollment)
            .filter(
                Enrollment.student_id == next_in_line.student_id,
                Enrollment.section_id == section.id,
            )
            .first()
        )
        if row:
            row.status = EnrollmentStatus.enrolled
            row.grade = None
        else:
            row = Enrollment(
                student_id=next_in_line.student_id,
                section_id=section.id,
                status=EnrollmentStatus.enrolled,
            )
            db.add(row)

        promoted_ids.append(next_in_line.student_id)
        db.delete(next_in_line)
        db.flush()
        db.add(AuditLog(
            user_id=None, action="waitlist_promote", table_name="enrollments",
            record_id=row.id,
            details=f"section_id={section.id}, promoted_student_id={promoted_ids[-1]}",
        ))
        seats_taken += 1

    # Close the gap so the first person in line is always position 1
    if promoted_ids:
        remaining = (
            db.query(Waitlist)
            .filter(Waitlist.section_id == section.id)
            .order_by(Waitlist.position)
            .all()
        )
        for new_position, entry in enumerate(remaining, start=1):
            if entry.position != new_position:
                entry.position = new_position
                db.flush()

    return promoted_ids
@router.post("", response_model=EnrollmentResponse, status_code=201)
def enroll(
    payload: EnrollmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.student)),
):
    student = db.query(Student).filter(Student.user_id == current_user.id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")

    section = (
        db.query(Section)
        .filter(Section.id == payload.section_id)
        .with_for_update()
        .first()
    )
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

    required = _get_transitive_prerequisites(db, section.course_id)
    completed = _student_completed_course_ids(db, student.id)
    if section.course_id in completed:
        raise HTTPException(status_code=400, detail="Already completed this course")
    missing = required - completed
    if missing:
        missing_codes = [c.code for c in db.query(Course).filter(Course.id.in_(missing)).all()]
        raise HTTPException(
            status_code=400,
            detail=f"Missing prerequisites: {', '.join(missing_codes)}",
        )

    existing = (
        db.query(Enrollment)
        .filter(Enrollment.student_id == student.id, Enrollment.section_id == section.id)
        .first()
    )
    if existing and existing.status == EnrollmentStatus.enrolled:
        raise HTTPException(status_code=400, detail="Already enrolled in this section")

    seats_taken = (
        db.query(func.count(Enrollment.id))
        .filter(Enrollment.section_id == section.id, Enrollment.status == EnrollmentStatus.enrolled)
        .scalar()
    ) or 0

    if seats_taken < section.capacity:
        if existing:
            existing.status = EnrollmentStatus.enrolled
            enrollment = existing
        else:
            enrollment = Enrollment(student_id=student.id, section_id=section.id, status=EnrollmentStatus.enrolled)
            db.add(enrollment)
        db.flush()
        db.add(AuditLog(
            user_id=current_user.id, action="enroll", table_name="enrollments",
            record_id=enrollment.id, details=f"section_id={section.id}",
        ))
        db.commit()
        db.refresh(enrollment)
        return EnrollmentResponse(outcome="enrolled", enrollment_id=enrollment.id, section_id=section.id)

    already_waitlisted = (
        db.query(Waitlist)
        .filter(Waitlist.student_id == student.id, Waitlist.section_id == section.id)
        .first()
    )
    if already_waitlisted:
        raise HTTPException(status_code=400, detail="Already on the waitlist for this section")

    max_position = (
        db.query(func.max(Waitlist.position)).filter(Waitlist.section_id == section.id).scalar()
    ) or 0
    wl = Waitlist(student_id=student.id, section_id=section.id, position=max_position + 1)
    db.add(wl)
    db.flush()
    db.add(AuditLog(
        user_id=current_user.id, action="waitlist_add", table_name="waitlist",
        record_id=wl.id, details=f"section_id={section.id}",
    ))
    db.commit()
    db.refresh(wl)
    return EnrollmentResponse(outcome="waitlisted", waitlist_position=wl.position, section_id=section.id)


@router.delete("/{enrollment_id}", response_model=DropResponse)
def drop(
    enrollment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.student)),
):
    student = db.query(Student).filter(Student.user_id == current_user.id).first()
    enrollment = (
        db.query(Enrollment)
        .filter(Enrollment.id == enrollment_id, Enrollment.student_id == student.id)
        .first()
    )
    if not enrollment or enrollment.status != EnrollmentStatus.enrolled:
        raise HTTPException(status_code=404, detail="Active enrollment not found")

    section = db.query(Section).filter(Section.id == enrollment.section_id).with_for_update().first()

    enrollment.status = EnrollmentStatus.dropped
    db.add(AuditLog(
        user_id=current_user.id, action="drop", table_name="enrollments",
        record_id=enrollment.id, details=f"section_id={section.id}",
    ))

    promoted_ids = promote_from_waitlist(db, section)

    db.commit()
    return DropResponse(
        status="dropped",
        promoted_student_id=promoted_ids[0] if promoted_ids else None,
    )