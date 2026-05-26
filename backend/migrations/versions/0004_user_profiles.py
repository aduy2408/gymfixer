"""add user profiles

Revision ID: 0004_user_profiles
Revises: 0003_google_auth
Create Date: 2026-05-26 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0004_user_profiles"
down_revision: Union[str, Sequence[str], None] = "0003_google_auth"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_profiles",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("height_cm", sa.Integer(), nullable=True),
        sa.Column("weight_kg", sa.Integer(), nullable=True),
        sa.Column("age", sa.Integer(), nullable=True),
        sa.Column("gender", sa.String(), nullable=True),
        sa.Column("goal", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index(op.f("ix_user_profiles_id"), "user_profiles", ["id"], unique=False)
    op.create_index(op.f("ix_user_profiles_user_id"), "user_profiles", ["user_id"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_user_profiles_user_id"), table_name="user_profiles")
    op.drop_index(op.f("ix_user_profiles_id"), table_name="user_profiles")
    op.drop_table("user_profiles")
