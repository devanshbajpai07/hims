import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from app.core.exceptions import (
    SubscriptionAccessDeniedError,
    SubscriptionExpiredError,
    SubscriptionInactiveError,
    SubscriptionNotFoundError,
)
from app.core.plans import PlanCode, PlanEntitlements, get_plan_entitlements
from app.models.purchaser_subscription import PurchaserSubscription


class SubscriptionEntitlementService:
    @staticmethod
    def get_purchaser_subscriptions(
        db: Session, purchaser_id: uuid.UUID
    ) -> List[PurchaserSubscription]:
        """Fetch all subscriptions owned by the specified purchaser."""
        return (
            db.query(PurchaserSubscription)
            .filter(PurchaserSubscription.purchaser_id == purchaser_id)
            .order_by(PurchaserSubscription.created_at.asc())
            .all()
        )

    @staticmethod
    def get_subscription_for_purchaser(
        db: Session, purchaser_id: uuid.UUID, subscription_id: uuid.UUID
    ) -> Optional[PurchaserSubscription]:
        """Retrieve a specific subscription verifying purchaser ownership."""
        sub = (
            db.query(PurchaserSubscription)
            .filter(PurchaserSubscription.id == subscription_id)
            .first()
        )
        if not sub:
            return None
        # Tenant isolation check: deny access if owned by another purchaser
        if sub.purchaser_id != purchaser_id:
            return None
        return sub

    @classmethod
    def validate_subscription_access(
        cls, db: Session, purchaser_id: uuid.UUID, subscription_id: uuid.UUID
    ) -> PurchaserSubscription:
        """Validate ownership, active status, and period validity of a subscription.

        Fails with clear domain exceptions if:
        - The subscription does not exist or belongs to another purchaser (404)
        - The subscription status is not active (403)
        - The current billing period has ended (403)
        """
        sub = cls.get_subscription_for_purchaser(db, purchaser_id, subscription_id)
        if not sub:
            raise SubscriptionNotFoundError(
                "Subscription record not found or does not belong to this purchaser account."
            )

        if sub.status.lower() != "active":
            raise SubscriptionInactiveError(
                f"Subscription is not active (current status: '{sub.status}')."
            )

        now = datetime.now(timezone.utc)
        if sub.current_period_ends_at:
            period_end = sub.current_period_ends_at
            if period_end.tzinfo is None:
                period_end = period_end.replace(tzinfo=timezone.utc)
            if now > period_end:
                raise SubscriptionExpiredError(
                    f"Subscription current period ended on {period_end.isoformat()}."
                )

        return sub

    @staticmethod
    def get_canonical_entitlements(plan_code: str) -> PlanEntitlements:
        """Resolve canonical plan entitlements from backend definition.

        Frontend plan overrides are ignored; truth lives strictly in PLAN_CATALOGUE.
        """
        entitlements = get_plan_entitlements(plan_code)
        if not entitlements:
            # Fallback to Basic if unknown plan code
            entitlements = get_plan_entitlements("BASIC")
            if not entitlements:
                raise ValueError(f"Plan code {plan_code} cannot be resolved to entitlements.")
        return entitlements

    @classmethod
    def build_subscription_detail(
        cls, sub: PurchaserSubscription
    ) -> Dict[str, Any]:
        """Combine subscription record with canonical entitlements and status flags."""
        entitlements = cls.get_canonical_entitlements(sub.plan_code)
        now = datetime.now(timezone.utc)
        period_end = sub.current_period_ends_at
        if period_end and period_end.tzinfo is None:
            period_end = period_end.replace(tzinfo=timezone.utc)
        is_expired = bool(period_end and now > period_end)
        is_active = sub.status.lower() == "active" and not is_expired

        return {
            "subscription": sub,
            "entitlements": {
                "plan_code": entitlements.plan_code.value,
                "display_name": entitlements.display_name,
                "max_administrators": entitlements.max_administrators,
                "max_employees": entitlements.max_employees,
                "features": entitlements.features,
                "description": entitlements.description,
            },
            "is_active": is_active,
            "is_expired": is_expired,
        }

    @classmethod
    def has_feature(cls, sub: PurchaserSubscription, feature_key: str) -> bool:
        """Check whether an active subscription includes a specific feature flag."""
        entitlements = cls.get_canonical_entitlements(sub.plan_code)
        return feature_key in entitlements.features

    @classmethod
    def get_admin_seat_limit(cls, sub: PurchaserSubscription) -> int:
        """Return the maximum administrator seats allowed for this subscription."""
        return cls.get_canonical_entitlements(sub.plan_code).max_administrators

    @classmethod
    def get_employee_seat_limit(cls, sub: PurchaserSubscription) -> int:
        """Return the maximum employee accounts allowed for this subscription."""
        return cls.get_canonical_entitlements(sub.plan_code).max_employees

