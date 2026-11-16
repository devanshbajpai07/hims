"""remove_purchaser_plan_unique_constraint

Revision ID: c4e1a8b9d032
Revises: 6b45d29e1c34
Create Date: 2026-11-10 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c4e1a8b9d032'
down_revision: Union[str, None] = '6b45d29e1c34'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop composite uniqueness constraint allowing one purchaser to hold
    # multiple subscriptions of the same or different tiers
    op.drop_constraint(
        'uq_purchaser_subscriptions_purchaser_plan',
        'purchaser_subscriptions',
        type_='unique'
    )


def downgrade() -> None:
    # Restore composite uniqueness constraint
    op.create_unique_constraint(
        'uq_purchaser_subscriptions_purchaser_plan',
        'purchaser_subscriptions',
        ['purchaser_id', 'plan_code']
    )

