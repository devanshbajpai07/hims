import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.api.deps_employee import EmployeeContext, get_current_employee
from app.db.database import get_db
from app.models.assignment import RoleAssignment
from app.models.communication import EmployeeMessage
from app.models.department import Department
from app.models.membership import TenantMembership
from app.models.notification import HospitalNotification
from app.models.role import Role
from app.models.user import User
from app.services.authorization_service import AuthorizationService

router = APIRouter(prefix="/communication", tags=["Communication"])


def _check_comm_perm(
    emp_ctx: EmployeeContext,
    db: Session,
    perm_code: str,
    alternate_code: Optional[str] = None,
) -> None:
    detail = AuthorizationService.get_effective_permissions_detail(db, emp_ctx.membership.id)
    granted_codes = {item.code for item in detail if item.is_granted}

    if perm_code in granted_codes:
        return
    if alternate_code and alternate_code in granted_codes:
        return

    item = next((i for i in detail if i.code == perm_code), None)
    reason = item.explanation if item else "Permission not granted."
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=f"Access denied: Missing required permission '{perm_code}'. {reason}",
    )


# -----------------------------------------------------------------------------
# PYDANTIC SCHEMAS
# -----------------------------------------------------------------------------

class RecipientResponse(BaseModel):
    membership_id: uuid.UUID
    user_id: uuid.UUID
    full_name: str
    email: str
    role_name: str
    department_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class CreateMessageRequest(BaseModel):
    recipient_membership_id: uuid.UUID
    subject: str = Field(..., min_length=1, max_length=255)
    message_body: str = Field(..., min_length=1)


class UpdateMessageStatusRequest(BaseModel):
    status: str = Field(..., pattern="^(PENDING|IN_PROGRESS|COMPLETED)$")


class CompleteMessageRequest(BaseModel):
    completion_notes: Optional[str] = None


class EmployeeMessageResponse(BaseModel):
    id: uuid.UUID
    hospital_id: uuid.UUID
    sender_membership_id: uuid.UUID
    sender_user_id: uuid.UUID
    sender_name: str
    sender_role_name: str
    sender_department_name: Optional[str] = None
    recipient_membership_id: uuid.UUID
    recipient_user_id: uuid.UUID
    recipient_name: str
    recipient_role_name: str
    recipient_department_name: Optional[str] = None
    subject: str
    message_body: str
    status: str
    is_read: bool
    read_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    completed_by_user_id: Optional[uuid.UUID] = None
    completed_by_membership_id: Optional[uuid.UUID] = None
    completed_by_name: Optional[str] = None
    completion_notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UnreadCountResponse(BaseModel):
    unread_count: int


# -----------------------------------------------------------------------------
# ENDPOINTS
# -----------------------------------------------------------------------------

@router.get("/recipients", response_model=List[RecipientResponse])
def get_eligible_recipients(
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Enumerates active employees and staff members in the caller's hospital facility.
    Includes all staff members with active roles (including administrators who hold employee roles).
    Deduplicates users and consolidates multi-role assignments.
    """
    _check_comm_perm(emp_ctx, db, "communication:create", alternate_code="queue:manage")

    # Query active hospital memberships in this facility
    memberships = (
        db.query(TenantMembership, User)
        .join(User, TenantMembership.user_id == User.id)
        .filter(
            TenantMembership.hospital_id == emp_ctx.hospital.id,
            TenantMembership.status == "active",
        )
        .all()
    )

    seen = set()
    recipients = []
    for mem, user in memberships:
        if user.id == emp_ctx.user.id or mem.id == emp_ctx.membership.id:
            continue
        if user.id in seen:
            continue
        seen.add(user.id)

        assignments = (
            db.query(RoleAssignment, Role, Department)
            .join(Role, Role.id == RoleAssignment.role_id)
            .outerjoin(Department, Department.id == RoleAssignment.department_id)
            .filter(
                RoleAssignment.membership_id == mem.id,
                RoleAssignment.is_active == True,
            )
            .all()
        )

        emp_roles = []
        emp_depts = []
        admin_roles = []
        for ra, r, d in assignments:
            r_name = r.name if r else ""
            r_code = r.code.lower() if r and r.code else ""
            d_name = d.name if d else ""
            is_admin = "admin" in r_code or "administrator" in r_name.lower()
            if is_admin:
                if r_name and r_name not in admin_roles:
                    admin_roles.append(r_name)
            else:
                if r_name and r_name not in emp_roles:
                    emp_roles.append(r_name)
                if d_name and d_name not in emp_depts:
                    emp_depts.append(d_name)

        chosen_roles = emp_roles if emp_roles else admin_roles
        role_str = ", ".join(chosen_roles) if chosen_roles else "Hospital Staff"
        dept_str = ", ".join(emp_depts) if emp_depts else "Hospital-Wide"

        recipients.append(
            RecipientResponse(
                membership_id=mem.id,
                user_id=user.id,
                full_name=user.full_name,
                email=user.email,
                role_name=role_str,
                department_name=dept_str,
            )
        )

    return recipients


@router.post("/messages", response_model=EmployeeMessageResponse, status_code=status.HTTP_201_CREATED)
def create_employee_message(
    payload: CreateMessageRequest,
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Sends an internal request or message to a designated General Staff employee."""
    _check_comm_perm(emp_ctx, db, "communication:create", alternate_code="queue:manage")

    # Verify recipient exists and belongs to the same hospital
    recipient_mem = (
        db.query(TenantMembership)
        .filter(
            TenantMembership.id == payload.recipient_membership_id,
            TenantMembership.hospital_id == emp_ctx.hospital.id,
            TenantMembership.status == "active",
        )
        .first()
    )
    if not recipient_mem:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipient not found or not an active employee in your hospital facility.",
        )

    recipient_usr = db.query(User).filter(User.id == recipient_mem.user_id).first()
    if not recipient_usr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipient user account not found.")

    if payload.recipient_membership_id == emp_ctx.membership.id or recipient_mem.user_id == emp_ctx.user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot send an internal communication message to oneself.",
        )

    # Sender role details
    sender_role = "Staff Member"
    sender_dept = "Hospital-Wide"
    if emp_ctx.active_assignments:
        a = emp_ctx.active_assignments[0]
        if a.role:
            sender_role = a.role.name
        if a.department:
            sender_dept = a.department.name

    # Recipient role details
    recip_asgn = (
        db.query(RoleAssignment)
        .filter(RoleAssignment.membership_id == recipient_mem.id, RoleAssignment.is_active == True)
        .first()
    )
    recip_role = recip_asgn.role.name if recip_asgn and recip_asgn.role else "General Staff"
    recip_dept = recip_asgn.department.name if recip_asgn and recip_asgn.department else "Hospital-Wide"

    msg = EmployeeMessage(
        id=uuid.uuid4(),
        hospital_id=emp_ctx.hospital.id,
        sender_membership_id=emp_ctx.membership.id,
        sender_user_id=emp_ctx.user.id,
        sender_name=emp_ctx.user.full_name,
        sender_role_name=sender_role,
        sender_department_name=sender_dept,
        recipient_membership_id=recipient_mem.id,
        recipient_user_id=recipient_usr.id,
        recipient_name=recipient_usr.full_name,
        recipient_role_name=recip_role,
        recipient_department_name=recip_dept,
        subject=payload.subject.strip(),
        message_body=payload.message_body.strip(),
        status="PENDING",
        is_read=False,
    )
    db.add(msg)

    # Send notification to recipient
    db.add(
        HospitalNotification(
            id=uuid.uuid4(),
            hospital_id=emp_ctx.hospital.id,
            recipient_user_id=recipient_usr.id,
            title="Internal Staff Request",
            message=f"Request from {emp_ctx.user.full_name} ({sender_role}) to {recipient_usr.full_name}: {payload.subject[:80]}",
            category="system",
        )
    )

    db.commit()
    db.refresh(msg)
    return msg


@router.get("/inbox", response_model=List[EmployeeMessageResponse])
def get_inbox_messages(
    status_filter: Optional[str] = Query(None, alias="status"),
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Returns requests and communications received by the current employee."""
    _check_comm_perm(emp_ctx, db, "communication:read", alternate_code="queue:read")

    query = db.query(EmployeeMessage).filter(
        EmployeeMessage.recipient_membership_id == emp_ctx.membership.id,
        EmployeeMessage.hospital_id == emp_ctx.hospital.id,
    )
    if status_filter and status_filter.upper() in ("PENDING", "IN_PROGRESS", "COMPLETED"):
        query = query.filter(EmployeeMessage.status == status_filter.upper())

    return query.order_by(desc(EmployeeMessage.created_at)).all()


@router.get("/sent", response_model=List[EmployeeMessageResponse])
def get_sent_messages(
    status_filter: Optional[str] = Query(None, alias="status"),
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Returns requests and communications sent by the current employee."""
    _check_comm_perm(emp_ctx, db, "communication:read", alternate_code="queue:read")

    query = db.query(EmployeeMessage).filter(
        EmployeeMessage.sender_membership_id == emp_ctx.membership.id,
        EmployeeMessage.hospital_id == emp_ctx.hospital.id,
    )
    if status_filter and status_filter.upper() in ("PENDING", "IN_PROGRESS", "COMPLETED"):
        query = query.filter(EmployeeMessage.status == status_filter.upper())

    return query.order_by(desc(EmployeeMessage.created_at)).all()


@router.get("/unread-count", response_model=UnreadCountResponse)
def get_unread_count(
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Returns the count of unread communications for the authenticated employee."""
    _check_comm_perm(emp_ctx, db, "communication:read", alternate_code="queue:read")

    count = (
        db.query(EmployeeMessage)
        .filter(
            EmployeeMessage.recipient_membership_id == emp_ctx.membership.id,
            EmployeeMessage.hospital_id == emp_ctx.hospital.id,
            EmployeeMessage.is_read == False,
        )
        .count()
    )
    return UnreadCountResponse(unread_count=count)


@router.get("/messages/{message_id}", response_model=EmployeeMessageResponse)
def get_message_detail(
    message_id: uuid.UUID,
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Retrieves single message detail. Automatically marks unread message as read if recipient accesses it."""
    _check_comm_perm(emp_ctx, db, "communication:read", alternate_code="queue:read")

    msg = (
        db.query(EmployeeMessage)
        .filter(EmployeeMessage.id == message_id, EmployeeMessage.hospital_id == emp_ctx.hospital.id)
        .first()
    )
    if not msg:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found.")

    is_sender = msg.sender_membership_id == emp_ctx.membership.id
    is_recipient = msg.recipient_membership_id == emp_ctx.membership.id

    if not (is_sender or is_recipient):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You are neither the sender nor the recipient of this communication.",
        )

    # Auto-read upon recipient viewing
    if is_recipient and not msg.is_read:
        msg.is_read = True
        msg.read_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(msg)

    return msg


@router.post("/messages/{message_id}/complete", response_model=EmployeeMessageResponse)
def complete_employee_message(
    message_id: uuid.UUID,
    payload: CompleteMessageRequest,
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Marks an actionable request as completed. Accessible only to recipient holding communication:complete."""
    _check_comm_perm(emp_ctx, db, "communication:complete")

    msg = (
        db.query(EmployeeMessage)
        .filter(EmployeeMessage.id == message_id, EmployeeMessage.hospital_id == emp_ctx.hospital.id)
        .first()
    )
    if not msg:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found.")

    if msg.recipient_membership_id != emp_ctx.membership.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Only the assigned recipient can mark this request as completed.",
        )

    now = datetime.now(timezone.utc)
    msg.status = "COMPLETED"
    msg.completed_at = now
    msg.completed_by_user_id = emp_ctx.user.id
    msg.completed_by_membership_id = emp_ctx.membership.id
    msg.completed_by_name = emp_ctx.user.full_name
    if payload.completion_notes:
        msg.completion_notes = payload.completion_notes.strip()
    if not msg.is_read:
        msg.is_read = True
        msg.read_at = now

    # Notify sender of task completion
    db.add(
        HospitalNotification(
            id=uuid.uuid4(),
            hospital_id=emp_ctx.hospital.id,
            recipient_user_id=msg.sender_user_id,
            title="Task Completed",
            message=f"Request '{msg.subject}' was marked completed by {emp_ctx.user.full_name}.",
            category="system",
        )
    )

    db.commit()
    db.refresh(msg)
    return msg


@router.post("/messages/{message_id}/status", response_model=EmployeeMessageResponse)
def update_message_status(
    message_id: uuid.UUID,
    payload: UpdateMessageStatusRequest,
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """Updates request status (e.g. IN_PROGRESS). Accessible only to recipient holding communication:respond."""
    _check_comm_perm(emp_ctx, db, "communication:respond")

    msg = (
        db.query(EmployeeMessage)
        .filter(EmployeeMessage.id == message_id, EmployeeMessage.hospital_id == emp_ctx.hospital.id)
        .first()
    )
    if not msg:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found.")

    if msg.recipient_membership_id != emp_ctx.membership.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Only the assigned recipient can update this request's status.",
        )

    new_status = payload.status.upper()
    msg.status = new_status
    if new_status == "COMPLETED" and not msg.completed_at:
        now = datetime.now(timezone.utc)
        msg.completed_at = now
        msg.completed_by_user_id = emp_ctx.user.id
        msg.completed_by_membership_id = emp_ctx.membership.id
        msg.completed_by_name = emp_ctx.user.full_name

    db.commit()
    db.refresh(msg)
    return msg
