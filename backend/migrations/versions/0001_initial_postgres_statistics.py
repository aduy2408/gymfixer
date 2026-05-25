"""initial postgres statistics schema

Revision ID: 0001_initial_postgres_statistics
Revises:
Create Date: 2026-05-25 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "0001_initial_postgres_statistics"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("hashed_password", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
    op.create_index(op.f("ix_users_id"), "users", ["id"], unique=False)

    op.create_table(
        "workout_sessions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("exercise", sa.String(), nullable=False),
        sa.Column("camera_view", sa.String(), nullable=False),
        sa.Column("pose_backend", sa.String(), nullable=False),
        sa.Column("source_type", sa.String(), nullable=False),
        sa.Column("file_name", sa.String(), nullable=True),
        sa.Column("file_size_bytes", sa.Integer(), nullable=True),
        sa.Column("sample_fps", sa.Float(), nullable=True),
        sa.Column("max_frames", sa.Integer(), nullable=True),
        sa.Column("include_preview", sa.Boolean(), nullable=False),
        sa.Column("preview_max_frames", sa.Integer(), nullable=True),
        sa.Column("llm_requested", sa.Boolean(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_workout_sessions_exercise"), "workout_sessions", ["exercise"], unique=False)
    op.create_index(op.f("ix_workout_sessions_id"), "workout_sessions", ["id"], unique=False)
    op.create_index(op.f("ix_workout_sessions_status"), "workout_sessions", ["status"], unique=False)
    op.create_index(op.f("ix_workout_sessions_user_id"), "workout_sessions", ["user_id"], unique=False)

    op.create_table(
        "analysis_results",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("session_id", sa.Integer(), nullable=False),
        sa.Column("frames_received", sa.Integer(), nullable=False),
        sa.Column("frames_analyzed", sa.Integer(), nullable=False),
        sa.Column("rep_count", sa.Integer(), nullable=False),
        sa.Column("processing_ms", sa.Integer(), nullable=False),
        sa.Column("quality_ratio", sa.Float(), nullable=True),
        sa.Column("no_pose_frames", sa.Integer(), nullable=False),
        sa.Column("visibility_failed_frames", sa.Integer(), nullable=False),
        sa.Column("waiting_for_subject_frames", sa.Integer(), nullable=False),
        sa.Column("decode_errors", sa.Integer(), nullable=False),
        sa.Column("summary_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("angle_stats_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("top_feedback_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("visibility_failures_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("llm_enabled", sa.Boolean(), nullable=False),
        sa.Column("llm_model", sa.String(), nullable=True),
        sa.Column("llm_usage_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("llm_recommendations", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["workout_sessions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("session_id"),
    )
    op.create_index(op.f("ix_analysis_results_id"), "analysis_results", ["id"], unique=False)
    op.create_index(op.f("ix_analysis_results_session_id"), "analysis_results", ["session_id"], unique=False)

    op.create_table(
        "usage_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("session_id", sa.Integer(), nullable=True),
        sa.Column("event_name", sa.String(), nullable=False),
        sa.Column("properties_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["workout_sessions.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_usage_events_event_name"), "usage_events", ["event_name"], unique=False)
    op.create_index(op.f("ix_usage_events_id"), "usage_events", ["id"], unique=False)
    op.create_index(op.f("ix_usage_events_session_id"), "usage_events", ["session_id"], unique=False)
    op.create_index(op.f("ix_usage_events_user_id"), "usage_events", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_usage_events_user_id"), table_name="usage_events")
    op.drop_index(op.f("ix_usage_events_session_id"), table_name="usage_events")
    op.drop_index(op.f("ix_usage_events_id"), table_name="usage_events")
    op.drop_index(op.f("ix_usage_events_event_name"), table_name="usage_events")
    op.drop_table("usage_events")
    op.drop_index(op.f("ix_analysis_results_session_id"), table_name="analysis_results")
    op.drop_index(op.f("ix_analysis_results_id"), table_name="analysis_results")
    op.drop_table("analysis_results")
    op.drop_index(op.f("ix_workout_sessions_user_id"), table_name="workout_sessions")
    op.drop_index(op.f("ix_workout_sessions_status"), table_name="workout_sessions")
    op.drop_index(op.f("ix_workout_sessions_id"), table_name="workout_sessions")
    op.drop_index(op.f("ix_workout_sessions_exercise"), table_name="workout_sessions")
    op.drop_table("workout_sessions")
    op.drop_index(op.f("ix_users_id"), table_name="users")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")
