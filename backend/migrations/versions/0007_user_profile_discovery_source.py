"""add user profile discovery source

Revision ID: 0007_profile_discovery
Revises: 0006_subscription_entitlements
Create Date: 2026-06-09 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0007_profile_discovery"
down_revision: Union[str, Sequence[str], None] = "0006_subscription_entitlements"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if table_name not in inspector.get_table_names():
        return False
    return column_name in {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    if not _has_column("user_profiles", "discovery_source"):
        op.add_column("user_profiles", sa.Column("discovery_source", sa.String(), nullable=True))


def downgrade() -> None:
    if _has_column("user_profiles", "discovery_source"):
        op.drop_column("user_profiles", "discovery_source")
