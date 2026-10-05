"""triggers: enrollment history and seat-capacity guard

Revision ID: b7c2d9e41a30
Revises: 51e06713f1c4
Create Date: 2026-10-05

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b7c2d9e41a30"
down_revision: Union[str, None] = "51e06713f1c4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. History table, filled in by the trigger below
    op.create_table(
        "enrollment_history",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("enrollment_id", sa.Integer(), nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("section_id", sa.Integer(), nullable=False),
        sa.Column("action", sa.String(length=10), nullable=False),
        sa.Column("old_status", sa.String(length=20), nullable=True),
        sa.Column("new_status", sa.String(length=20), nullable=False),
        sa.Column("old_grade", sa.String(length=2), nullable=True),
        sa.Column("new_grade", sa.String(length=2), nullable=True),
        sa.Column("changed_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("changed_by", sa.String(length=100), server_default=sa.text("current_user"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_enrollment_history_enrollment_id", "enrollment_history", ["enrollment_id"])

    # 2. Trigger: record every status or grade change on enrollments
    op.execute("""
        CREATE OR REPLACE FUNCTION log_enrollment_change() RETURNS trigger AS $$
        BEGIN
            IF TG_OP = 'INSERT' THEN
                INSERT INTO enrollment_history
                    (enrollment_id, student_id, section_id, action,
                     old_status, new_status, old_grade, new_grade)
                VALUES
                    (NEW.id, NEW.student_id, NEW.section_id, 'INSERT',
                     NULL, NEW.status::text, NULL, NEW.grade);
            ELSIF NEW.status IS DISTINCT FROM OLD.status
               OR NEW.grade  IS DISTINCT FROM OLD.grade THEN
                INSERT INTO enrollment_history
                    (enrollment_id, student_id, section_id, action,
                     old_status, new_status, old_grade, new_grade)
                VALUES
                    (NEW.id, NEW.student_id, NEW.section_id, 'UPDATE',
                     OLD.status::text, NEW.status::text, OLD.grade, NEW.grade);
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    op.execute("""
        CREATE TRIGGER trg_enrollment_history
        AFTER INSERT OR UPDATE ON enrollments
        FOR EACH ROW EXECUTE FUNCTION log_enrollment_change();
    """)

    # 3. Trigger: a section can never hold more enrolled students than its capacity,
    #    even if a bug or a manual SQL statement bypasses the API checks.
    op.execute("""
        CREATE OR REPLACE FUNCTION check_section_capacity() RETURNS trigger AS $$
        DECLARE
            cap   integer;
            taken integer;
        BEGIN
            IF NEW.status = 'enrolled'
               AND (TG_OP = 'INSERT' OR OLD.status <> 'enrolled') THEN
                -- Lock the section row so two concurrent inserts are checked one at a time
                SELECT capacity INTO cap FROM sections WHERE id = NEW.section_id FOR UPDATE;

                SELECT count(*) INTO taken
                FROM enrollments
                WHERE section_id = NEW.section_id
                  AND status = 'enrolled'
                  AND id <> NEW.id;

                IF taken >= cap THEN
                    RAISE EXCEPTION 'Section % is full (% of % seats taken)',
                        NEW.section_id, taken, cap
                        USING ERRCODE = 'check_violation';
                END IF;
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    op.execute("""
        CREATE TRIGGER trg_section_capacity
        BEFORE INSERT OR UPDATE ON enrollments
        FOR EACH ROW EXECUTE FUNCTION check_section_capacity();
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_section_capacity ON enrollments;")
    op.execute("DROP FUNCTION IF EXISTS check_section_capacity();")
    op.execute("DROP TRIGGER IF EXISTS trg_enrollment_history ON enrollments;")
    op.execute("DROP FUNCTION IF EXISTS log_enrollment_change();")
    op.drop_index("ix_enrollment_history_enrollment_id", table_name="enrollment_history")
    op.drop_table("enrollment_history")