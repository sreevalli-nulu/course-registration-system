import enum
from datetime import datetime

from sqlalchemy import (
    Column, Integer, String, Text, Numeric, ForeignKey, DateTime,
    Enum as SAEnum, UniqueConstraint, CheckConstraint
)
from sqlalchemy.orm import relationship

from app.database import Base


class RoleEnum(str, enum.Enum):
    student = "student"
    instructor = "instructor"
    registrar = "registrar"


class EnrollmentStatus(str, enum.Enum):
    enrolled = "enrolled"
    dropped = "dropped"
    completed = "completed"


class User(Base):
    """Auth identity. Role drives what a token holder is allowed to do."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(SAEnum(RoleEnum), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    student_profile = relationship("Student", back_populates="user", uselist=False)
    instructor_profile = relationship("Instructor", back_populates="user", uselist=False)


class Student(Base):
    """1:1 extension of User for student-specific fields."""
    __tablename__ = "students"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    student_number = Column(String(50), unique=True, nullable=False)
    major = Column(String(100), nullable=True)
    gpa = Column(Numeric(3, 2), default=0.00, nullable=False)

    user = relationship("User", back_populates="student_profile")
    enrollments = relationship("Enrollment", back_populates="student")


class Instructor(Base):
    """1:1 extension of User for instructor-specific fields."""
    __tablename__ = "instructors"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    department = Column(String(100), nullable=True)

    user = relationship("User", back_populates="instructor_profile")
    sections = relationship("Section", back_populates="instructor")


class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True)
    code = Column(String(20), unique=True, nullable=False, index=True)  # e.g. "CS301"
    title = Column(String(255), nullable=False)
    credits = Column(Integer, nullable=False)
    description = Column(Text, nullable=True)

    sections = relationship("Section", back_populates="course")

    # Prerequisites this course requires (self-referential many-to-many)
    prerequisites = relationship(
        "Prerequisite",
        foreign_keys="Prerequisite.course_id",
        back_populates="course",
    )


class Prerequisite(Base):
    """
    course_id requires prerequisite_course_id to be completed first.
    Kept as its own table (rather than a plain association table) so
    each edge could later carry attributes, e.g. minimum grade required.
    """
    __tablename__ = "prerequisites"

    course_id = Column(Integer, ForeignKey("courses.id"), primary_key=True)
    prerequisite_course_id = Column(Integer, ForeignKey("courses.id"), primary_key=True)

    course = relationship("Course", foreign_keys=[course_id], back_populates="prerequisites")
    prerequisite_course = relationship("Course", foreign_keys=[prerequisite_course_id])

    __table_args__ = (
        CheckConstraint("course_id != prerequisite_course_id", name="ck_no_self_prereq"),
    )


class Section(Base):
    """A specific offering of a Course in a given term (what students actually enroll in)."""
    __tablename__ = "sections"

    id = Column(Integer, primary_key=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    instructor_id = Column(Integer, ForeignKey("instructors.id"), nullable=True)
    term = Column(String(20), nullable=False)  # e.g. "Fall2026"
    section_number = Column(String(10), nullable=False)  # e.g. "01"
    room = Column(String(50), nullable=True)
    meeting_time = Column(String(100), nullable=True)  # e.g. "MWF 09:00-09:50"
    capacity = Column(Integer, nullable=False)

    course = relationship("Course", back_populates="sections")
    instructor = relationship("Instructor", back_populates="sections")
    enrollments = relationship("Enrollment", back_populates="section")
    waitlist_entries = relationship("Waitlist", back_populates="section")

    __table_args__ = (
        UniqueConstraint("course_id", "term", "section_number", name="uq_section_identity"),
    )


class Enrollment(Base):
    """
    One row per (student, section) the student has ever enrolled in.
    Seat-count and prerequisite checks happen in the /enrollments endpoint,
    inside a transaction — not enforced by the schema alone.
    """
    __tablename__ = "enrollments"

    id = Column(Integer, primary_key=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    section_id = Column(Integer, ForeignKey("sections.id"), nullable=False)
    status = Column(SAEnum(EnrollmentStatus), nullable=False, default=EnrollmentStatus.enrolled)
    grade = Column(String(2), nullable=True)  # e.g. "A", "B+" — set after course completion
    enrolled_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    student = relationship("Student", back_populates="enrollments")
    section = relationship("Section", back_populates="enrollments")

    __table_args__ = (
        UniqueConstraint("student_id", "section_id", name="uq_student_section"),
    )


class Waitlist(Base):
    """FIFO queue per section, ordered by position. A trigger promotes the
    top entry into Enrollment when a seat opens up (see migrations)."""
    __tablename__ = "waitlist"

    id = Column(Integer, primary_key=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    section_id = Column(Integer, ForeignKey("sections.id"), nullable=False)
    position = Column(Integer, nullable=False)
    added_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    section = relationship("Section", back_populates="waitlist_entries")

    __table_args__ = (
        UniqueConstraint("student_id", "section_id", name="uq_waitlist_student_section"),
        UniqueConstraint("section_id", "position", name="uq_waitlist_position"),
    )


class AuditLog(Base):
    """Append-only trail of enrollment-affecting actions. Populated by a
    trigger in Postgres (see migrations), not written by application code,
    so it stays trustworthy even if a bug bypasses the API layer."""
    __tablename__ = "audit_log"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String(50), nullable=False)  # e.g. "enroll", "drop", "waitlist_promote"
    table_name = Column(String(50), nullable=False)
    record_id = Column(Integer, nullable=True)
    details = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
