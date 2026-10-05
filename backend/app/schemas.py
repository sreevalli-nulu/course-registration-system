from datetime import datetime
from typing import Optional, List, Literal

from pydantic import BaseModel, EmailStr, ConfigDict, Field

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


# ---------- Current user / schedule ----------

class MeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    full_name: str
    role: RoleEnum


class ScheduleEnrolledItem(BaseModel):
    enrollment_id: int
    section_id: int
    course_code: str
    course_title: str
    credits: int
    term: str
    section_number: str
    room: Optional[str] = None
    meeting_time: Optional[str] = None


class ScheduleWaitlistItem(BaseModel):
    section_id: int
    course_code: str
    course_title: str
    term: str
    section_number: str
    position: int


class ScheduleResponse(BaseModel):
    enrolled: List[ScheduleEnrolledItem]
    waitlisted: List[ScheduleWaitlistItem]



# ---------- Grades / transcript ----------

class GradeUpdate(BaseModel):
    grade: Literal["A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D", "F"]


class GradeOut(BaseModel):
    enrollment_id: int
    status: str
    grade: str
    student_gpa: float


class TranscriptCourse(BaseModel):
    course_code: str
    course_title: str
    credits: int
    term: str
    grade: str


class TranscriptResponse(BaseModel):
    gpa: float
    total_credits: int
    courses: List[TranscriptCourse]



# ---------- Admin: waitlist view, course and section editing ----------

class WaitlistEntryOut(BaseModel):
    position: int
    student_id: int
    student_number: str
    full_name: str
    added_at: datetime


class WaitlistOut(BaseModel):
    section_id: int
    course_code: str
    term: str
    section_number: str
    capacity: int
    seats_taken: int
    entries: List[WaitlistEntryOut]


class CoursePrereqOut(BaseModel):
    id: int
    code: str
    title: str


class CourseDetailOut(BaseModel):
    id: int
    code: str
    title: str
    credits: int
    description: Optional[str] = None
    prerequisites: List[CoursePrereqOut]


class CourseUpdate(BaseModel):
    title: Optional[str] = None
    credits: Optional[int] = Field(default=None, gt=0)
    description: Optional[str] = None
    prerequisite_course_ids: Optional[List[int]] = None


class SectionUpdate(BaseModel):
    instructor_id: Optional[int] = None
    term: Optional[str] = None
    section_number: Optional[str] = None
    room: Optional[str] = None
    meeting_time: Optional[str] = None
    capacity: Optional[int] = Field(default=None, gt=0)



# ---------- Staff: rosters and "my sections" ----------

class RosterEntryOut(BaseModel):
    enrollment_id: int
    student_id: int
    student_number: str
    full_name: str
    status: str
    grade: Optional[str] = None


class RosterOut(BaseModel):
    section_id: int
    course_code: str
    course_title: str
    term: str
    section_number: str
    capacity: int
    seats_taken: int
    students: List[RosterEntryOut]


class InstructorSectionOut(BaseModel):
    section_id: int
    course_code: str
    course_title: str
    credits: int
    term: str
    section_number: str
    room: Optional[str] = None
    meeting_time: Optional[str] = None
    capacity: int
    seats_taken: int
    waitlist_count: int