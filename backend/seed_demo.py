"""Fill the database with a realistic demo university.

WARNING: this DELETES ALL DATA in the database it is pointed at (users, courses,
sections, enrollments, waitlists, notifications ...) and builds a fresh dataset:

  * 28 courses across CS / Data Science / Maths / English, with a prerequisite web
  * 10 instructors, 1 registrar, 44 students in four intake years
  * 6 past terms of history: completed courses with grades, a few failures and retakes
  * the current term (Fall2026) with real enrollments, full sections and waitlists

Run from the backend folder:
    python seed_demo.py --reset

Everyone's password is:  pass1234
The script writes DEMO_GUIDE.md next to itself, listing ready-made demo scenarios.
"""
import argparse
import math
import random
import sys
from collections import Counter, defaultdict
from decimal import Decimal
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.engine import make_url

from app.auth import hash_password
from app.database import DATABASE_URL, SessionLocal, engine
from app.settings import CURRENT_TERM as APP_CURRENT_TERM
from app.models import (
    Course, Enrollment, EnrollmentStatus, Instructor, Prerequisite, RoleEnum,
    Section, Student, User, Waitlist,
)

PASSWORD = "pass1234"
CURRENT_TERM = "Fall2026"
PAST_TERMS = ["Fall2023", "Spring2024", "Fall2024", "Spring2025", "Fall2025", "Spring2026"]
ALL_TERMS = PAST_TERMS + [CURRENT_TERM]

GRADE_POINTS = {
    "A": 4.0, "A-": 3.7, "B+": 3.3, "B": 3.0, "B-": 2.7,
    "C+": 2.3, "C": 2.0, "C-": 1.7, "D": 1.0, "F": 0.0,
}

# ---------------------------------------------------------------- instructors
# (first, last, department)
INSTRUCTORS = [
    ("Meera", "Krishnan", "Computer Science"),      # 0
    ("Suresh", "Babu", "Computer Science"),         # 1
    ("Anitha", "Rao", "Computer Science"),          # 2
    ("Rajesh", "Menon", "Computer Science"),        # 3
    ("Kavitha", "Subramanian", "Computer Science"), # 4
    ("Arjun", "Nair", "Computer Science"),          # 5
    ("Lakshmi", "Prasad", "Mathematics"),           # 6
    ("Venkat", "Reddy", "Mathematics"),             # 7
    ("Sunita", "Verma", "Humanities"),              # 8
    ("Farhan", "Ali", "Data Science"),              # 9
]

# ------------------------------------------------------------------- courses
# code: (title, credits, description, [prerequisites], instructor index)
COURSES = {
    "EN101": ("Technical Communication", 3, "Writing, presentation and documentation skills for engineers.", [], 8),
    "MA101": ("Calculus", 4, "Limits, differentiation, integration and series.", [], 6),
    "MA102": ("Linear Algebra", 3, "Vector spaces, matrices, eigenvalues and transformations.", [], 7),
    "MA201": ("Probability and Statistics", 3, "Random variables, distributions, estimation and hypothesis testing.", ["MA101"], 7),
    "MA202": ("Discrete Mathematics", 3, "Logic, sets, relations, counting and graph theory.", ["MA101"], 6),
    "CS101": ("Introduction to Programming", 4, "Problem solving and programming fundamentals in Python.", [], 0),
    "CS102": ("Web Fundamentals", 3, "HTML, CSS and JavaScript basics for building web pages.", [], 3),
    "CS201": ("Data Structures", 4, "Arrays, linked lists, trees, graphs, hashing and complexity.", ["CS101"], 1),
    "CS203": ("Computer Organization", 3, "Digital logic, processor design, memory hierarchy and I/O.", ["CS101"], 2),
    "CS204": ("Object-Oriented Programming", 3, "Classes, inheritance, polymorphism and design patterns in Java.", ["CS101"], 5),
    "CS202": ("Database Management Systems", 4, "Relational model, SQL, normalization, transactions and indexing.", ["CS201"], 0),
    "CS301": ("Operating Systems", 4, "Processes, scheduling, memory management and file systems.", ["CS201", "CS203"], 1),
    "CS302": ("Computer Networks", 3, "Layered architecture, TCP/IP, routing and network security basics.", ["CS203"], 2),
    "CS303": ("Design and Analysis of Algorithms", 4, "Divide and conquer, dynamic programming, greedy methods, NP-completeness.", ["CS201", "MA202"], 4),
    "CS304": ("Software Engineering", 3, "Requirements, design, testing, agile process and team projects.", ["CS204"], 5),
    "CS305": ("Web Technologies", 3, "Full-stack web development with REST APIs and modern frameworks.", ["CS204", "CS202"], 3),
    "CS306": ("Theory of Computation", 3, "Automata, formal languages, Turing machines and decidability.", ["MA202"], 4),
    "CS401": ("Advanced Database Systems", 3, "Query optimization, concurrency control, recovery and distributed databases.", ["CS202"], 0),
    "CS402": ("Machine Learning", 4, "Supervised and unsupervised learning, model evaluation and applications.", ["CS303", "MA201"], 4),
    "CS403": ("Cloud Computing", 3, "Virtualization, containers, cloud services and deployment.", ["CS301", "CS302"], 2),
    "CS404": ("Information Security", 3, "Cryptography, authentication, secure software and network defence.", ["CS302"], 1),
    "CS405": ("Artificial Intelligence", 3, "Search, knowledge representation, planning and reasoning.", ["CS303"], 4),
    "CS406": ("Distributed Systems", 3, "Consensus, replication, fault tolerance and distributed storage.", ["CS301", "CS302"], 1),
    "CS410": ("Capstone Project", 4, "A semester-long team project built end to end.", ["CS304", "CS305"], 5),
    "DS301": ("Data Mining", 3, "Pattern discovery, clustering, classification and association rules.", ["CS202", "MA201"], 9),
    "DS302": ("Big Data Analytics", 3, "Batch and stream processing on distributed data platforms.", ["DS301"], 9),
    "DS303": ("Deep Learning", 3, "Neural networks, CNNs, sequence models and training practice.", ["CS402"], 9),
    "CS499": ("Industry Seminar", 3, "Guest talks, case studies and career preparation.", ["CS304"], 8),
}

# The curriculum, semester by semester. Intake year decides where a student starts.
PLAN = {
    1: ["CS101", "MA101", "EN101", "CS102"],
    2: ["CS201", "CS203", "CS204", "MA202"],
    3: ["CS202", "MA102", "MA201", "CS304"],
    4: ["CS301", "CS302", "CS303", "CS306"],
    5: ["CS305", "CS401", "DS301", "CS404"],
    6: ["CS402", "CS403", "CS405", "DS302"],
    7: ["CS406", "CS410", "DS303"],
}

# cohort: (intake term, first plan semester, headcount, student-number prefix)
COHORTS = [
    ("A", "Fall2023", 10, "23CS"),
    ("B", "Fall2024", 14, "24CS"),
    ("C", "Fall2025", 12, "25CS"),
    ("D", "Fall2026", 8, "26CS"),
]

FIRST_NAMES = [
    "Aarav", "Vivaan", "Aditya", "Dhruv", "Sai", "Reyansh", "Krishna", "Ishaan", "Rohan", "Karthik",
    "Ananya", "Diya", "Meghana", "Kavya", "Priya", "Sneha", "Pooja", "Nikhil", "Rahul", "Siddharth",
    "Harini", "Mythili", "Divya", "Aishwarya", "Sravani", "Bhavana", "Tejaswini", "Varun", "Manoj", "Pranav",
    "Deepika", "Swathi", "Keerthi", "Naveen", "Surya", "Charan", "Mahesh", "Yamini", "Akshay", "Nandini",
    "Vamsi", "Pavani", "Harsha", "Ritika", "Tarun", "Shreya", "Dinesh", "Anjali",
]
LAST_NAMES = [
    "Sharma", "Reddy", "Nair", "Iyer", "Rao", "Kumar", "Patel", "Naidu", "Menon", "Varma", "Gupta",
    "Chowdary", "Pillai", "Das", "Singh", "Raju", "Krishnan", "Bhat", "Joshi", "Mehta", "Kulkarni", "Desai",
]

# Students who fail a course on their first attempt (cohort letter, index in cohort, course)
FIRST_ATTEMPT_FAILS = [("A", 2, "CS303"), ("B", 5, "CS201"), ("B", 9, "MA201"), ("C", 4, "CS101")]

# A few students who are weaker / stronger than the cohort average
ABILITY_OVERRIDES = {("A", 0): 3.9, ("A", 1): 3.75, ("B", 0): 3.85, ("B", 3): 2.0, ("C", 2): 3.8, ("C", 7): 2.1}

# Slots: sections in the same slot clash. (MWF and TTh slots never overlap each other.)
SLOTS = [
    "MWF 09:00-09:50", "MWF 10:00-10:50", "MWF 11:00-11:50", "MWF 14:00-14:50", "MWF 15:00-15:50",
    "TTh 09:30-10:45", "TTh 11:00-12:15", "TTh 14:00-15:15", "TTh 15:30-16:45",
]
ROOMS = ["A101", "A102", "A201", "A202", "B101", "B201", "B202", "Seminar Hall", "Auditorium"]
LABS = ["Lab 1", "Lab 2", "Lab 3", "Lab 4"]
LAB_COURSES = {"CS101", "CS201", "CS202", "CS204", "CS305", "CS401", "CS402", "DS301", "DS302", "DS303", "CS410"}

# Current-term (Fall2026) offerings: code -> list of (section number, slot, capacity-or-None)
# capacity None means "decide from demand". See build_current_term().
FALL_SLOTS = {
    "CS101": ["MWF 09:00-09:50"], "MA101": ["MWF 10:00-10:50"], "EN101": ["TTh 09:30-10:45"], "CS102": ["TTh 11:00-12:15"],
    "CS202": ["MWF 11:00-11:50", "TTh 09:30-10:45"], "MA102": ["TTh 14:00-15:15"], "MA201": ["MWF 14:00-14:50"], "CS304": ["TTh 15:30-16:45"],
    "CS305": ["MWF 15:00-15:50", "TTh 11:00-12:15"], "CS401": ["TTh 14:00-15:15"], "DS301": ["MWF 09:00-09:50"], "CS404": ["TTh 15:30-16:45"],
    "CS406": ["MWF 10:00-10:50"], "CS410": ["TTh 09:30-10:45"], "DS303": ["MWF 14:00-14:50"],
}


def grade_from_score(score):
    for cutoff, grade in [(3.85, "A"), (3.5, "A-"), (3.15, "B+"), (2.85, "B"), (2.5, "B-"),
                          (2.15, "C+"), (1.85, "C"), (1.5, "C-")]:
        if score >= cutoff:
            return grade
    return "D"


def build_people(rng):
    """Returns the list of student dicts (name, email, number, cohort, ability ...)."""
    firsts = FIRST_NAMES[:]
    rng.shuffle(firsts)
    students = []
    k = 0
    for letter, intake, count, prefix in COHORTS:
        for i in range(count):
            first = firsts[k]
            last = LAST_NAMES[(k * 5 + k // 22) % len(LAST_NAMES)]
            ability = ABILITY_OVERRIDES.get((letter, i), min(3.95, max(2.2, rng.gauss(3.1, 0.45))))
            students.append({
                "cohort": letter, "index": i, "intake": intake,
                "name": f"{first} {last}",
                "email": f"{first.lower()}.{last.lower()}@college.edu",
                "number": f"{prefix}{1001 + i}",
                "major": "Data Science" if (k % 4 == 3) else "Computer Science",
                "ability": ability,
            })
            k += 1
    return students


def first_plan_semester(intake):
    """Plan semester a student is in during each term (intake term = semester 1)."""
    start = ALL_TERMS.index(intake)
    return {term: idx - start + 1 for idx, term in enumerate(ALL_TERMS) if idx >= start}


def prereq_closure(code, direct):
    seen, stack = set(), list(direct[code])
    while stack:
        c = stack.pop()
        if c not in seen:
            seen.add(c)
            stack.extend(direct[c])
    return seen


def simulate(students, rng):
    """Term-by-term history. A course is taken once its prerequisites are passed;
    failed or blocked courses roll forward to later terms."""
    direct = {code: COURSES[code][3] for code in COURSES}
    fail_marks = {(c, i, code) for c, i, code in FIRST_ATTEMPT_FAILS}
    for s in students:
        sem_by_term = first_plan_semester(s["intake"])
        s["history"] = []          # (term, code, grade)
        passed = set()
        attempted = set()
        for term in ALL_TERMS:
            if term not in sem_by_term:
                continue
            sem = sem_by_term[term]
            wanted = []
            for sm in range(1, min(sem, 7) + 1):
                for code in PLAN[sm]:
                    if code not in passed and all(p in passed for p in direct[code]):
                        wanted.append(code)
            wanted = wanted[:5]
            if term == CURRENT_TERM:
                s["wanted_current"] = wanted
                continue
            term_results = []
            for code in wanted:
                if (s["cohort"], s["index"], code) in fail_marks and code not in attempted:
                    grade = "F"
                else:
                    grade = grade_from_score(s["ability"] + rng.uniform(-0.45, 0.35))
                attempted.add(code)
                term_results.append((term, code, grade))
            # credit only after the term, so same-term courses never count as prerequisites
            for _t, code, grade in term_results:
                if grade != "F":
                    passed.add(code)
            s["history"].extend(term_results)
        s["passed"] = passed
    return students


def make_user(email, name, role):
    return User(email=email, hashed_password=PASSWORD_HASH, full_name=name, role=role)


def reset_database(db):
    if engine.dialect.name == "postgresql":
        db.execute(text(
            "TRUNCATE notifications, enrollment_history, audit_log, waitlist, enrollments, "
            "sections, prerequisites, courses, students, instructors, users RESTART IDENTITY CASCADE"
        ))
    else:
        for table in ["notifications", "enrollment_history", "audit_log", "waitlist", "enrollments",
                      "sections", "prerequisites", "courses", "students", "instructors", "users"]:
            db.execute(text(f"DELETE FROM {table}"))
    db.commit()


def main():
    global PASSWORD_HASH
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true", help="delete ALL existing data first (required)")
    parser.add_argument("--yes", action="store_true", help="do not ask for confirmation")
    args = parser.parse_args()

    url = make_url(DATABASE_URL)
    target = f"{url.host or url.drivername}/{url.database}"
    if not args.reset:
        print("This script replaces ALL data in the database. Re-run with --reset to confirm.")
        sys.exit(1)
    print(f"Target database: {target}")
    if not args.yes:
        answer = input("This will DELETE ALL DATA there. Type 'reset' to continue: ")
        if answer.strip().lower() != "reset":
            print("Cancelled. Nothing was changed.")
            sys.exit(1)

    if APP_CURRENT_TERM != CURRENT_TERM:
        print(f"Warning: this data is built for {CURRENT_TERM}, but the app's CURRENT_TERM is "
              f"{APP_CURRENT_TERM}. Set CURRENT_TERM={CURRENT_TERM} in .env or enrollment will look closed.")

    rng = random.Random(2026)
    PASSWORD_HASH = hash_password(PASSWORD)
    students = simulate(build_people(rng), rng)
    # Two eligible students have not registered for DS301 yet: one seat, two students (see DEMO_GUIDE.md)
    for s in students:
        if s["cohort"] == "B" and s["index"] in (12, 13) and "DS301" in s["wanted_current"]:
            s["wanted_current"].remove("DS301")
            s["ds301_candidate"] = True

    db = SessionLocal()
    try:
        reset_database(db)

        # ---- registrar + instructors
        db.add(make_user("registrar@college.edu", "Priya Natarajan", RoleEnum.registrar))
        instructors = []
        for first, last, dept in INSTRUCTORS:
            user = make_user(f"{first.lower()}.{last.lower()}@college.edu", f"Dr. {first} {last}", RoleEnum.instructor)
            db.add(user)
            db.flush()
            profile = Instructor(user_id=user.id, department=dept)
            db.add(profile)
            instructors.append(profile)
        db.flush()

        # ---- courses and prerequisites
        courses = {}
        for code, (title, credits, desc, _p, _i) in COURSES.items():
            courses[code] = Course(code=code, title=title, credits=credits, description=desc)
            db.add(courses[code])
        db.flush()
        for code, (_t, _c, _d, prereqs, _i) in COURSES.items():
            for p in prereqs:
                db.add(Prerequisite(course_id=courses[code].id, prerequisite_course_id=courses[p].id))
        db.flush()

        # ---- students
        records = {}
        for s in students:
            user = make_user(s["email"], s["name"], RoleEnum.student)
            db.add(user)
            db.flush()
            student = Student(user_id=user.id, student_number=s["number"], major=s["major"])
            db.add(student)
            records[s["email"]] = student
        db.flush()

        # ---- past terms: sections are created as the history needs them
        sections = {}   # (code, term, number) -> Section

        def past_section(code, term):
            key = (code, term, "01")
            if key not in sections:
                idx = list(COURSES).index(code)
                room = LABS[idx % len(LABS)] if code in LAB_COURSES else ROOMS[idx % len(ROOMS)]
                sec = Section(
                    course_id=courses[code].id, instructor_id=instructors[COURSES[code][4]].id,
                    term=term, section_number="01", room=room,
                    meeting_time=SLOTS[(idx + ALL_TERMS.index(term)) % len(SLOTS)], capacity=60,
                )
                db.add(sec)
                db.flush()
                sections[key] = sec
            return sections[key]

        completed_rows = []
        for s in students:
            for term, code, grade in s["history"]:
                sec = past_section(code, term)
                db.add(Enrollment(
                    student_id=records[s["email"]].id, section_id=sec.id,
                    status=EnrollmentStatus.completed, grade=grade,
                ))
                completed_rows.append((s["email"], code, grade))
        db.flush()

        # GPA from completed courses (failed courses count in the GPA, as in the API)
        points, creds = defaultdict(float), defaultdict(int)
        for email, code, grade in completed_rows:
            points[email] += GRADE_POINTS[grade] * COURSES[code][1]
            creds[email] += COURSES[code][1]
        for s in students:
            email = s["email"]
            s["gpa"] = round(points[email] / creds[email], 2) if creds[email] else 0.0
            records[email].gpa = Decimal(str(s["gpa"]))

        # ---- current term
        demand = defaultdict(list)   # code -> students (ordered by student number)
        for s in sorted(students, key=lambda x: x["number"]):
            for code in s["wanted_current"]:
                if code in FALL_SLOTS:
                    demand[code].append(s)

        def capacity_plan(code, count):
            """(capacities per section) and how many students go to waitlist of section 01."""
            sections_n = len(FALL_SLOTS[code])
            if code == "CS401":
                return [max(2, count - 3)], 3          # full, 3 waiting
            if code == "CS202":
                return [6, 12], 2                      # section 01 full with 2 waiting; 02 open
            if code == "DS303":
                return [max(2, count - 1)], 1
            if code == "DS301":
                return [count + 1], 0                  # exactly one seat left
            if sections_n == 2:                        # CS305: split evenly
                half = math.ceil(count / 2)
                return [half, half + 3], 0
            return [max(12, math.ceil(count * 1.5))], 0

        enrolled_in = defaultdict(set)   # email -> slots already taken (avoid clashes)
        waitlist_count = Counter()
        fall_sections = {}
        demo = {}
        for code in FALL_SLOTS:
            count = len(demand[code])
            if count == 0:
                continue
            caps, waiting = capacity_plan(code, count)
            idx = list(COURSES).index(code)
            secs = []
            for n, (slot, cap) in enumerate(zip(FALL_SLOTS[code], caps), start=1):
                room = LABS[(idx + n) % len(LABS)] if code in LAB_COURSES else ROOMS[(idx + n) % len(ROOMS)]
                sec = Section(
                    course_id=courses[code].id, instructor_id=instructors[COURSES[code][4]].id,
                    term=CURRENT_TERM, section_number=f"{n:02d}", room=room, meeting_time=slot, capacity=cap,
                )
                db.add(sec)
                secs.append(sec)
            db.flush()
            fall_sections[code] = secs

            queue = list(demand[code])
            waiting_students = queue[len(queue) - waiting:] if waiting else []
            seated = queue[:len(queue) - waiting] if waiting else queue

            # fill section 01 first, overflow into section 02
            left = {sec.id: sec.capacity for sec in secs}
            placed = []
            for s in seated:
                for sec in secs:
                    if left[sec.id] > 0 and sec.meeting_time not in enrolled_in[s["email"]]:
                        db.add(Enrollment(student_id=records[s["email"]].id, section_id=sec.id,
                                          status=EnrollmentStatus.enrolled))
                        left[sec.id] -= 1
                        enrolled_in[s["email"]].add(sec.meeting_time)
                        placed.append((s, sec))
                        break
            for position, s in enumerate(waiting_students, start=1):
                db.add(Waitlist(student_id=records[s["email"]].id, section_id=secs[0].id, position=position))
                waitlist_count[code] += 1
            demo[code] = {"seated": [p[0] for p in placed], "waiting": waiting_students, "sections": secs}

        db.commit()

        # ---- summary + guide
        total_enrolled = db.query(Enrollment).filter(Enrollment.status == EnrollmentStatus.enrolled).count()
        print("\nDemo university created:")
        print(f"  {len(COURSES)} courses, {len(INSTRUCTORS)} instructors, {len(students)} students, 1 registrar")
        print(f"  {db.query(Section).count()} sections across {len(ALL_TERMS)} terms")
        print(f"  {db.query(Enrollment).filter(Enrollment.status == EnrollmentStatus.completed).count()} completed course records")
        print(f"  {total_enrolled} current enrollments in {CURRENT_TERM}, {sum(waitlist_count.values())} waitlist entries")
        write_guide(students, demo, instructors, courses)
        print("\nWrote DEMO_GUIDE.md with ready-made demo scenarios.")
        print(f"All accounts use the password: {PASSWORD}")
    finally:
        db.close()


def write_guide(students, demo, instructors, courses):
    def who(s):
        return f"{s['name']} ({s['email']})"

    lines = ["# Demo guide", "", f"Every account's password is `{PASSWORD}`. Current term: **{CURRENT_TERM}**.", ""]
    lines += ["## Staff", "", "- Registrar: `registrar@college.edu`"]
    lines += [f"- {INSTRUCTORS[i][2]} instructor: Dr. {INSTRUCTORS[i][0]} {INSTRUCTORS[i][1]} "
              f"(`{INSTRUCTORS[i][0].lower()}.{INSTRUCTORS[i][1].lower()}@college.edu`)" for i in range(len(INSTRUCTORS))]
    lines.append("")

    d = demo["CS401"]
    lines += ["## 1. Waitlist promotion and notification (CS401)", "",
              f"CS401 Advanced Database Systems is full with {len(d['waiting'])} students waiting.", "",
              f"1. Log in as {who(d['seated'][0])} and drop CS401 from the Dashboard.",
              f"2. Log in as {who(d['waiting'][0])} (waitlist position 1).",
              "3. The 🔔 shows 1 unread notification, and CS401 now appears under My courses.", ""]

    d2 = demo["CS202"]
    lines += ["## 2. Choosing between sections (CS202)", "",
              "CS202 Database Management Systems has Section 01 (full, waitlist) and Section 02 (open).",
              f"Log in as {who(d2['waiting'][0])} to see them on the waitlist for Section 01.", ""]

    pair = [x for x in students if x.get("ds301_candidate")]
    lines += ["## 3. Two students, one seat (DS301)", "",
              "DS301 Data Mining has exactly one free seat, and two eligible students have not registered yet:",
              f"- {who(pair[0])}", f"- {who(pair[1])}", "",
              "Log in as each in two browsers (one normal, one private window) and click Enroll on DS301 together.",
              "The database lock lets exactly one in; the other lands on the waitlist at position 1.", ""]

    freshman = [s for s in students if s["cohort"] == "D"][0]
    lines += ["## 4. Prerequisites enforced", "",
              f"Log in as {who(freshman)}, a first-year student with no history, and try to enroll in CS401.",
              "The system rejects it and lists every missing prerequisite in the chain.", ""]

    failer = [s for s in students if s["cohort"] == "A" and s["index"] == 2][0]
    lines += ["## 5. Failed course and retake (transcript)", "",
              f"{who(failer)} failed CS303 on the first attempt and took it again. The transcript shows both attempts",
              f"(GPA {failer['gpa']:.2f}). A failed course does not satisfy a prerequisite.", ""]

    top = max(students, key=lambda x: x["gpa"])
    lines += ["## 6. Strong transcript", "", f"{who(top)} has the highest GPA ({top['gpa']:.2f}).", ""]

    d4 = demo["DS303"]
    lines += ["## 7. Grading", "",
              f"Dr. Farhan Ali teaches DS303 Deep Learning. Log in as `farhan.ali@college.edu`, open the roster,",
              f"and post a grade for a student such as {who(d4['seated'][0])}. The student gets a notification.", ""]
    Path(__file__).with_name("DEMO_GUIDE.md").write_text("\n".join(lines), encoding="utf-8")


if __name__ == "__main__":
    main()
