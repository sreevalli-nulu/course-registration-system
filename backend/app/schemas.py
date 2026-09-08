from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, EmailStr, ConfigDict

from app.models import RoleEnum


# ---------- Auth ----------

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: RoleEnum
    student_number: Optional[str] = None
    department: Optional[str] = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    full_name: str
    role: RoleEnum
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: RoleEnum


# ---------- Courses ----------

class CourseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    title: str
    credits: int
    description: Optional[str] = None


class CourseCreate(BaseModel):
    code: str
    title: str
    credits: int
    description: Optional[str] = None
    prerequisite_course_ids: List[int] = []


# ---------- Sections ----------

class SectionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    course_id: int
    instructor_id: Optional[int] = None
    term: str
    section_number: str
    room: Optional[str] = None
    meeting_time: Optional[str] = None
    capacity: int
    seats_taken: int = 0


class SectionCreate(BaseModel):
    course_id: int
    instructor_id: Optional[int] = None
    term: str
    section_number: str
    room: Optional[str] = None
    meeting_time: Optional[str] = None
    capacity: int


# ---------- Enrollments ----------

class EnrollmentCreate(BaseModel):
    section_id: int


class EnrollmentResponse(BaseModel):
    outcome: str
    section_id: int
    enrollment_id: Optional[int] = None
    waitlist_position: Optional[int] = None


class DropResponse(BaseModel):
    status: str
    promoted_student_id: Optional[int] = None
