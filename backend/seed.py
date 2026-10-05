"""Fill the database with sample data for development and demos.

Safe to run more than once: anything that already exists (matched by email,
course code, section identity, student number) is left alone, so your existing
test users and courses are never changed or duplicated.

Run from the backend folder:   python seed.py
All seeded accounts use the password:   pass1234
"""
from collections import Counter
from decimal import Decimal

from sqlalchemy.engine import make_url

from app.auth import hash_password
from app.database import DATABASE_URL, SessionLocal
from app.models import (
    Course, Enrollment, EnrollmentStatus, Instructor, Prerequisite, RoleEnum,
    Section, Student, User, Waitlist,
)

DEFAULT_PASSWORD = "pass1234"

GRADE_POINTS = {
    "A": 4.0, "A-": 3.7, "B+": 3.3, "B": 3.0, "B-": 2.7,
    "C+": 2.3, "C": 2.0, "C-": 1.7, "D": 1.0, "F": 0.0,
}

# (email, full name, department)
INSTRUCTORS = [
    ("instructor1@college.edu", "Dr. Meera Krishnan", "Computer Science"),
    ("instructor2@college.edu", "Dr. Suresh Babu", "Computer Science"),
    ("instructor3@college.edu", "Dr. Lakshmi Prasad", "Mathematics"),
]

# (code, title, credits, description, [prerequisite codes])
# Chain for the recursive prerequisite demo: CS401 -> CS202 -> CS201 -> CS101
COURSES = [
    ("CS101", "Intro to Programming", 3, "Basics of programming", []),
    ("CS102", "Web Development", 3, "Basics of web dev", []),
    ("MA101", "Calculus I", 4, "Limits, derivatives and integrals", []),
    ("CS201", "Data Structures", 4, "Lists, trees, graphs and hashing", ["CS101"]),
    ("MA201", "Discrete Mathematics", 3, "Logic, sets, relations and graphs", ["MA101"]),
    ("CS202", "Database Management Systems", 4,
     "Relational model, SQL, normalization and transactions", ["CS201"]),
    ("CS301", "Algorithms", 4, "Design and analysis of algorithms", ["CS201", "MA201"]),
    ("CS302", "Operating Systems", 4, "Processes, memory and file systems", ["CS201"]),
    ("CS401", "Advanced Database Systems", 3,
     "Query optimization, indexing and concurrency control", ["CS202"]),
]

# (code, term, section number, instructor index, room, meeting time, capacity)
SECTIONS = [
    # Past term: needed so students can have completed courses on their record
    ("CS101", "Spring2026", "01", 0, "A101", "MWF 09:00-09:50", 50),
    ("MA101", "Spring2026", "01", 2, "B201", "MWF 10:00-10:50", 50),
    ("CS201", "Spring2026", "01", 1, "A201", "MWF 11:00-11:50", 50),
    ("MA201", "Spring2026", "01", 2, "B202", "TTh 09:30-10:45", 50),
    ("CS102", "Spring2026", "01", 1, "A102", "TTh 11:00-12:15", 50),
    # Current term
    ("CS101", "Fall2026", "01", 0, "A101", "MWF 09:00-09:50", 40),
    ("CS101", "Fall2026", "02", 0, "A102", "TTh 11:00-12:15", 30),
    ("CS102", "Fall2026", "02", 1, "A103", "TTh 14:00-15:15", 35),
    ("MA101", "Fall2026", "01", 2, "B201", "MWF 10:00-10:50", 40),
    ("CS201", "Fall2026", "01", 1, "A201", "MWF 11:00-11:50", 2),   # tiny: fills up, has a waitlist
    ("CS201", "Fall2026", "02", 1, "A202", "TTh 14:00-15:15", 30),
    ("MA201", "Fall2026", "01", 2, "B202", "TTh 09:30-10:45", 30),
    ("CS202", "Fall2026", "01", 0, "Lab 3", "MWF 14:00-14:50", 25),
    ("CS301", "Fall2026", "01", 1, "A301", "TTh 16:00-17:15", 25),
    ("CS302", "Fall2026", "01", 2, "A302", "MWF 15:00-15:50", 25),
    ("CS401", "Fall2026", "01", 0, "Lab 4", "TTh 10:00-11:15", 20),
]

# (email, full name, student number, major, {course code: grade in Spring2026})
STUDENTS = [
    ("student3@college.edu", "Ananya Rao", "S1003", "Computer Science",
     {"CS101": "A", "MA101": "A-", "CS201": "B+", "MA201": "B"}),
    ("student4@college.edu", "Rahul Verma", "S1004", "Computer Science", {"CS101": "B+"}),
    ("student5@college.edu", "Priya Nair", "S1005", "Computer Science", {}),
    ("student6@college.edu", "Karthik Reddy", "S1006", "Computer Science",
     {"CS101": "A-", "MA101": "B"}),
    ("student7@college.edu", "Sneha Iyer", "S1007", "Computer Science",
     {"CS101": "B", "CS201": "A-"}),
    ("student8@college.edu", "Arjun Mehta", "S1008", "Computer Science",
     {"CS101": "A", "CS201": "A", "CS102": "B+"}),
    ("student9@college.edu", "Divya Menon", "S1009", "Mathematics", {"MA101": "B+"}),
    ("student10@college.edu", "Vikram Singh", "S1010", "Computer Science",
     {"CS101": "C+", "MA101": "B-"}),
]

# Current-term demo state: (student email, course code, section number)
FALL_ENROLLMENTS = [
    ("student5@college.edu", "CS101", "01"),
    ("student4@college.edu", "CS201", "01"),   # fills CS201-01 (capacity 2)
    ("student6@college.edu", "CS201", "01"),
    ("student3@college.edu", "CS202", "01"),
    ("student8@college.edu", "CS202", "01"),
    ("student9@college.edu", "MA201", "01"),
]
FALL_WAITLIST = [
    ("student10@college.edu", "CS201", "01"),  # waitlist position 1 for the full section
]


def main():
    url = make_url(DATABASE_URL)
    target = url.host or url.drivername
    print(f"Seeding database: {target}")

    db = SessionLocal()
    created = Counter()
    password_hash = hash_password(DEFAULT_PASSWORD)

    def get_or_create_user(email, full_name, role):
        user = db.query(User).filter(User.email == email).first()
        if user:
            return user
        user = User(email=email, hashed_password=password_hash, full_name=full_name, role=role)
        db.add(user)
        db.flush()
        created["users"] += 1
        return user

    try:
        # Registrar
        get_or_create_user("registrar@college.edu", "Reg Istrar", RoleEnum.registrar)

        # Instructors
        instructors = []
        for email, name, dept in INSTRUCTORS:
            user = get_or_create_user(email, name, RoleEnum.instructor)
            profile = db.query(Instructor).filter(Instructor.user_id == user.id).first()
            if not profile:
                profile = Instructor(user_id=user.id, department=dept)
                db.add(profile)
                db.flush()
                created["instructors"] += 1
            instructors.append(profile)

        # Courses
        courses = {}
        for code, title, credits, desc, _prereqs in COURSES:
            course = db.query(Course).filter(Course.code == code).first()
            if not course:
                course = Course(code=code, title=title, credits=credits, description=desc)
                db.add(course)
                db.flush()
                created["courses"] += 1
            courses[code] = course

        # Prerequisites
        for code, _t, _c, _d, prereqs in COURSES:
            for prereq_code in prereqs:
                exists = (
                    db.query(Prerequisite)
                    .filter(
                        Prerequisite.course_id == courses[code].id,
                        Prerequisite.prerequisite_course_id == courses[prereq_code].id,
                    )
                    .first()
                )
                if not exists:
                    db.add(Prerequisite(
                        course_id=courses[code].id,
                        prerequisite_course_id=courses[prereq_code].id,
                    ))
                    created["prerequisites"] += 1
        db.flush()

        # Sections
        sections = {}
        for code, term, number, inst_idx, room, meeting, capacity in SECTIONS:
            section = (
                db.query(Section)
                .filter(
                    Section.course_id == courses[code].id,
                    Section.term == term,
                    Section.section_number == number,
                )
                .first()
            )
            if not section:
                section = Section(
                    course_id=courses[code].id, instructor_id=instructors[inst_idx].id,
                    term=term, section_number=number, room=room,
                    meeting_time=meeting, capacity=capacity,
                )
                db.add(section)
                db.flush()
                created["sections"] += 1
            sections[(code, term, number)] = section

        # Students, with completed Spring2026 history
        students = {}
        for email, name, number, major, history in STUDENTS:
            user = get_or_create_user(email, name, RoleEnum.student)
            student = db.query(Student).filter(Student.user_id == user.id).first()
            if not student:
                student = Student(user_id=user.id, student_number=number, major=major)
                db.add(student)
                db.flush()
                created["students"] += 1
            students[email] = student

            for code, grade in history.items():
                section = sections[(code, "Spring2026", "01")]
                done = (
                    db.query(Enrollment)
                    .filter(Enrollment.student_id == student.id, Enrollment.section_id == section.id)
                    .first()
                )
                if not done:
                    db.add(Enrollment(
                        student_id=student.id, section_id=section.id,
                        status=EnrollmentStatus.completed, grade=grade,
                    ))
                    created["completed courses"] += 1

            # Credit-weighted GPA from completed courses
            points = credits_total = 0
            for code, grade in history.items():
                credit = courses[code].credits
                points += GRADE_POINTS[grade] * credit
                credits_total += credit
            student.gpa = Decimal(str(round(points / credits_total, 2))) if credits_total else Decimal("0.00")
        db.flush()

        # Current-term enrollments
        for email, code, number in FALL_ENROLLMENTS:
            student, section = students[email], sections[(code, "Fall2026", number)]
            exists = (
                db.query(Enrollment)
                .filter(Enrollment.student_id == student.id, Enrollment.section_id == section.id)
                .first()
            )
            if not exists:
                db.add(Enrollment(
                    student_id=student.id, section_id=section.id,
                    status=EnrollmentStatus.enrolled,
                ))
                created["current enrollments"] += 1

        # Waitlist
        for email, code, number in FALL_WAITLIST:
            student, section = students[email], sections[(code, "Fall2026", number)]
            exists = (
                db.query(Waitlist)
                .filter(Waitlist.student_id == student.id, Waitlist.section_id == section.id)
                .first()
            )
            if not exists:
                last = (
                    db.query(Waitlist.position)
                    .filter(Waitlist.section_id == section.id)
                    .order_by(Waitlist.position.desc())
                    .first()
                )
                db.add(Waitlist(
                    student_id=student.id, section_id=section.id,
                    position=(last[0] + 1) if last else 1,
                ))
                created["waitlist entries"] += 1

        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    if created:
        print("Created:")
        for name, count in created.items():
            print(f"  {count} {name}")
    else:
        print("Nothing to create: the database already has all the seed data.")
    print(f"\nAll seeded accounts use the password: {DEFAULT_PASSWORD}")


if __name__ == "__main__":
    main()