from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth, courses, sections, enrollments

app = FastAPI(
    title="Course Registration System API",
    description="Backend for the DBMS project - SreeValli",
    version="0.1.0",
)

# React dev server (Vite) runs on :5173 by default
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(courses.router)
app.include_router(sections.router)
app.include_router(enrollments.router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
