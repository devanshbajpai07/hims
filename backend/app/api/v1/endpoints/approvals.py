from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.api.deps_admin import AdminContext, get_current_admin
from app.api.deps_employee import EmployeeContext, get_current_employee
from app.db.database import get_db
from app.services.approval_service import ApprovalService

router = APIRouter(prefix="/approvals", tags=["Approvals"])


class DeptHeadReviewPayload(BaseModel):
    assignment_request_id: str
    dept_head_user_id: Optional[str] = None  # Deprecated / ignored: identity resolved from authenticated session
    decision: str  # "approved" or "rejected"
    notes: Optional[str] = None


class AssignmentDecisionItem(BaseModel):
    assignment_id: str
    decision: str  # "approved" or "rejected"


class AdminFinalApprovalPayload(BaseModel):
    registration_request_id: str
    admin_user_id: Optional[str] = None  # Deprecated / ignored: identity resolved from authenticated session
    verify_employee_uid: bool = True
    assignment_decisions: List[AssignmentDecisionItem]
    notes: Optional[str] = None


@router.post("/department-head")
def department_head_review(
    payload: DeptHeadReviewPayload,
    request: Request,
    emp_ctx: EmployeeContext = Depends(get_current_employee),
    db: Session = Depends(get_db),
):
    """
    First Level Approval:
    Department Head reviews an assignment request for their authorized department.
    Security: Strictly requires an authenticated employee session. Reviewer identity
    is extracted exclusively from the authenticated context (never trusted from payload).
    """
    reviewer_user_id = str(emp_ctx.user.id)

    assign = ApprovalService.department_head_review(
        db,
        assignment_request_id=payload.assignment_request_id,
        dept_head_user_id=reviewer_user_id,
        decision=payload.decision,
        notes=payload.notes,
    )
    return {
        "success": True,
        "assignment_id": str(assign.id),
        "status": assign.status,
        "message": f"Department Head review recorded: {assign.status}.",
    }


@router.post("/admin-final")
def admin_final_approval(
    payload: AdminFinalApprovalPayload,
    request: Request,
    admin_ctx: AdminContext = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """
    Second Level Approval:
    Hospital Administrator verifies Employee UID and gives final approval decisions
    on department assignments (partial approvals supported).
    Security: Strictly requires an authenticated hospital administrator session. Admin identity
    is extracted exclusively from the authenticated admin context (never trusted from payload).
    """
    admin_user_id = str(admin_ctx.user.id)

    reg_req = ApprovalService.admin_final_approval(
        db,
        registration_request_id=payload.registration_request_id,
        admin_user_id=admin_user_id,
        verify_employee_uid=payload.verify_employee_uid,
        assignment_decisions=[d.model_dump() for d in payload.assignment_decisions],
        notes=payload.notes,
    )
    return {
        "success": True,
        "registration_id": str(reg_req.id),
        "status": reg_req.status,
        "employee_uid_verified": reg_req.employee_uid_verified,
        "message": f"Hospital Administrator final approval recorded: {reg_req.status}.",
    }
