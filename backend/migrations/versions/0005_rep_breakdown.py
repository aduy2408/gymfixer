"""store per-rep analysis breakdown

Revision ID: 0005_rep_breakdown
Revises: 0004_user_profiles
Create Date: 2026-05-31 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "0005_rep_breakdown"
down_revision: Union[str, Sequence[str], None] = "0004_user_profiles"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if table_name not in inspector.get_table_names():
        return False
    return column_name in {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    if not _has_column("analysis_results", "rep_breakdown_json"):
        op.add_column(
            "analysis_results",
            sa.Column(
                "rep_breakdown_json",
                postgresql.JSONB(astext_type=sa.Text()),
                nullable=False,
                server_default=sa.text("'[]'::jsonb"),
            ),
        )

    op.execute(
        """
        UPDATE analysis_results
        SET rep_breakdown_json = CASE
            WHEN summary_json ? 'rep_breakdown'
                 AND jsonb_typeof(summary_json->'rep_breakdown') = 'array'
                THEN summary_json->'rep_breakdown'
            WHEN rep_count > 0
                THEN (
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            'rep_number', n,
                            'completed', true,
                            'start_frame', NULL,
                            'end_frame', NULL,
                            'start_ms', NULL,
                            'end_ms', NULL,
                            'duration_ms', NULL,
                            'frame_count', 0,
                            'phases', '[]'::jsonb,
                            'issues', '[]'::jsonb,
                            'issue_counts', '{}'::jsonb,
                            'angle_stats', '{}'::jsonb
                        )
                        ORDER BY n
                    )
                    FROM generate_series(1, rep_count) AS n
                )
            ELSE '[]'::jsonb
        END
        """
    )
    op.execute(
        """
        UPDATE analysis_results
        SET summary_json = jsonb_set(
            summary_json,
            '{rep_breakdown}',
            rep_breakdown_json,
            true
        )
        WHERE NOT (
            summary_json ? 'rep_breakdown'
            AND jsonb_typeof(summary_json->'rep_breakdown') = 'array'
        )
        """
    )
    op.alter_column("analysis_results", "rep_breakdown_json", server_default=None)


def downgrade() -> None:
    if _has_column("analysis_results", "rep_breakdown_json"):
        op.drop_column("analysis_results", "rep_breakdown_json")
