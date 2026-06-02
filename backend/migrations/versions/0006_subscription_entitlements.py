"""add subscription entitlements

Revision ID: 0006_subscription_entitlements
Revises: 0005_rep_breakdown
Create Date: 2026-06-01 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0006_subscription_entitlements"
down_revision: Union[str, Sequence[str], None] = "0005_rep_breakdown"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


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
    if not _has_column("users", "subscription_tier"):
        op.add_column("users", sa.Column("subscription_tier", sa.String(), nullable=False, server_default="free"))
        op.alter_column("users", "subscription_tier", server_default=None)
    if not _has_index("users", op.f("ix_users_subscription_tier")):
        op.create_index(op.f("ix_users_subscription_tier"), "users", ["subscription_tier"], unique=False)
    if not _has_column("users", "trial_started_at"):
        op.add_column("users", sa.Column("trial_started_at", sa.DateTime(timezone=True), nullable=True))
    if not _has_column("users", "trial_ends_at"):
        op.add_column("users", sa.Column("trial_ends_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    if _has_column("users", "trial_ends_at"):
        op.drop_column("users", "trial_ends_at")
    if _has_column("users", "trial_started_at"):
        op.drop_column("users", "trial_started_at")
    if _has_index("users", op.f("ix_users_subscription_tier")):
        op.drop_index(op.f("ix_users_subscription_tier"), table_name="users")
    if _has_column("users", "subscription_tier"):
        op.drop_column("users", "subscription_tier")
