"""Canonical Plan Definitions and Entitlements for AURA HIMS.

All plan codes and entitlements live in trusted backend code.
The frontend never dictates plan quotas, seat limits, or feature access.
"""

from dataclasses import dataclass
from enum import Enum
from typing import Dict, List, Optional


class PlanCode(str, Enum):
    BASIC = "BASIC"
    PRO = "PRO"
    ULTRA = "ULTRA"


class SubscriptionStatus(str, Enum):
    ACTIVE = "active"
    PAST_DUE = "past_due"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


class BillingInterval(str, Enum):
    FREE = "free"
    MONTHLY = "monthly"
    ANNUAL = "annual"


@dataclass(frozen=True)
class PlanEntitlements:
    plan_code: PlanCode
    display_name: str
    max_administrators: int
    max_employees: int
    features: List[str]
    description: str


PLAN_CATALOGUE: Dict[PlanCode, PlanEntitlements] = {
    PlanCode.BASIC: PlanEntitlements(
        plan_code=PlanCode.BASIC,
        display_name="Basic",
        max_administrators=1,
        max_employees=50,
        features=[
            "core_emr",
            "standard_appointments",
            "dispensary_management",
            "single_admin",
            "basic_reporting",
        ],
        description="Single-facility medical practices and clinics needing essential digital infrastructure.",
    ),
    PlanCode.PRO: PlanEntitlements(
        plan_code=PlanCode.PRO,
        display_name="Pro",
        max_administrators=3,
        max_employees=500,
        features=[
            "core_emr",
            "standard_appointments",
            "departmental_permissions",
            "multi_station_queues",
            "two_level_approvals",
            "advanced_analytics",
            "priority_support",
        ],
        description="Growing specialty clinics, diagnostic centers, and multi-department medical institutions.",
    ),
    PlanCode.ULTRA: PlanEntitlements(
        plan_code=PlanCode.ULTRA,
        display_name="Ultra",
        max_administrators=8,
        max_employees=10000,
        features=[
            "core_emr",
            "standard_appointments",
            "departmental_permissions",
            "multi_station_queues",
            "two_level_approvals",
            "advanced_analytics",
            "priority_support",
            "custom_clinical_workflows",
            "dedicated_audit_vault",
            "enterprise_sla",
            "dedicated_onboarding",
        ],
        description="Established hospital wings, regional medical groups, and large multi-specialty healthcare networks.",
    ),
}


def get_plan_entitlements(plan_code: str) -> Optional[PlanEntitlements]:
    """Retrieve canonical entitlements for a given plan code (case-insensitive)."""
    try:
        canonical_code = PlanCode(plan_code.upper())
        return PLAN_CATALOGUE.get(canonical_code)
    except (ValueError, KeyError, AttributeError):
        return None

