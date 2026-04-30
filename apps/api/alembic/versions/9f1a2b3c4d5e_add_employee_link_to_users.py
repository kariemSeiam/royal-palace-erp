"""add employee link to users

Revision ID: 9f1a2b3c4d5e
Revises: ec49dff8f944
Create Date: 2026-03-17 23:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "9f1a2b3c4d5e"
down_revision = "ec49dff8f944"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("employee_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "users_employee_id_fkey",
        "users",
        "employees",
        ["employee_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_unique_constraint(
        "uq_users_employee_id",
        "users",
        ["employee_id"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_users_employee_id", "users", type_="unique")
    op.drop_constraint("users_employee_id_fkey", "users", type_="foreignkey")
    op.drop_column("users", "employee_id")
