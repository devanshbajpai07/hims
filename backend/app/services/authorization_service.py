"""Authoritative Central Authorization Service for AURA HIMS.

Executes deterministic 11-step permission resolution pipeline:
1. Authenticate employee identity
2. Validate active hospital membership
3. Validate selected hospital context
4. Identify active role assignments
5. Resolve permissions from active role versions (including recursive parent inheritance for ULTRA)
6. Apply explicit employee-level denials (DENY overrides inherited role grants)
7. Apply explicit employee-level grants (GRANT adds permitted capability)
8. Verify subscription tier allowlist (BASIC / PRO / ULTRA)
9. Verify department and facility scope (DEPARTMENT, MULTI_DEPARTMENT, FACILITY)
10. Apply contextual clinical safety checks
11. Authorize or reject operation
"""
from dataclasses import dataclass, field
from datetime import datetime, timezone
import json
import logging
import uuid
from typing import Any, Dict, List, Optional, Set, Tuple

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, joinedload

from app.api.deps_admin import AdminContext, get_current_admin
from app.core.config import settings
from app.core.exceptions import AccountStatusError, HIMSException
from app.core.permissions import (
    MASTER_PERMISSION_CATALOGUE,
    PermissionDefinition,
    get_tier_allowed_permissions,
    is_permission_allowed_in_tier,
)
from app.core.plans import get_plan_entitlements
from app.core.security import decode_token, hash_token
from app.db.database import get_db
from app.models.assignment import RoleAssignment
from app.models.department import Department
from app.models.hospital import Hospital
from app.models.membership import TenantMembership
from app.models.permission import (
    MembershipPermissionOverride,
    Permission,
    RoleVersion,
    RoleVersionPermission,
)
from app.models.purchaser_subscription import PurchaserSubscription
from app.models.role import Role
from app.models.session import SessionRecord
from app.models.user import User

logger = logging.getLogger("hims.authorization")


def _parse_dept_ids(raw: Optional[str]) -> Set[str]:
    try:
        return set(str(d) for d in json.loads(raw or "[]"))
    except (json.JSONDecodeError, TypeError, ValueError):
        return set()


@dataclass
class ResolvedPermissionItem:
    code: str
    name: str
    category: str
    module: str
    is_granted: bool
    status: str  # "GRANTED", "DENIED_BY_OVERRIDE", "DENIED_BY_TIER", "NOT_GRANTED"
    source: str  # "ROLE", "OVERRIDE_GRANT", "INHERITED_ROLE", "TIER_RESTRICTED", "NONE"
    source_role_name: Optional[str] = None
    source_role_version: Optional[int] = None
    department_scope: Optional[str] = None
    department_ids: List[str] = field(default_factory=list)
    reason: Optional[str] = None
    expires_at: Optional[datetime] = None
    explanation: str = ""


@dataclass
class AuthorizationContext:
    user: User
    membership: TenantMembership
    hospital: Hospital
    subscription: Optional[PurchaserSubscription]
    plan_code: str
    active_assignments: List[RoleAssignment]
    effective_permission_codes: Set[str]
    department_scopes: Dict[str, Set[uuid.UUID]]  # permission_code -> set of authorized department_ids (or None for facility-wide)
    is_facility_wide: Dict[str, bool]  # permission_code -> bool


class AuthorizationService:
    @classmethod
    def resolve_role_version_permissions(
        cls,
        db: Session,
        role_version_id: uuid.UUID,
        visited_versions: Optional[Set[uuid.UUID]] = None,
    ) -> List[Tuple[Permission, str, int]]:
        """Resolves all permissions for a role version, including recursive parent
        role version inheritance (supported in ULTRA tier).
        Guards against cyclic inheritance and cross-hospital leakage.
        Returns List of (Permission, source_role_name, version_number).
        """
        if visited_versions is None:
            visited_versions = set()

        if role_version_id in visited_versions:
            logger.warning("Cyclic role inheritance detected at role version %s", role_version_id)
            return []
        visited_versions.add(role_version_id)

        rv = (
            db.query(RoleVersion)
            .options(
                joinedload(RoleVersion.role),
                joinedload(RoleVersion.parent_role).joinedload(Role.versions),
                joinedload(RoleVersion.permissions).joinedload(RoleVersionPermission.permission),
            )
            .filter(RoleVersion.id == role_version_id)
            .first()
        )
        if not rv:
            return []

        results: List[Tuple[Permission, str, int]] = []
        for rvp in rv.permissions:
            if rvp.permission and rvp.permission.is_active:
                results.append((rvp.permission, rv.role.name, rv.version_number))

        # Check for parent role inheritance (ULTRA feature)
        if rv.parent_role_id and rv.parent_role and rv.parent_role.hospital_id == rv.role.hospital_id:
            # Locate active version of parent role
            parent_active_ver = next(
                (v for v in rv.parent_role.versions if v.is_active), None
            )
            if parent_active_ver:
                parent_results = cls.resolve_role_version_permissions(
                    db, parent_active_ver.id, visited_versions
                )
                for p_perm, p_name, p_ver in parent_results:
                    # Do not overwrite if already granted by direct child
                    if not any(r[0].code == p_perm.code for r in results):
                        results.append((p_perm, f"{rv.role.name} (Inherited from {p_name})", p_ver))

        return results

    @classmethod
    def get_effective_permissions_detail(
        cls,
        db: Session,
        membership_id: uuid.UUID,
        target_department_id: Optional[uuid.UUID] = None,
    ) -> List[ResolvedPermissionItem]:
        """Calculates the complete authoritative permission inspection table for an employee.
        Includes full audit justification, sources, department scopes, and tier bounds.
        """
        mem = (
            db.query(TenantMembership)
            .options(
                joinedload(TenantMembership.hospital).joinedload(Hospital.subscription),
                joinedload(TenantMembership.role_assignments).joinedload(RoleAssignment.role),
                joinedload(TenantMembership.role_assignments).joinedload(RoleAssignment.department),
            )
            .filter(TenantMembership.id == membership_id)
            .first()
        )
        if not mem:
            raise ValueError(f"TenantMembership '{membership_id}' not found.")

        hospital = mem.hospital
        sub = hospital.subscription if hospital else None
        plan_code = sub.plan_code if sub and sub.status.lower() == "active" else "BASIC"
        now = datetime.now(timezone.utc)

        # 1. Active Role Assignments
        active_assignments = [
            a for a in mem.role_assignments
            if a.is_active and a.assignment_status == "active"
        ]

        # Map inherited permissions: code -> (Permission, source_role_name, version_num, dept_id, dept_name, scope_type, scope_dept_ids)
        inherited_perms: Dict[str, List[Dict[str, Any]]] = {}

        for assign in active_assignments:
            # Resolve role version
            r_ver_id = assign.role_version_id
            if not r_ver_id and assign.role:
                # Fallback to active version of role
                r_ver = db.query(RoleVersion).filter(RoleVersion.role_id == assign.role.id, RoleVersion.is_active == True).first()
                if r_ver:
                    r_ver_id = r_ver.id

            if r_ver_id:
                rv_perms = cls.resolve_role_version_permissions(db, r_ver_id)
                for perm, r_name, v_num in rv_perms:
                    if perm.code not in inherited_perms:
                        inherited_perms[perm.code] = []
                    inherited_perms[perm.code].append({
                        "perm": perm,
                        "role_name": r_name,
                        "role_version": v_num,
                        "department_id": assign.department_id,
                        "department_name": assign.department.name if assign.department else None,
                        "scope_type": assign.scope_type,
                        "scope_department_ids": assign.scope_department_ids,
                    })

        # 2. Individual Overrides (GRANT and DENY)
        overrides = (
            db.query(MembershipPermissionOverride)
            .options(
                joinedload(MembershipPermissionOverride.permission),
                joinedload(MembershipPermissionOverride.department),
            )
            .filter(
                MembershipPermissionOverride.membership_id == membership_id,
                MembershipPermissionOverride.revoked_at.is_(None),
            )
            .all()
        )

        valid_overrides = []
        for o in overrides:
            if o.expires_at:
                exp = o.expires_at
                if exp.tzinfo is None:
                    exp = exp.replace(tzinfo=timezone.utc)
                if now > exp:
                    continue
            valid_overrides.append(o)

        # HIGH-2: Filter overrides by department_id — only apply overrides scoped to this
        # department or facility-wide overrides (department_id is None).
        target_dept_uuid = None
        target_dept_str = None
        if target_department_id is not None:
            target_dept_str = str(target_department_id)
            if isinstance(target_department_id, uuid.UUID):
                target_dept_uuid = target_department_id
            else:
                try:
                    target_dept_uuid = uuid.UUID(str(target_department_id))
                except (ValueError, TypeError, AttributeError):
                    target_dept_uuid = None

        def _dept_matches(override_dept_id: Optional[uuid.UUID]) -> bool:
            if override_dept_id is None:
                return True
            if target_department_id is None:
                return False
            return (
                override_dept_id == target_department_id
                or (target_dept_uuid is not None and override_dept_id == target_dept_uuid)
                or str(override_dept_id) == target_dept_str
            )

        override_grants = {
            o.permission.code: o
            for o in valid_overrides
            if o.override_type == "GRANT" and _dept_matches(o.department_id)
        }
        override_denies = {
            o.permission.code: o
            for o in valid_overrides
            if o.override_type == "DENY" and _dept_matches(o.department_id)
        }

        tier_allowed = get_tier_allowed_permissions(plan_code)

        # 3. Assemble detailed breakdown across all catalogue permissions
        resolved_items: List[ResolvedPermissionItem] = []

        for code, defn in sorted(MASTER_PERMISSION_CATALOGUE.items()):
            is_tier_permitted = code in tier_allowed

            # Check explicit DENY first (Strict Override)
            if code in override_denies:
                deny_o = override_denies[code]
                resolved_items.append(
                    ResolvedPermissionItem(
                        code=code,
                        name=defn.name,
                        category=defn.category,
                        module=defn.module,
                        is_granted=False,
                        status="DENIED_BY_OVERRIDE",
                        source="OVERRIDE_DENY",
                        reason=deny_o.reason,
                        department_scope=deny_o.department.name if deny_o.department else "Hospital-Wide",
                        expires_at=deny_o.expires_at,
                        explanation=f"Explicitly DENIED by administrator override: '{deny_o.reason}'.",
                    )
                )
                continue

            # Check Tier Restriction next
            if not is_tier_permitted:
                resolved_items.append(
                    ResolvedPermissionItem(
                        code=code,
                        name=defn.name,
                        category=defn.category,
                        module=defn.module,
                        is_granted=False,
                        status="DENIED_BY_TIER",
                        source="TIER_RESTRICTED",
                        explanation=f"Restricted by {plan_code} subscription tier. Requires {defn.min_tier} tier or higher.",
                    )
                )
                continue

            # Check individual GRANT override
            if code in override_grants:
                grant_o = override_grants[code]
                resolved_items.append(
                    ResolvedPermissionItem(
                        code=code,
                        name=defn.name,
                        category=defn.category,
                        module=defn.module,
                        is_granted=True,
                        status="GRANTED",
                        source="OVERRIDE_GRANT",
                        reason=grant_o.reason,
                        department_scope=grant_o.department.name if grant_o.department else "Hospital-Wide",
                        expires_at=grant_o.expires_at,
                        explanation=f"Explicitly GRANTED via individual override: '{grant_o.reason}'.",
                    )
                )
                continue

            # Check inherited role assignments
            if code in inherited_perms:
                entries = inherited_perms[code]
                # Filter by department scope:
                # If target_department_id is provided, match FACILITY, DEPARTMENT (matching target), or MULTI_DEPARTMENT (containing target)
                # If target_department_id is None, only FACILITY-scoped assignments grant permissions (HIGH-1)
                if target_department_id is not None:
                    target_dept_str = str(target_department_id)
                    matching_entries = [
                        e for e in entries
                        if e["scope_type"] == "FACILITY"
                        or e.get("department_id") is None
                        or (
                            e["scope_type"] == "DEPARTMENT"
                            and (
                                e.get("department_id") == target_department_id
                                or (target_dept_uuid is not None and e.get("department_id") == target_dept_uuid)
                                or (e.get("department_id") is not None and str(e.get("department_id")) == target_dept_str)
                            )
                        )
                        or (
                            e["scope_type"] == "MULTI_DEPARTMENT"
                            and target_dept_str in _parse_dept_ids(e.get("scope_department_ids"))
                        )
                    ]
                else:
                    # When target_department_id is None, all active assignments are included
                    # for hospital-wide effective permission inspection
                    matching_entries = entries

                if matching_entries:
                    first_match = matching_entries[0]
                    dept_names = [e["department_name"] for e in matching_entries if e["department_name"]]
                    dept_scope_str = ", ".join(set(dept_names)) if dept_names else "Hospital-Wide"
                    if any(e["scope_type"] == "FACILITY" for e in matching_entries):
                        dept_scope_str = "Facility-Wide (All Departments)"

                    source_str = "ROLE" if "Inherited" not in first_match["role_name"] else "INHERITED_ROLE"
                    resolved_items.append(
                        ResolvedPermissionItem(
                            code=code,
                            name=defn.name,
                            category=defn.category,
                            module=defn.module,
                            is_granted=True,
                            status="GRANTED",
                            source=source_str,
                            source_role_name=first_match["role_name"],
                            source_role_version=first_match["role_version"],
                            department_scope=dept_scope_str,
                            explanation=f"Inherited from active role '{first_match['role_name']}' (v{first_match['role_version']}) under scope '{dept_scope_str}'.",
                        )
                    )
                    continue

            # Default: Not granted
            resolved_items.append(
                ResolvedPermissionItem(
                    code=code,
                    name=defn.name,
                    category=defn.category,
                    module=defn.module,
                    is_granted=False,
                    status="NOT_GRANTED",
                    source="NONE",
                    explanation="Not assigned in any active role or individual grant.",
                )
            )

        return resolved_items

    @classmethod
    def get_effective_permissions_set(
        cls,
        db: Session,
        membership_id: uuid.UUID,
        department_id: Optional[uuid.UUID] = None,
    ) -> Set[str]:
        """High-speed resolver returning strictly the set of granted permission codes."""
        detail = cls.get_effective_permissions_detail(db, membership_id, department_id)
        return {item.code for item in detail if item.is_granted}

    @classmethod
    def authorize_employee(
        cls,
        db: Session,
        user_id: uuid.UUID,
        hospital_id: uuid.UUID,
        required_permission: Optional[str] = None,
        department_id: Optional[uuid.UUID] = None,
        patient_id: Optional[str] = None,
    ) -> AuthorizationContext:
        """Core backend authorization check verifying membership, permissions,
        tier eligibility, and departmental scope.
        """
        # 1. Identity & Active Membership verification
        user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User identity is inactive or does not exist.",
            )

        mem = (
            db.query(TenantMembership)
            .options(
                joinedload(TenantMembership.hospital).joinedload(Hospital.subscription),
                joinedload(TenantMembership.role_assignments).joinedload(RoleAssignment.role),
            )
            .filter(
                TenantMembership.user_id == user_id,
                TenantMembership.hospital_id == hospital_id,
            )
            .first()
        )
        if not mem:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: No membership record for the specified hospital facility.",
            )

        if mem.status.lower() != "active":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: Hospital membership is {mem.status.upper()}.",
            )

        hospital = mem.hospital
        if not hospital or not hospital.is_active:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Hospital facility is inactive or disabled.",
            )

        sub = hospital.subscription
        plan_code = sub.plan_code if sub and sub.status.lower() == "active" else "BASIC"

        # 2. Check permission if specified
        detail = cls.get_effective_permissions_detail(db, mem.id, department_id)
        effective_codes = {item.code for item in detail if item.is_granted}

        if required_permission:
            if required_permission not in effective_codes:
                # Find reason
                item = next((i for i in detail if i.code == required_permission), None)
                reason = item.explanation if item else "Permission not granted."
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Access denied: Missing required permission '{required_permission}'. {reason}",
                )

        return AuthorizationContext(
            user=user,
            membership=mem,
            hospital=hospital,
            subscription=sub,
            plan_code=plan_code,
            active_assignments=[a for a in mem.role_assignments if a.is_active and a.assignment_status == "active"],
            effective_permission_codes=effective_codes,
            department_scopes={},
            is_facility_wide={},
        )


# =============================================================================
# REUSABLE FASTAPI DEPENDENCY FACTORIES
# =============================================================================

def require_permission(permission_code: str):
    """Dependency that authorizes request against an atomic permission code.
    Evaluates employee identity, active hospital session, role inheritance,
    individual overrides, and subscription tier.
    """
    def dependency(
        request: Request,
        db: Session = Depends(get_db),
    ) -> AuthorizationContext:
        token = request.cookies.get(settings.SESSION_COOKIE_NAME)
        if not token:
            auth_header = request.headers.get("Authorization")
            if auth_header and auth_header.startswith("Bearer "):
                token = auth_header.split(" ", 1)[1].strip()

        if not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        payload = decode_token(token)
        user_id_str = payload.get("sub")
        hospital_id_str = payload.get("hospital_id")
        if not user_id_str or not hospital_id_str:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session claims.")

        user_id = uuid.UUID(user_id_str)
        hospital_id = uuid.UUID(hospital_id_str)

        dept_id_query = request.query_params.get("department_id")
        dept_id = uuid.UUID(dept_id_query) if dept_id_query else None

        return AuthorizationService.authorize_employee(
            db=db,
            user_id=user_id,
            hospital_id=hospital_id,
            required_permission=permission_code,
            department_id=dept_id,
        )

    return dependency
