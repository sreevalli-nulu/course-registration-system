from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    User, Student, Enrollment, EnrollmentStatus, Section, Course, Waitlist, RoleEnum,
)
from app.schemas import MeOut, ScheduleResponse, ScheduleEnrolledItem, ScheduleWaitlistItem
from app.auth import get_current_user, require_role

router = APIRouter(tags=["me"])


@router.get("/auth/me", response_model=MeOut)
def read_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/students/me/schedule", response_model=ScheduleResponse)
def my_schedule(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.student)),
):
    student = db.query(Student).filter(Student.user_id == current_user.id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")

    enrolled_rows = (
        db.query(Enrollment, Section, Course)
        .join(Section, Enrollment.section_id == Section.id)
        .join(Course, Section.course_id == Course.id)
        .filter(
            Enrollment.student_id == student.id,
            Enrollment.status == EnrollmentStatus.enrolled,
        )
        .order_by(Course.code)
        .all()
    )
    waitlist_rows = (
        db.query(Waitlist, Section, Course)
        .join(Section, Waitlist.section_id == Section.id)
        .join(Course, Section.course_id == Course.id)
        .filter(Waitlist.student_id == student.id)
        .order_by(Course.code)
        .all()
    )

    return ScheduleResponse(
        enrolled=[
            ScheduleEnrolledItem(
                enrollment_id=e.id, section_id=s.id, course_code=c.code,
                course_title=c.title, credits=c.credits, term=s.term,
                section_number=s.section_number, room=s.room,
                meeting_time=s.meeting_time,
            )
            for e, s, c in enrolled_rows
        ],
        waitlisted=[
            ScheduleWaitlistItem(
                section_id=s.id, course_code=c.code, course_title=c.title,
                term=s.term, section_number=s.section_number, position=w.position,
            )
            for w, s, c in waitlist_rows
        ],
    )