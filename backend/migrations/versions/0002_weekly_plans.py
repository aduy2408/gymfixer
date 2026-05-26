"""add weekly workout and meal plans

Revision ID: 0002_weekly_plans
Revises: 0001_initial_postgres_statistics
Create Date: 2026-05-25 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "0002_weekly_plans"
down_revision: Union[str, Sequence[str], None] = "0001_initial_postgres_statistics"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "weekly_workout_plans",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("input_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("plan_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("generation_source", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_weekly_workout_plans_id"), "weekly_workout_plans", ["id"], unique=False)
    op.create_index(op.f("ix_weekly_workout_plans_user_id"), "weekly_workout_plans", ["user_id"], unique=False)

    op.create_table(
        "weekly_meal_plans",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("input_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("plan_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("generation_source", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_weekly_meal_plans_id"), "weekly_meal_plans", ["id"], unique=False)
    op.create_index(op.f("ix_weekly_meal_plans_user_id"), "weekly_meal_plans", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_weekly_meal_plans_user_id"), table_name="weekly_meal_plans")
    op.drop_index(op.f("ix_weekly_meal_plans_id"), table_name="weekly_meal_plans")
    op.drop_table("weekly_meal_plans")
    op.drop_index(op.f("ix_weekly_workout_plans_user_id"), table_name="weekly_workout_plans")
    op.drop_index(op.f("ix_weekly_workout_plans_id"), table_name="weekly_workout_plans")
    op.drop_table("weekly_workout_plans")
