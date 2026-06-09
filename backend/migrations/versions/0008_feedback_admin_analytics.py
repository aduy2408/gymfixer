"""add feedback and admin role

Revision ID: 0008_feedback_admin
Revises: 0007_profile_discovery
Create Date: 2026-06-09 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0008_feedback_admin"
down_revision: Union[str, Sequence[str], None] = "0007_profile_discovery"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_table(table_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return table_name in inspector.get_table_names()


def _has_column(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if table_name not in inspector.get_table_names():
        return False
    return column_name in {column["name"] for column in inspector.get_columns(table_name)}


def _has_index(table_name: str, index_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if table_name not in inspector.get_table_names():
        return False
    return index_name in {index["name"] for index in inspector.get_indexes(table_name)}


def upgrade() -> None:
    if not _has_column("users", "role"):
        op.add_column("users", sa.Column("role", sa.String(), nullable=False, server_default="user"))
        op.alter_column("users", "role", server_default=None)
    if not _has_index("users", op.f("ix_users_role")):
        op.create_index(op.f("ix_users_role"), "users", ["role"], unique=False)

    if not _has_table("user_feedback"):
        op.create_table(
            "user_feedback",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("rating", sa.Integer(), nullable=False),
            sa.Column("message", sa.String(), nullable=False),
            sa.Column("source", sa.String(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_user_feedback_id"), "user_feedback", ["id"], unique=False)
        op.create_index(op.f("ix_user_feedback_source"), "user_feedback", ["source"], unique=False)
        op.create_index(op.f("ix_user_feedback_user_id"), "user_feedback", ["user_id"], unique=False)


def downgrade() -> None:
    if _has_table("user_feedback"):
        if _has_index("user_feedback", op.f("ix_user_feedback_user_id")):
            op.drop_index(op.f("ix_user_feedback_user_id"), table_name="user_feedback")
        if _has_index("user_feedback", op.f("ix_user_feedback_source")):
            op.drop_index(op.f("ix_user_feedback_source"), table_name="user_feedback")
        if _has_index("user_feedback", op.f("ix_user_feedback_id")):
            op.drop_index(op.f("ix_user_feedback_id"), table_name="user_feedback")
        op.drop_table("user_feedback")
    if _has_index("users", op.f("ix_users_role")):
        op.drop_index(op.f("ix_users_role"), table_name="users")
    if _has_column("users", "role"):
        op.drop_column("users", "role")
