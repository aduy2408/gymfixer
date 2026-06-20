"""add vnpay recurring billing

Revision ID: 0009_vnpay_billing
Revises: 0008_feedback_admin
Create Date: 2026-06-20 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "0009_vnpay_billing"
down_revision: Union[str, Sequence[str], None] = "0008_feedback_admin"
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
    if not _has_column("users", "premium_expires_at"):
        op.add_column("users", sa.Column("premium_expires_at", sa.DateTime(timezone=True), nullable=True))

    if not _has_table("payment_methods"):
        op.create_table(
            "payment_methods",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("provider", sa.String(), nullable=False),
            sa.Column("token", sa.String(), nullable=False),
            sa.Column("masked_card", sa.String(), nullable=True),
            sa.Column("bank_code", sa.String(), nullable=True),
            sa.Column("card_type", sa.String(), nullable=True),
            sa.Column("status", sa.String(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_payment_methods_id"), "payment_methods", ["id"], unique=False)
        op.create_index(op.f("ix_payment_methods_status"), "payment_methods", ["status"], unique=False)
        op.create_index(op.f("ix_payment_methods_user_id"), "payment_methods", ["user_id"], unique=False)

    if not _has_table("billing_subscriptions"):
        op.create_table(
            "billing_subscriptions",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("payment_method_id", sa.Integer(), nullable=True),
            sa.Column("tier", sa.String(), nullable=False),
            sa.Column("status", sa.String(), nullable=False),
            sa.Column("amount_vnd", sa.Integer(), nullable=False),
            sa.Column("interval", sa.String(), nullable=False),
            sa.Column("current_period_start", sa.DateTime(timezone=True), nullable=True),
            sa.Column("current_period_end", sa.DateTime(timezone=True), nullable=True),
            sa.Column("next_billing_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("cancel_at_period_end", sa.Boolean(), nullable=False),
            sa.Column("canceled_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["payment_method_id"], ["payment_methods.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_billing_subscriptions_current_period_end"), "billing_subscriptions", ["current_period_end"], unique=False)
        op.create_index(op.f("ix_billing_subscriptions_id"), "billing_subscriptions", ["id"], unique=False)
        op.create_index(op.f("ix_billing_subscriptions_next_billing_at"), "billing_subscriptions", ["next_billing_at"], unique=False)
        op.create_index(op.f("ix_billing_subscriptions_payment_method_id"), "billing_subscriptions", ["payment_method_id"], unique=False)
        op.create_index(op.f("ix_billing_subscriptions_status"), "billing_subscriptions", ["status"], unique=False)
        op.create_index(op.f("ix_billing_subscriptions_user_id"), "billing_subscriptions", ["user_id"], unique=False)

    if not _has_table("payments"):
        op.create_table(
            "payments",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=True),
            sa.Column("subscription_id", sa.Integer(), nullable=True),
            sa.Column("payment_method_id", sa.Integer(), nullable=True),
            sa.Column("provider", sa.String(), nullable=False),
            sa.Column("status", sa.String(), nullable=False),
            sa.Column("attempt_type", sa.String(), nullable=False),
            sa.Column("amount_vnd", sa.Integer(), nullable=False),
            sa.Column("currency", sa.String(), nullable=False),
            sa.Column("plan_tier", sa.String(), nullable=False),
            sa.Column("interval", sa.String(), nullable=False),
            sa.Column("vnp_txn_ref", sa.String(), nullable=False),
            sa.Column("vnp_transaction_no", sa.String(), nullable=True),
            sa.Column("vnp_response_code", sa.String(), nullable=True),
            sa.Column("vnp_transaction_status", sa.String(), nullable=True),
            sa.Column("payment_url", sa.String(), nullable=True),
            sa.Column("raw_request_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
            sa.Column("raw_response_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("failed_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["payment_method_id"], ["payment_methods.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["subscription_id"], ["billing_subscriptions.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("vnp_txn_ref"),
        )
        op.create_index(op.f("ix_payments_attempt_type"), "payments", ["attempt_type"], unique=False)
        op.create_index(op.f("ix_payments_id"), "payments", ["id"], unique=False)
        op.create_index(op.f("ix_payments_payment_method_id"), "payments", ["payment_method_id"], unique=False)
        op.create_index(op.f("ix_payments_status"), "payments", ["status"], unique=False)
        op.create_index(op.f("ix_payments_subscription_id"), "payments", ["subscription_id"], unique=False)
        op.create_index(op.f("ix_payments_user_id"), "payments", ["user_id"], unique=False)
        op.create_index(op.f("ix_payments_vnp_transaction_no"), "payments", ["vnp_transaction_no"], unique=False)
        op.create_index(op.f("ix_payments_vnp_txn_ref"), "payments", ["vnp_txn_ref"], unique=True)


def downgrade() -> None:
    if _has_table("payments"):
        for index_name in (
            op.f("ix_payments_vnp_txn_ref"),
            op.f("ix_payments_vnp_transaction_no"),
            op.f("ix_payments_user_id"),
            op.f("ix_payments_subscription_id"),
            op.f("ix_payments_status"),
            op.f("ix_payments_payment_method_id"),
            op.f("ix_payments_id"),
            op.f("ix_payments_attempt_type"),
        ):
            if _has_index("payments", index_name):
                op.drop_index(index_name, table_name="payments")
        op.drop_table("payments")

    if _has_table("billing_subscriptions"):
        for index_name in (
            op.f("ix_billing_subscriptions_user_id"),
            op.f("ix_billing_subscriptions_status"),
            op.f("ix_billing_subscriptions_payment_method_id"),
            op.f("ix_billing_subscriptions_next_billing_at"),
            op.f("ix_billing_subscriptions_id"),
            op.f("ix_billing_subscriptions_current_period_end"),
        ):
            if _has_index("billing_subscriptions", index_name):
                op.drop_index(index_name, table_name="billing_subscriptions")
        op.drop_table("billing_subscriptions")

    if _has_table("payment_methods"):
        for index_name in (
            op.f("ix_payment_methods_user_id"),
            op.f("ix_payment_methods_status"),
            op.f("ix_payment_methods_id"),
        ):
            if _has_index("payment_methods", index_name):
                op.drop_index(index_name, table_name="payment_methods")
        op.drop_table("payment_methods")

    if _has_column("users", "premium_expires_at"):
        op.drop_column("users", "premium_expires_at")
