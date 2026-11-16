from datetime import datetime, timedelta, timezone
import uuid
from typing import List
from fastapi import APIRouter, Depends, status, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.api.v1.endpoints.purchaser_auth import get_current_purchaser
from app.db.database import get_db
from app.models.purchaser import Purchaser
from app.models.purchaser_subscription import PurchaserSubscription
from app.schemas.subscription import (
    SubscriptionDetailResponse,
    SubscriptionListResponse,
)
from app.services.subscription_entitlement_service import (
    SubscriptionEntitlementService,
)

router = APIRouter(prefix="/purchaser/subscriptions", tags=["Purchaser Subscriptions"])


class CreateSubscriptionRequest(BaseModel):
    plan_code: str = Field(..., description="BASIC, PRO, or ULTRA")
    billing_interval: str = Field(default="monthly", description="free, monthly, or annual")


@router.post("", response_model=SubscriptionDetailResponse, status_code=status.HTTP_201_CREATED)
def create_purchaser_subscription(
    payload: CreateSubscriptionRequest,
    current_purchaser: Purchaser = Depends(get_current_purchaser),
    db: Session = Depends(get_db),
):
    """Provisions a new authoritative subscription for the authenticated purchaser in PostgreSQL."""
    plan_code = payload.plan_code.strip().upper()

    # Pro and Ultra/Enterprise plans are strictly Future Scope. Block new purchases!
    if plan_code in ["PRO", "ULTRA", "ENTERPRISE"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Subscription purchases for Pro and Enterprise (Ultra) tiers are temporarily disabled (Future Scope). Only Basic tier subscriptions can be provisioned at this time.",
        )

    if plan_code != "BASIC":
        plan_code = "BASIC"

    interval = payload.billing_interval.strip().lower()
    if interval not in ["free", "monthly", "annual"]:
        interval = "free" if plan_code == "BASIC" else "monthly"

    now = datetime.now(timezone.utc)
    ends_at = now + timedelta(days=365 if interval in ["annual", "free"] else 30)

    sub = PurchaserSubscription(
        id=uuid.uuid4(),
        purchaser_id=current_purchaser.id,
        plan_code=plan_code,
        status="active",
        billing_interval=interval,
        auto_renew=True if interval != "free" else False,
        starts_at=now,
        current_period_starts_at=now,
        current_period_ends_at=ends_at,
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)

    return SubscriptionEntitlementService.build_subscription_detail(sub)


@router.get("", response_model=SubscriptionListResponse, status_code=status.HTTP_200_OK)
def list_purchaser_subscriptions(
    current_purchaser: Purchaser = Depends(get_current_purchaser),
    db: Session = Depends(get_db),
):
    """Retrieve all subscriptions owned by the currently authenticated purchaser.

    Each subscription item includes canonical entitlements resolved from trusted backend code.
    """
    print(f"DEBUG_SUBS: called for purchaser {current_purchaser.id} ({current_purchaser.email})", flush=True)
    subs = SubscriptionEntitlementService.get_purchaser_subscriptions(
        db, current_purchaser.id
    )
    print(f"DEBUG_SUBS: found {len(subs)} subscriptions", flush=True)
    items = [
        SubscriptionEntitlementService.build_subscription_detail(sub)
        for sub in subs
    ]
    return {"subscriptions": items, "total": len(items)}


@router.get(
    "/{subscription_id}",
    response_model=SubscriptionDetailResponse,
    status_code=status.HTTP_200_OK,
)
def get_purchaser_subscription_detail(
    subscription_id: uuid.UUID,
    current_purchaser: Purchaser = Depends(get_current_purchaser),
    db: Session = Depends(get_db),
):
    """Retrieve details and entitlements for a specific subscription.

    Enforces:
    - Purchaser ownership (cannot inspect another purchaser's subscription).
    - Active status enforcement (inactive or expired subscriptions return clear domain errors).
    """
    sub = SubscriptionEntitlementService.validate_subscription_access(
        db, current_purchaser.id, subscription_id
    )
    return SubscriptionEntitlementService.build_subscription_detail(sub)

