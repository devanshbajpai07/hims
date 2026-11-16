"""create employee_messages table

Revision ID: b9d6e4f8a032
Revises: a8c5e3d7b921
Create Date: 2026-11-14 08:50:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'b9d6e4f8a032'
down_revision = 'a8c5e3d7b921'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'employee_messages',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('hospital_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('hospitals.id', ondelete='CASCADE'), nullable=False),
        sa.Column('sender_membership_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenant_memberships.id', ondelete='CASCADE'), nullable=False),
        sa.Column('sender_user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('sender_name', sa.String(255), nullable=False),
        sa.Column('sender_role_name', sa.String(100), nullable=False),
        sa.Column('sender_department_name', sa.String(100), nullable=True),
        sa.Column('recipient_membership_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenant_memberships.id', ondelete='CASCADE'), nullable=False),
        sa.Column('recipient_user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('recipient_name', sa.String(255), nullable=False),
        sa.Column('recipient_role_name', sa.String(100), nullable=False, server_default='General Staff'),
        sa.Column('recipient_department_name', sa.String(100), nullable=True),
        sa.Column('subject', sa.String(255), nullable=False),
        sa.Column('message_body', sa.Text(), nullable=False),
        sa.Column('status', sa.String(32), nullable=False, server_default='PENDING'),
        sa.Column('is_read', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_by_user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('completed_by_membership_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenant_memberships.id', ondelete='SET NULL'), nullable=True),
        sa.Column('completed_by_name', sa.String(255), nullable=True),
        sa.Column('completion_notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.CheckConstraint('sender_membership_id != recipient_membership_id', name='ck_employee_message_no_self_membership'),
        sa.CheckConstraint('sender_user_id != recipient_user_id', name='ck_employee_message_no_self_user'),
        sa.CheckConstraint("status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED')", name='ck_employee_message_status'),
    )
    op.create_index('ix_emp_msg_hospital_recipient', 'employee_messages', ['hospital_id', 'recipient_membership_id', 'status'])
    op.create_index('ix_emp_msg_hospital_sender', 'employee_messages', ['hospital_id', 'sender_membership_id', 'status'])
    op.create_index('ix_emp_msg_recipient_unread', 'employee_messages', ['recipient_membership_id', 'is_read'])
    op.create_index('ix_employee_messages_hospital_id', 'employee_messages', ['hospital_id'])
    op.create_index('ix_employee_messages_sender_membership_id', 'employee_messages', ['sender_membership_id'])
    op.create_index('ix_employee_messages_recipient_membership_id', 'employee_messages', ['recipient_membership_id'])
    op.create_index('ix_employee_messages_status', 'employee_messages', ['status'])
    op.create_index('ix_employee_messages_is_read', 'employee_messages', ['is_read'])


def downgrade() -> None:
    op.drop_table('employee_messages')

