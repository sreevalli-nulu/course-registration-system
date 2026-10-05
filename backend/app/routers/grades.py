from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    AuditLog, Course, Enrollment, EnrollmentStatus, Instructor, RoleEnum,
    Section, Student, User,
)
from app.schemas import GradeOut, GradeUpdate, TranscriptCourse, TranscriptResponse
from app.auth import require_role

router = APIRouter(tags=["grades"])

GRADE_POINTS = {
    "A": 4.0, "A-": 3.7, "B+": 3.3, "B": 3.0, "B-": 2.7,
    "C+": 2.3, "C": 2.0, "C-": 1.7, "D": 1.0, "F": 0.0,
}


def _term_key(term: str):
    """Sort key for terms like 'Spring2026': by year, then season."""
    year = int(term[-4:]) if term[-4:].isdigit() else 0
    season = {"spring": 0, "summer": 1, "fall": 2, "winter": 3}.get(term[:-4].lower(), 9)
    return (year, season)


def _graded_courses(db: Session, student_id: int):
    """Completed enrollments that have a grade, oldest term first."""
    rows = (
        db.query(Enrollment, Section, Course)
        .join(Section, Enrollment.section_id == Section.id)
        .join(Course, Section.course_id == Course.id)
        .filter(
            Enrollment.student_id == student_id,
            Enrollment.status == EnrollmentStatus.completed,
            Enrollment.grade.isnot(None),
        )
        .all()
    )
    return sorted(rows, key=lambda r: (_term_key(r[1].term), r[2].code))


def _gpa(rows) -> float:
    """Credit-weighted GPA. Failed courses count in the GPA but earn no credits."""
    points = sum(GRADE_POINTS[e.grade] * c.credits for e, _s, c in rows)
    credits = sum(c.credits for _e, _s, c in rows)
    return round(points / credits, 2) if credits else 0.0


@router.put("/enrollments/{enrollment_id}/grade", response_model=GradeOut)
def record_grade(
    enrollment_id: int,
    payload: GradeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.registrar, RoleEnum.instructor)),
):
    enrollment = db.query(Enrollment).filter(Enrollment.id == enrollment_id).first()
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    if enrollment.status == EnrollmentStatus.dropped:
        raise HTTPException(status_code=400, detail="Cannot grade a dropped enrollment")

    section = db.query(Section).filter(Section.id == enrollment.section_id).first()

    # Instructors may only grade their own sections; the registrar may grade any.
    if current_user.role == RoleEnum.instructor:
        instructor = db.query(Instructor).filter(Instructor.user_id == current_user.id).first()
        if not instructor or section.instructor_id != instructor.id:
            raise HTTPException(status_code=403, detail="You can only grade your own sections")

    enrollment.grade = payload.grade
    enrollment.status = EnrollmentStatus.completed
    db.flush()

    student = db.query(Student).filter(Student.id == enrollment.student_id).first()
    gpa = _gpa(_graded_courses(db, student.id))
    student.gpa = Decimal(str(gpa))

    db.add(AuditLog(
        user_id=current_user.id, action="grade", table_name="enrollments",
        record_id=enrollment.id, details=f"grade={payload.grade}, student_id={student.id}",
    ))
    db.commit()
    return GradeOut(
        enrollment_id=enrollment.id, status=enrollment.status.value,
        grade=payload.grade, student_gpa=gpa,
    )


@router.get("/students/me/transcript", response_model=TranscriptResponse)
def my_transcript(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.student)),
):
    student = db.query(Student).filter(Student.user_id == current_user.id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")

    rows = _graded_courses(db, student.id)
    return TranscriptResponse(
        gpa=_gpa(rows),
        total_credits=sum(c.credits for e, _s, c in rows if e.grade != "F"),
        courses=[
            TranscriptCourse(
                course_code=c.code, course_title=c.title, credits=c.credits,
                term=s.term, grade=e.grade,
            )
            for e, s, c in rows
        ],
    )