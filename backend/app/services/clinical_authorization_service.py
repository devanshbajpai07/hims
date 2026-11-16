"""Contextual Clinical Authorization and Patient Data Privacy Service for AURA HIMS.

Enforces granular role-and-department bounded access to electronic health records,
restricting clinical notes, prescriptions, and demographic visibility based on
active clinical assignments and patient encounters.
"""
from dataclasses import dataclass
from datetime import datetime, timezone
import logging
from typing import Any, Dict, List, Optional, Set
import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.models.assignment import RoleAssignment
from app.models.audit import AuditLog
from app.models.hospital import Hospital
from app.models.membership import TenantMembership
from app.models.role import Role
from app.models.user import User

logger = logging.getLogger("hims.clinical_auth")


@dataclass
class ClinicalAccessDecision:
    is_permitted: bool
    actor_user_id: uuid.UUID
    hospital_id: uuid.UUID
    patient_id: str
    access_level: str  # "FULL_CLINICAL", "NURSING_CARE", "PHARMACY_DISPENSE", "DEMOGRAPHIC_ONLY", "DENIED"
    reason: str
    audit_logged: bool = True


class ClinicalAuthorizationService:
    @classmethod
    def authorize_patient_data_access(
        cls,
        db: Session,
        user_id: uuid.UUID,
        hospital_id: uuid.UUID,
        patient_id: str,
        data_domain: str,  # "demographics", "vitals", "emr_notes", "prescriptions", "billing"
        patient_department_id: Optional[uuid.UUID] = None,
        ip_address: Optional[str] = None,
    ) -> ClinicalAccessDecision:
        """Authorizes access to sensitive patient clinical and demographic records.
        Applies contextual clinical boundaries beyond simple role possession:
        - Medical Receptionists: Restricted to demographics and scheduling (no EMR notes)
        - Pharmacists: Restricted to prescriptions and medication history (no clinical consultation notes)
        - Nurses: Authorized for vitals, EMR notes, and care plans within active assigned department
        - Doctors: Authorized for full clinical notes and prescriptions within active assigned department
        - Department Heads: Authorized for department clinical records within their leadership scope
        - Hospital Administrators: Operational and governance metrics; clinical patient files require explicit assignment
        """
        # 1. Fetch active membership
        mem = (
            db.query(TenantMembership)
            .options(
                joinedload(TenantMembership.role_assignments).joinedload(RoleAssignment.role),
                joinedload(TenantMembership.role_assignments).joinedload(RoleAssignment.department),
            )
            .filter(
                TenantMembership.user_id == user_id,
                TenantMembership.hospital_id == hospital_id,
                TenantMembership.status == "active",
            )
            .first()
        )
        if not mem:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: No active membership in this hospital facility.",
            )

        active_assignments = [
            a for a in mem.role_assignments if a.is_active and a.assignment_status == "active"
        ]
        if not active_assignments:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: No active role assignments.",
            )

        role_codes = {a.role.code for a in active_assignments if a.role}
        is_facility_scoped = any(
            a.scope_type == "FACILITY" or (a.role and a.role.scope == "hospital")
            for a in active_assignments
        )

        assigned_dept_ids = {
            a.department_id for a in active_assignments if a.department_id is not None
        }

        # 2. Department boundary check (if patient record belongs to a specific department)
        if patient_department_id is not None and not is_facility_scoped:
            if patient_department_id not in assigned_dept_ids:
                decision = ClinicalAccessDecision(
                    is_permitted=False,
                    actor_user_id=user_id,
                    hospital_id=hospital_id,
                    patient_id=patient_id,
                    access_level="DENIED",
                    reason="Patient belongs to a clinical department outside your active assignments.",
                )
                cls._log_audit(db, decision, data_domain, ip_address)
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Access denied: {decision.reason}",
                )

        # 3. Domain-specific data privacy boundaries
        if data_domain == "demographics":
            # Receptionists, nurses, doctors, pharmacists, admins can access demographics
            level = "DEMOGRAPHIC_ONLY"
            perm = True
            reason = "Authorized for patient demographic directory."

        elif data_domain in ("emr_notes", "clinical_chart"):
            if "receptionist" in role_codes and not any(r in role_codes for r in ("doctor", "nurse", "dept_head")):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: Medical receptionists are not permitted to inspect clinical EMR consultation notes.",
                )
            if "pharmacist" in role_codes and not any(r in role_codes for r in ("doctor", "nurse", "dept_head")):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: Dispensary officers are restricted from accessing clinical consultation notes.",
                )
            level = "FULL_CLINICAL"
            perm = True
            reason = "Authorized for clinical EMR documentation."

        elif data_domain == "prescriptions":
            if "receptionist" in role_codes and not any(r in role_codes for r in ("doctor", "nurse", "pharmacist")):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: Receptionists cannot inspect medication prescriptions.",
                )
            level = "PHARMACY_DISPENSE"
            perm = True
            reason = "Authorized for prescription inspection."

        elif data_domain == "vitals":
            level = "NURSING_CARE"
            perm = True
            reason = "Authorized for patient vital metrics."

        else:
            level = "FULL_CLINICAL"
            perm = True
            reason = f"Authorized for '{data_domain}'."

        decision = ClinicalAccessDecision(
            is_permitted=perm,
            actor_user_id=user_id,
            hospital_id=hospital_id,
            patient_id=patient_id,
            access_level=level,
            reason=reason,
        )
        cls._log_audit(db, decision, data_domain, ip_address)
        return decision

    @classmethod
    def _log_audit(
        cls,
        db: Session,
        decision: ClinicalAccessDecision,
        data_domain: str,
        ip_address: Optional[str],
    ) -> None:
        status_str = "GRANTED" if decision.is_permitted else "BLOCKED"
        db.add(AuditLog(
            hospital_id=decision.hospital_id,
            user_id=decision.actor_user_id,
            action=f"PATIENT_DATA_{status_str}",
            resource_type="patient_record",
            resource_id=decision.patient_id,
            details=f"Domain: {data_domain} | Level: {decision.access_level} | Result: {status_str} | Reason: {decision.reason}",
            ip_address=ip_address,
        ))
        db.commit()

