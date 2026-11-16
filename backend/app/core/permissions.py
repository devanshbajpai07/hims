"""Master Permission Catalogue, System Role Templates, and Tier Enforcements for AURA HIMS.

Strictly enforces permission-based authorization over role-name matching.
All permissions, system role templates, and tier allowlists are canonically defined here.
"""
from dataclasses import dataclass
from typing import Dict, List, Optional, Set


@dataclass(frozen=True)
class PermissionDefinition:
    code: str
    name: str
    description: str
    category: str  # "clinical", "operational", "workforce", "administrative"
    module: str
    risk_level: str  # "standard", "sensitive", "privileged"
    min_tier: str  # "BASIC", "PRO", "ULTRA"
    is_deferred: bool = False


# Permissions deferred to future scope (non-operational)
DEFERRED_PERMISSIONS: Set[str] = {
    "prescription:dispense",
    "inventory:pharmacy:read",
}


MASTER_PERMISSION_CATALOGUE: Dict[str, PermissionDefinition] = {
    # -------------------------------------------------------------------------
    # CLINICAL PERMISSIONS
    # -------------------------------------------------------------------------
    "patient:read": PermissionDefinition(
        code="patient:read",
        name="View Patient Directory",
        description="Inspect patient registry, demographics, contact details, and clinical status.",
        category="clinical",
        module="patient",
        risk_level="standard",
        min_tier="BASIC",
    ),
    "patient:create": PermissionDefinition(
        code="patient:create",
        name="Register Patient",
        description="Onboard new patients at front desk or clinical intake.",
        category="clinical",
        module="patient",
        risk_level="standard",
        min_tier="BASIC",
    ),
    "patient:update": PermissionDefinition(
        code="patient:update",
        name="Update Patient Demographics",
        description="Modify patient contact information, insurance coverage, and demographic records.",
        category="clinical",
        module="patient",
        risk_level="standard",
        min_tier="BASIC",
    ),
    "patient:archive": PermissionDefinition(
        code="patient:archive",
        name="Archive Patient Profile",
        description="Deactivate or archive inactive patient records in compliance with medical retention guidelines.",
        category="clinical",
        module="patient",
        risk_level="sensitive",
        min_tier="PRO",
    ),
    "emr:read": PermissionDefinition(
        code="emr:read",
        name="Read Electronic Medical Records",
        description="Review historical clinical notes, consultation summaries, allergies, and diagnostic charts.",
        category="clinical",
        module="emr",
        risk_level="sensitive",
        min_tier="BASIC",
    ),
    "emr:write": PermissionDefinition(
        code="emr:write",
        name="Author Clinical Notes",
        description="Document clinical consultations, symptom evaluations, and progress assessments in patient EMR.",
        category="clinical",
        module="emr",
        risk_level="sensitive",
        min_tier="BASIC",
    ),
    "vitals:read": PermissionDefinition(
        code="vitals:read",
        name="View Patient Vitals",
        description="Inspect blood pressure, heart rate, oxygen saturation, temperature, and triage observations.",
        category="clinical",
        module="vitals",
        risk_level="standard",
        min_tier="BASIC",
    ),
    "vitals:write": PermissionDefinition(
        code="vitals:write",
        name="Record Patient Vitals",
        description="Capture bedside vital measurements and triage indicators in patient records.",
        category="clinical",
        module="vitals",
        risk_level="standard",
        min_tier="BASIC",
    ),
    "prescription:read": PermissionDefinition(
        code="prescription:read",
        name="View Prescriptions",
        description="Access active medication orders, dosage regimens, and prescription histories.",
        category="clinical",
        module="prescription",
        risk_level="standard",
        min_tier="BASIC",
    ),
    "prescription:create": PermissionDefinition(
        code="prescription:create",
        name="Authorize Prescription",
        description="Author digital prescriptions, clinical drug orders, and pharmacological instructions.",
        category="clinical",
        module="prescription",
        risk_level="sensitive",
        min_tier="BASIC",
    ),
    "prescription:dispense": PermissionDefinition(
        code="prescription:dispense",
        name="Dispense Medications (Future Scope)",
        description="(Future Scope - Inactive) Planned capability to fulfill authorized prescriptions and record medication issuance from hospital dispensary.",
        category="clinical",
        module="prescription",
        risk_level="standard",
        min_tier="BASIC",
        is_deferred=True,
    ),
    "diagnosis:read": PermissionDefinition(
        code="diagnosis:read",
        name="View Diagnoses",
        description="Review clinical assessments, differential diagnoses, and diagnostic coding.",
        category="clinical",
        module="emr",
        risk_level="standard",
        min_tier="BASIC",
    ),
    "diagnosis:write": PermissionDefinition(
        code="diagnosis:write",
        name="Commit Clinical Diagnoses",
        description="Record definitive and differential diagnoses in patient charts.",
        category="clinical",
        module="emr",
        risk_level="sensitive",
        min_tier="BASIC",
    ),

    # -------------------------------------------------------------------------
    # OPERATIONAL PERMISSIONS
    # -------------------------------------------------------------------------
    "queue:read": PermissionDefinition(
        code="queue:read",
        name="View Clinical Queues",
        description="View real-time waiting lists, triage priority, and doctor consultation stations.",
        category="operational",
        module="queue",
        risk_level="standard",
        min_tier="BASIC",
    ),
    "queue:manage": PermissionDefinition(
        code="queue:manage",
        name="Manage Queue Distribution",
        description="Triage patients, call next patient, reassign consultation queues, and update visit stages.",
        category="operational",
        module="queue",
        risk_level="standard",
        min_tier="BASIC",
    ),
    "appointment:read": PermissionDefinition(
        code="appointment:read",
        name="View Appointment Calendar",
        description="Inspect scheduled patient visits, clinic calendars, and practitioner availability.",
        category="operational",
        module="appointment",
        risk_level="standard",
        min_tier="BASIC",
    ),
    "appointment:create": PermissionDefinition(
        code="appointment:create",
        name="Schedule Appointment",
        description="Book patient consultations with clinical departments and doctors.",
        category="operational",
        module="appointment",
        risk_level="standard",
        min_tier="BASIC",
    ),
    "appointment:manage": PermissionDefinition(
        code="appointment:manage",
        name="Manage Appointment Slots",
        description="Reschedule, cancel, slot-override, and process check-in for appointments.",
        category="operational",
        module="appointment",
        risk_level="standard",
        min_tier="BASIC",
    ),
    "admission:read": PermissionDefinition(
        code="admission:read",
        name="View Inpatient Census",
        description="Monitor ward occupancy, inpatient bed statuses, and patient stay durations.",
        category="operational",
        module="admission",
        risk_level="standard",
        min_tier="BASIC",
    ),
    "admission:manage": PermissionDefinition(
        code="admission:manage",
        name="Process Inpatient Admissions",
        description="Admit patients, allocate inpatient beds, and manage clinical ward transfers.",
        category="operational",
        module="admission",
        risk_level="sensitive",
        min_tier="PRO",
    ),
    "discharge:manage": PermissionDefinition(
        code="discharge:manage",
        name="Process Patient Discharge",
        description="Author medical discharge summaries, verify medication instructions, and release inpatient beds.",
        category="operational",
        module="admission",
        risk_level="sensitive",
        min_tier="PRO",
    ),

    # -------------------------------------------------------------------------
    # WORKFORCE & DEPARTMENTAL PERMISSIONS
    # -------------------------------------------------------------------------
    "employee:read": PermissionDefinition(
        code="employee:read",
        name="View Workforce Roster",
        description="List hospital employees, assigned roles, and departmental placements.",
        category="workforce",
        module="employee",
        risk_level="standard",
        min_tier="BASIC",
    ),
    "employee:invite": PermissionDefinition(
        code="employee:invite",
        name="Invite Hospital Employees",
        description="Dispatch executive email invitations to onboard new hospital workforce members.",
        category="workforce",
        module="employee",
        risk_level="sensitive",
        min_tier="BASIC",
    ),
    "employee:manage": PermissionDefinition(
        code="employee:manage",
        name="Manage Employee Membership",
        description="Suspend, reactivate, or terminate employee hospital memberships.",
        category="workforce",
        module="employee",
        risk_level="privileged",
        min_tier="BASIC",
    ),
    "employee:access:revoke:request": PermissionDefinition(
        code="employee:access:revoke:request",
        name="Request Employee Access Revocation",
        description="Submit departmental employee access revocation requests for administrator review.",
        category="workforce",
        module="employee",
        risk_level="sensitive",
        min_tier="BASIC",
    ),
    "department:read": PermissionDefinition(
        code="department:read",
        name="View Departments",
        description="Inspect hospital clinical departments, service divisions, and head assignments.",
        category="workforce",
        module="department",
        risk_level="standard",
        min_tier="BASIC",
    ),
    "department:manage": PermissionDefinition(
        code="department:manage",
        name="Configure Custom Departments",
        description="Create, edit, and deactivate custom clinical departments and assign department heads.",
        category="workforce",
        module="department",
        risk_level="privileged",
        min_tier="PRO",
    ),
    "role:read": PermissionDefinition(
        code="role:read",
        name="View Hospital Roles",
        description="Review active roles, version configurations, and inherited permission sets.",
        category="workforce",
        module="role",
        risk_level="standard",
        min_tier="BASIC",
    ),
    "role:manage": PermissionDefinition(
        code="role:manage",
        name="Configure Custom Roles",
        description="Create custom hospital roles and author versioned permission sets.",
        category="workforce",
        module="role",
        risk_level="privileged",
        min_tier="PRO",
    ),
    "role:inherit": PermissionDefinition(
        code="role:inherit",
        name="Configure Role Inheritance",
        description="Establish parent-child role inheritance structures with deterministic permission cascades.",
        category="workforce",
        module="role",
        risk_level="privileged",
        min_tier="ULTRA",
    ),
    "scope:facility": PermissionDefinition(
        code="scope:facility",
        name="Grant Facility-Wide Scope",
        description="Authorize workforce assignments that span cross-departmental or hospital-wide facilities.",
        category="workforce",
        module="role",
        risk_level="privileged",
        min_tier="ULTRA",
    ),
    "shift:read": PermissionDefinition(
        code="shift:read",
        name="View Shift Schedules",
        description="Inspect medical shift schedules and doctor on-call rotations.",
        category="workforce",
        module="shift",
        risk_level="standard",
        min_tier="BASIC",
    ),
    "shift:manage": PermissionDefinition(
        code="shift:manage",
        name="Manage Shift Allocations",
        description="Publish staff shift schedules, rotation assignments, and on-call duty allocations.",
        category="workforce",
        module="shift",
        risk_level="standard",
        min_tier="BASIC",
    ),

    # -------------------------------------------------------------------------
    # ADMINISTRATIVE & GOVERNANCE PERMISSIONS
    # -------------------------------------------------------------------------
    "approval:read": PermissionDefinition(
        code="approval:read",
        name="View Approval Queues",
        description="Review pending employee registration applications, role assignments, and privileged requests.",
        category="administrative",
        module="approval",
        risk_level="standard",
        min_tier="BASIC",
    ),
    "approval:manage": PermissionDefinition(
        code="approval:manage",
        name="Process Approval Decisions",
        description="Approve or reject employee onboarding requests and role assignments within authorized scope.",
        category="administrative",
        module="approval",
        risk_level="privileged",
        min_tier="BASIC",
    ),
    "workflow:advanced": PermissionDefinition(
        code="workflow:advanced",
        name="Configure Multi-Stage Workflows",
        description="Design multi-level sequential approval hierarchies with authorized stakeholder routing.",
        category="administrative",
        module="approval",
        risk_level="privileged",
        min_tier="ULTRA",
    ),
    "audit:read": PermissionDefinition(
        code="audit:read",
        name="View HIPAA Audit Trail",
        description="Inspect append-only immutable audit history for hospital operational actions.",
        category="administrative",
        module="audit",
        risk_level="privileged",
        min_tier="BASIC",
    ),
    "audit:export": PermissionDefinition(
        code="audit:export",
        name="Export Immutable Audit Vault",
        description="Generate cryptographically signed compliance exports of institutional audit logs.",
        category="administrative",
        module="audit",
        risk_level="privileged",
        min_tier="PRO",
    ),
    "reports:read": PermissionDefinition(
        code="reports:read",
        name="View Operational Metrics",
        description="Inspect patient throughput, department utilization, and daily census summaries.",
        category="administrative",
        module="reports",
        risk_level="standard",
        min_tier="BASIC",
    ),
    "reports:generate": PermissionDefinition(
        code="reports:generate",
        name="Generate Advanced Analytics",
        description="Produce institutional clinical analytics, bed turnover statistics, and compliance reports.",
        category="administrative",
        module="reports",
        risk_level="sensitive",
        min_tier="PRO",
    ),
    "inventory:read": PermissionDefinition(
        code="inventory:read",
        name="View Dispensary Inventory",
        description="Monitor medication stock levels, pharmaceutical batches, and dispensary supplies.",
        category="administrative",
        module="inventory",
        risk_level="standard",
        min_tier="BASIC",
    ),
    "inventory:manage": PermissionDefinition(
        code="inventory:manage",
        name="Manage Pharmaceutical Stock",
        description="Adjust medication inventory levels, record restock shipments, and mark expired supplies.",
        category="administrative",
        module="inventory",
        risk_level="standard",
        min_tier="BASIC",
    ),
    "subscription:read": PermissionDefinition(
        code="subscription:read",
        name="View Subscription Entitlements",
        description="Inspect active subscription license tier, quotas, and capability ceilings.",
        category="administrative",
        module="subscription",
        risk_level="standard",
        min_tier="BASIC",
    ),
    "hospital:settings:manage": PermissionDefinition(
        code="hospital:settings:manage",
        name="Manage Hospital Profile",
        description="Update official facility name, address, contact numbers, and operational configurations.",
        category="administrative",
        module="hospital",
        risk_level="privileged",
        min_tier="BASIC",
    ),

    # -------------------------------------------------------------------------
    # DOCUMENT & CLINICAL ATTACHMENTS
    # -------------------------------------------------------------------------
    "document:read": PermissionDefinition(
        code="document:read",
        name="View Clinical Documents",
        description="Access and view patient clinical attachments, diagnostic reports, and medical scans.",
        category="clinical",
        module="document",
        risk_level="standard",
        min_tier="BASIC",
    ),
    "document:upload": PermissionDefinition(
        code="document:upload",
        name="Upload Patient Documents",
        description="Upload clinical records, diagnostic images, referral notes, and lab reports.",
        category="clinical",
        module="document",
        risk_level="standard",
        min_tier="BASIC",
    ),
    "document:download": PermissionDefinition(
        code="document:download",
        name="Download Verified Documents",
        description="Generate secure time-limited presigned download links for medical documents.",
        category="clinical",
        module="document",
        risk_level="sensitive",
        min_tier="BASIC",
    ),
    "document:archive": PermissionDefinition(
        code="document:archive",
        name="Archive Documents",
        description="Soft-archive historical documents while maintaining immutable medical audit trails.",
        category="clinical",
        module="document",
        risk_level="sensitive",
        min_tier="BASIC",
    ),
    "document:delete": PermissionDefinition(
        code="document:delete",
        name="Permanently Delete Documents",
        description="Permanently remove erroneous non-clinical uploads under administrative governance.",
        category="administrative",
        module="document",
        risk_level="privileged",
        min_tier="PRO",
    ),

    # -------------------------------------------------------------------------
    # EMPLOYEE ACCOUNT & PROFILE MANAGEMENT
    # -------------------------------------------------------------------------
    "account:profile:read": PermissionDefinition(
        code="account:profile:read",
        name="View Employee Profile",
        description="View personal employee workspace details, active role assignments, and sessions.",
        category="workforce",
        module="account",
        risk_level="standard",
        min_tier="BASIC",
    ),
    "account:profile:update": PermissionDefinition(
        code="account:profile:update",
        name="Update Employee Profile",
        description="Update contact information, emergency phone, and submit profile change requests.",
        category="workforce",
        module="account",
        risk_level="standard",
        min_tier="BASIC",
    ),
    "account:password:change": PermissionDefinition(
        code="account:password:change",
        name="Rotate Account Password",
        description="Self-service cryptographic password rotation enforcing Argon2id and reuse rules.",
        category="workforce",
        module="account",
        risk_level="standard",
        min_tier="BASIC",
    ),
    "account:session:revoke": PermissionDefinition(
        code="account:session:revoke",
        name="Revoke Active Device Sessions",
        description="Terminate active device sessions to secure employee credentials.",
        category="workforce",
        module="account",
        risk_level="standard",
        min_tier="BASIC",
    ),

    # -------------------------------------------------------------------------
    # INTERNAL EMPLOYEE COMMUNICATION & REQUEST MANAGEMENT
    # -------------------------------------------------------------------------
    "communication:read": PermissionDefinition(
        code="communication:read",
        name="View Internal Messages & Requests",
        description="Inspect received and sent internal communications and operational requests.",
        category="workforce",
        module="communication",
        risk_level="standard",
        min_tier="BASIC",
    ),
    "communication:create": PermissionDefinition(
        code="communication:create",
        name="Send Internal Requests",
        description="Dispatch internal requests and communications to eligible employees.",
        category="workforce",
        module="communication",
        risk_level="standard",
        min_tier="BASIC",
    ),
    "communication:respond": PermissionDefinition(
        code="communication:respond",
        name="Respond to Internal Requests",
        description="Acknowledge and submit responses to received employee requests.",
        category="workforce",
        module="communication",
        risk_level="standard",
        min_tier="BASIC",
    ),
    "communication:complete": PermissionDefinition(
        code="communication:complete",
        name="Complete Actionable Requests",
        description="Mark assigned internal employee requests as completed.",
        category="workforce",
        module="communication",
        risk_level="standard",
        min_tier="BASIC",
    ),
}


# =============================================================================
# SYSTEM ROLE TEMPLATES
# =============================================================================

SYSTEM_ROLE_PERMISSIONS: Dict[str, List[str]] = {
    # 1. Hospital Administrator: Complete governance of their facility
    "admin": [
        "patient:read",
        "patient:create",
        "patient:update",
        "patient:archive",
        "emr:read",
        "vitals:read",
        "prescription:read",
        "diagnosis:read",
        "queue:read",
        "queue:manage",
        "appointment:read",
        "appointment:create",
        "appointment:manage",
        "admission:read",
        "admission:manage",
        "discharge:manage",
        "employee:read",
        "employee:invite",
        "employee:manage",
        "department:read",
        "department:manage",
        "role:read",
        "role:manage",
        "role:inherit",
        "scope:facility",
        "shift:read",
        "shift:manage",
        "approval:read",
        "approval:manage",
        "workflow:advanced",
        "audit:read",
        "audit:export",
        "reports:read",
        "reports:generate",
        "inventory:read",
        "inventory:manage",
        "subscription:read",
        "hospital:settings:manage",
        "document:read",
        "document:upload",
        "document:download",
        "document:archive",
        "document:delete",
        "account:profile:read",
        "account:profile:update",
        "account:password:change",
        "account:session:revoke",
        "communication:read",
        "communication:create",
        "communication:respond",
        "communication:complete",
    ],
    # 2. Doctor / Clinician
    "doctor": [
        "patient:read",
        "patient:create",
        "patient:update",
        "emr:read",
        "emr:write",
        "vitals:read",
        "vitals:write",
        "prescription:read",
        "prescription:create",
        "diagnosis:read",
        "diagnosis:write",
        "queue:read",
        "queue:manage",
        "appointment:read",
        "admission:read",
        "department:read",
        "shift:read",
        "document:read",
        "document:upload",
        "document:download",
        "document:archive",
        "account:profile:read",
        "account:profile:update",
        "account:password:change",
        "account:session:revoke",
        "communication:read",
        "communication:create",
    ],
    # 3. Department Head: Clinical leadership + Level-1 approval
    "dept_head": [
        "patient:read",
        "emr:read",
        "vitals:read",
        "diagnosis:read",
        "queue:read",
        "appointment:read",
        "admission:read",
        "employee:read",
        "department:read",
        "role:read",
        "shift:read",
        "shift:manage",
        "approval:read",
        "approval:manage",
        "reports:read",
        "document:read",
        "document:download",
        "account:profile:read",
        "account:profile:update",
        "account:password:change",
        "employee:access:revoke:request",
        "communication:read",
        "communication:create",
        "communication:respond",
        "communication:complete",
    ],
    # 4. Registered Nurse
    "nurse": [
        "patient:read",
        "patient:create",
        "vitals:read",
        "vitals:write",
        "emr:read",
        "prescription:read",
        "queue:read",
        "queue:manage",
        "appointment:read",
        "admission:read",
        "department:read",
        "shift:read",
        "document:read",
        "document:upload",
        "document:download",
        "account:profile:read",
        "account:profile:update",
        "account:password:change",
        "account:session:revoke",
        "communication:read",
        "communication:create",
    ],
    # 5. Pharmacist / Dispensary Officer (Future Scope — Inactive Operational Permissions)
    "pharmacist": [
        "account:profile:read",
        "account:password:change",
    ],
    # 6. Medical Receptionist (Exact 13 Canonical Default Permissions)
    "receptionist": [
        "patient:read",
        "patient:create",
        "patient:update",
        "queue:read",
        "queue:manage",
        "appointment:read",
        "appointment:create",
        "appointment:manage",
        "department:read",
        "shift:read",
        "account:profile:read",
        "account:profile:update",
        "account:password:change",
    ],
    # 7. General Staff (Dedicated Internal Request & Task Workspace)
    "staff": [
        "communication:read",
        "communication:create",
        "communication:respond",
        "communication:complete",
        "account:profile:read",
        "account:password:change",
    ],
    # 8. Nursing Services Supervisor (Hospital-wide scope)
    "nursing_supervisor": [
        "patient:read",
        "vitals:read",
        "employee:read",
        "department:read",
        "role:read",
        "shift:read",
        "shift:manage",
        "reports:read",
        "admission:read",
        "account:profile:read",
        "account:profile:update",
        "account:password:change",
        "employee:access:revoke:request",
        "communication:read",
        "communication:create",
        "communication:respond",
        "communication:complete",
    ],
}


# =============================================================================
# TIER PERMISSION RESTRICTIONS & ALLOWLISTS
# =============================================================================

TIER_ORDER = {"BASIC": 1, "PRO": 2, "ULTRA": 3}


def is_permission_allowed_in_tier(permission_code: str, plan_code: str) -> bool:
    """Evaluates whether a permission code is accessible under a given subscription tier.
    Enforced on the backend; frontend plan override attempts are rejected.
    """
    perm_def = MASTER_PERMISSION_CATALOGUE.get(permission_code)
    if not perm_def:
        return False

    current_tier_rank = TIER_ORDER.get(plan_code.upper(), 1)
    min_required_rank = TIER_ORDER.get(perm_def.min_tier.upper(), 1)
    return current_tier_rank >= min_required_rank


def get_tier_allowed_permissions(plan_code: str) -> Set[str]:
    """Returns the complete set of permission codes available to a specific tier."""
    current_tier_rank = TIER_ORDER.get(plan_code.upper(), 1)
    return {
        code
        for code, defn in MASTER_PERMISSION_CATALOGUE.items()
        if current_tier_rank >= TIER_ORDER.get(defn.min_tier.upper(), 1)
    }

