"""create_purchaser_subscriptions_table

Revision ID: 6b45d29e1c34
Revises: ea35d34d5a29
Create Date: 2026-11-09 22:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6b45d29e1c34'
down_revision: Union[str, None] = 'ea35d34d5a29'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'purchaser_subscriptions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('purchaser_id', sa.UUID(), nullable=False),
        sa.Column('plan_code', sa.String(length=32), nullable=False),
        sa.Column('status', sa.String(length=32), server_default='active', nullable=False),
        sa.Column('billing_interval', sa.String(length=32), server_default='annual', nullable=False),
        sa.Column('auto_renew', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('starts_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('current_period_starts_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('current_period_ends_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('cancelled_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['purchaser_id'], ['purchasers.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('purchaser_id', 'plan_code', name='uq_purchaser_subscriptions_purchaser_plan')
    )
    op.create_index(op.f('ix_purchaser_subscriptions_purchaser_id'), 'purchaser_subscriptions', ['purchaser_id'], unique=False)
    op.create_index(op.f('ix_purchaser_subscriptions_plan_code'), 'purchaser_subscriptions', ['plan_code'], unique=False)
    op.create_index(op.f('ix_purchaser_subscriptions_status'), 'purchaser_subscriptions', ['status'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_purchaser_subscriptions_status'), table_name='purchaser_subscriptions')
    op.drop_index(op.f('ix_purchaser_subscriptions_plan_code'), table_name='purchaser_subscriptions')
    op.drop_index(op.f('ix_purchaser_subscriptions_purchaser_id'), table_name='purchaser_subscriptions')
    op.drop_table('purchaser_subscriptions')

