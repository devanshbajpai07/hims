import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class PlanEntitlementsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    plan_code: str
    display_name: str
    max_administrators: int
    max_employees: int
    features: List[str]
    description: str


class SubscriptionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    purchaser_id: uuid.UUID
    plan_code: str
    status: str
    billing_interval: str
    auto_renew: bool
    starts_at: datetime
    current_period_starts_at: datetime
    current_period_ends_at: datetime
    cancelled_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class SubscriptionDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    subscription: SubscriptionResponse
    entitlements: PlanEntitlementsResponse
    is_active: bool
    is_expired: bool


class SubscriptionListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    subscriptions: List[SubscriptionDetailResponse]
    total: int

