from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Course, Prerequisite, RoleEnum
from app.schemas import CourseOut, CourseCreate
from app.auth import require_role

router = APIRouter(prefix="/courses", tags=["courses"])


@router.get("", response_model=List[CourseOut])
def list_courses(db: Session = Depends(get_db)):
    return db.query(Course).order_by(Course.code).all()


@router.get("/{course_id}", response_model=CourseOut)
def get_course(course_id: int, db: Session = Depends(get_db)):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return course


@router.post(
    "",
    response_model=CourseOut,
    status_code=201,
    dependencies=[Depends(require_role(RoleEnum.registrar))],
)
def create_course(payload: CourseCreate, db: Session = Depends(get_db)):
    if db.query(Course).filter(Course.code == payload.code).first():
        raise HTTPException(status_code=400, detail="Course code already exists")

    course = Course(
        code=payload.code,
        title=payload.title,
        credits=payload.credits,
        description=payload.description,
    )
    db.add(course)
    db.flush()

    for prereq_id in payload.prerequisite_course_ids:
        if prereq_id == course.id:
            continue
        db.add(Prerequisite(course_id=course.id, prerequisite_course_id=prereq_id))

    db.commit()
    db.refresh(course)
    return course
