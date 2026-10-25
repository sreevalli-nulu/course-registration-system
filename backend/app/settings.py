import os

# The term students can enroll in right now. Sections of any other term are
# history (or the future) and cannot be enrolled in. Override with CURRENT_TERM in .env.
CURRENT_TERM = os.getenv("CURRENT_TERM", "Fall2026")
