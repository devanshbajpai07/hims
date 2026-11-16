import logging
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional, Set
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.permissions import MASTER_PERMISSION_CATALOGUE, SYSTEM_ROLE_PERMISSIONS
from app.models.department import Department
from app.models.hospital import Hospital
from app.models.permission import (
    Permission,
    RoleVersion,
    RoleVersionPermission,
)
from app.models.role import Role
from app.models.assignment import RoleAssignment

logger = logging.getLogger("hims.rbac_seeder")


def seed_master_permissions(db: Session) -> Dict[str, Permission]:
    """Ensures all atomic permissions in the master catalogue exist in the permissions table."""
    existing_perms = {p.code: p for p in db.query(Permission).all()}
    new_perms = []

    for code, defn in MASTER_PERMISSION_CATALOGUE.items():
        if code not in existing_perms:
            perm = Permission(
                id=uuid.uuid4(),
                code=code,
                name=defn.name,
                description=defn.description,
                category=defn.category,
                module=defn.module,
                risk_level=defn.risk_level,
                tier_availability=defn.min_tier,
                is_system=True,
                is_active=True,
            )
            db.add(perm)
            new_perms.append(perm)
            existing_perms[code] = perm
        else:
            perm = existing_perms[code]
            perm.name = defn.name
            perm.description = defn.description
            perm.category = defn.category
            perm.module = defn.module
            perm.risk_level = defn.risk_level
            perm.tier_availability = defn.min_tier
            perm.is_active = True

    if new_perms:
        db.flush()

    return existing_perms


def provision_hospital_rbac_templates(
    db: Session, hospital_id: uuid.UUID, perms_by_code: Optional[Dict[str, Permission]] = None
) -> None:
    """Ensures all system roles for a given hospital have active Version 1 templates
    populated with their canonical permission sets.
    """
    now = datetime.now(timezone.utc)
    if perms_by_code is None:
        perms_by_code = seed_master_permissions(db)

    # 1. Fetch existing hospital roles with their active versions
    hospital_roles = (
        db.query(Role)
        .options(joinedload(Role.versions))
        .filter(Role.hospital_id == hospital_id)
        .all()
    )
    roles_by_code = {r.code: r for r in hospital_roles}

    role_templates = [
        ("Hospital Administrator", "admin", "hospital", "Executive governance, workforce administration, and full institutional authority"),
        ("Department Head", "dept_head", "department", "Clinical leadership, shift management, and Level-1 approval authority"),
        ("Doctor / Clinician", "doctor", "department", "Medical assessment, inpatient/outpatient consultation, and prescription authority"),
        ("Registered Nurse", "nurse", "department", "Clinical nursing care, medication administration, and patient monitoring"),
        ("Pharmacist / Dispensary Officer (Future Scope)", "pharmacist", "department", "Planned future capability: Medication dispensing, prescription review, and dispensary stock management"),
        ("Medical Receptionist", "receptionist", "hospital", "Hospital-wide patient intake, scheduling, check-in, triage routing, and front desk coordination"),
        ("General Staff", "staff", "department", "Administrative support, operational coordination, and hospital logistics"),
        ("Nursing Services Supervisor", "nursing_supervisor", "hospital", "Hospital-wide nursing workforce coordination, shift scheduling, and clinical nursing oversight"),
    ]

    for r_name, r_code, r_scope, r_desc in role_templates:
        if r_code not in roles_by_code:
            role = Role(
                id=uuid.uuid4(),
                hospital_id=hospital_id,
                name=r_name,
                code=r_code,
                scope=r_scope,
                description=r_desc,
                is_active=True,
                is_system=True,
            )
            db.add(role)
            db.flush()
            roles_by_code[r_code] = role
        else:
            role = roles_by_code[r_code]
            role.name = r_name
            role.is_system = True
            role.scope = r_scope
            role.description = r_desc

        # Find active version
        active_ver = next((v for v in role.versions if v.is_active), None)
        if not active_ver:
            v1 = next((v for v in role.versions if v.version_number == 1), None)
            if not v1:
                v1 = RoleVersion(
                    id=uuid.uuid4(),
                    role_id=role.id,
                    version_number=1,
                    is_active=True,
                    change_reason="Initial canonical system role template version (v1.0.0)",
                    activated_at=now,
                )
                db.add(v1)
                db.flush()
                role.versions.append(v1)
            else:
                v1.is_active = True
                v1.activated_at = v1.activated_at or now

            active_ver = v1
            role.active_version_id = active_ver.id

        # Populate permissions for active version
        target_perm_codes = set(SYSTEM_ROLE_PERMISSIONS.get(r_code, []))
        existing_rvps = db.query(RoleVersionPermission).filter(
            RoleVersionPermission.role_version_id == active_ver.id
        ).all()

        existing_assigned_perm_ids = {rvp.permission_id for rvp in existing_rvps}
        target_perm_ids = {perms_by_code[c].id for c in target_perm_codes if c in perms_by_code}

        # For system role templates, prune obsolete permissions not in canonical definition
        if role.is_system:
            for rvp in existing_rvps:
                if rvp.permission_id not in target_perm_ids:
                    db.delete(rvp)

        for p_code in target_perm_codes:
            perm_obj = perms_by_code.get(p_code)
            if perm_obj and perm_obj.id not in existing_assigned_perm_ids:
                rvp = RoleVersionPermission(
                    id=uuid.uuid4(),
                    role_version_id=active_ver.id,
                    permission_id=perm_obj.id,
                )
                db.add(rvp)

        # Backfill role_version_id on existing active RoleAssignments for this role
        db.query(RoleAssignment).filter(
            RoleAssignment.role_id == role.id,
            RoleAssignment.role_version_id.is_(None),
        ).update({"role_version_id": active_ver.id}, synchronize_session=False)

    # 2. Mark system departments as is_system = True
    system_dept_codes = {"GEN-MED", "EMERG", "CARDIO", "PEDS", "RAD", "PATH", "OPD", "DISP"}
    db.query(Department).filter(
        Department.hospital_id == hospital_id,
        Department.code.in_(system_dept_codes),
    ).update({"is_system": True}, synchronize_session=False)

    db.flush()


def backfill_all_hospitals_rbac(db: Session) -> None:
    """Idempotently provisions permissions and role versions across all hospitals in the system."""
    perms_by_code = seed_master_permissions(db)
    hospitals = db.query(Hospital).all()
    for h in hospitals:
        provision_hospital_rbac_templates(db, h.id, perms_by_code)
    db.commit()
    logger.info("Successfully provisioned RBAC permissions and role templates for %d hospitals.", len(hospitals))
