"""add google auth support

Revision ID: 0003_google_auth
Revises: 0002_weekly_plans
Create Date: 2026-05-25 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0003_google_auth"
down_revision: Union[str, Sequence[str], None] = "0002_weekly_plans"
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


def upgrade() -> None:
    if not _has_column("users", "is_verified"):
        op.add_column("users", sa.Column("is_verified", sa.Boolean(), nullable=False, server_default=sa.text("false")))
        op.alter_column("users", "is_verified", server_default=None)
    if not _has_column("users", "auth_provider"):
        op.add_column("users", sa.Column("auth_provider", sa.String(), nullable=False, server_default="local"))
        op.alter_column("users", "auth_provider", server_default=None)
    if not _has_column("users", "google_sub"):
        op.add_column("users", sa.Column("google_sub", sa.String(), nullable=True))
        op.create_index(op.f("ix_users_google_sub"), "users", ["google_sub"], unique=True)
    if not _has_column("users", "last_login_at"):
        op.add_column("users", sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True))

    if _has_column("users", "hashed_password"):
        op.alter_column("users", "hashed_password", existing_type=sa.String(), nullable=True)

    if not _has_table("revoked_tokens"):
        op.create_table(
            "revoked_tokens",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("jti", sa.String(), nullable=False),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("jti"),
        )
        op.create_index(op.f("ix_revoked_tokens_id"), "revoked_tokens", ["id"], unique=False)
        op.create_index(op.f("ix_revoked_tokens_jti"), "revoked_tokens", ["jti"], unique=True)

    if not _has_table("auth_tokens"):
        op.create_table(
            "auth_tokens",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("token_hash", sa.String(), nullable=False),
            sa.Column("token_type", sa.String(), nullable=False),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("token_hash"),
        )
        op.create_index(op.f("ix_auth_tokens_id"), "auth_tokens", ["id"], unique=False)
        op.create_index(op.f("ix_auth_tokens_token_hash"), "auth_tokens", ["token_hash"], unique=True)
        op.create_index(op.f("ix_auth_tokens_token_type"), "auth_tokens", ["token_type"], unique=False)
        op.create_index(op.f("ix_auth_tokens_user_id"), "auth_tokens", ["user_id"], unique=False)


def downgrade() -> None:
    if _has_table("auth_tokens"):
        op.drop_index(op.f("ix_auth_tokens_user_id"), table_name="auth_tokens")
        op.drop_index(op.f("ix_auth_tokens_token_type"), table_name="auth_tokens")
        op.drop_index(op.f("ix_auth_tokens_token_hash"), table_name="auth_tokens")
        op.drop_index(op.f("ix_auth_tokens_id"), table_name="auth_tokens")
        op.drop_table("auth_tokens")

    if _has_table("revoked_tokens"):
        op.drop_index(op.f("ix_revoked_tokens_jti"), table_name="revoked_tokens")
        op.drop_index(op.f("ix_revoked_tokens_id"), table_name="revoked_tokens")
        op.drop_table("revoked_tokens")

    if _has_column("users", "last_login_at"):
        op.drop_column("users", "last_login_at")
    if _has_column("users", "google_sub"):
        op.drop_index(op.f("ix_users_google_sub"), table_name="users")
        op.drop_column("users", "google_sub")
    if _has_column("users", "auth_provider"):
        op.drop_column("users", "auth_provider")
    if _has_column("users", "is_verified"):
        op.drop_column("users", "is_verified")
    if _has_column("users", "hashed_password"):
        op.alter_column("users", "hashed_password", existing_type=sa.String(), nullable=False)
