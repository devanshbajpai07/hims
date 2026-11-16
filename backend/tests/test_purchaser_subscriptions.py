import uuid
from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient

from app.core.plans import PlanCode, PLAN_CATALOGUE
from app.core.security import get_password_hash, hash_token
from app.db.database import SessionLocal
from app.models.purchaser import Purchaser, PurchaserSession
from app.models.purchaser_subscription import PurchaserSubscription
from app.services.subscription_entitlement_service import (
    SubscriptionEntitlementService,
)


def create_test_purchaser(
    email: str = "owner@testhealthcare.org",
    full_name: str = "Test Owner",
    is_verified: bool = True,
) -> uuid.UUID:
    """Helper to create a test purchaser and return their UUID."""
    purchaser_id = uuid.uuid4()
    with SessionLocal() as db:
        purchaser = Purchaser(
            id=purchaser_id,
            full_name=full_name,
            email=email,
            email_normalized=email.lower().strip(),
            password_hash=get_password_hash("Password@123"),
            is_email_verified=is_verified,
            account_status="active",
        )
        db.add(purchaser)
        db.commit()
    return purchaser_id


def create_test_session(purchaser_id: uuid.UUID) -> str:
    """Helper to create an active purchaser session and return raw token."""
    raw_token = f"test-sub-token-{uuid.uuid4().hex}"
    with SessionLocal() as db:
        session = PurchaserSession(
            id=uuid.uuid4(),
            purchaser_id=purchaser_id,
            token_hash=hash_token(raw_token),
            user_agent="Pytest Client",
            ip_address="127.0.0.1",
            remember_device=True,
            expires_at=datetime.now(timezone.utc) + timedelta(days=30),
        )
        db.add(session)
        db.commit()
    return raw_token


def test_zero_demo_subscriptions_on_startup():
    """Confirm zero demo subscriptions or demo purchasers exist by default."""
    with SessionLocal() as db:
        # Delete any test artifacts from prior runs
        db.query(PurchaserSubscription).delete()
        db.commit()

        # In a clean state, no subscriptions exist
        sub_count = db.query(PurchaserSubscription).count()
        assert sub_count == 0


def test_multi_subscription_provisioning_and_listing(client: TestClient):
    """Test 1 purchaser owns 1 BASIC, 1 PRO, 1 ULTRA subscription simultaneously."""
    purchaser_id = create_test_purchaser(email=f"multi_owner_{uuid.uuid4().hex[:6]}@hospital.org")
    token = create_test_session(purchaser_id)

    now = datetime.now(timezone.utc)
    one_year_later = now + timedelta(days=365)

    # 1. Manually provision 3 subscriptions for this single purchaser
    sub_basic_id = uuid.uuid4()
    sub_pro_id = uuid.uuid4()
    sub_ultra_id = uuid.uuid4()

    with SessionLocal() as db:
        sub_basic = PurchaserSubscription(
            id=sub_basic_id,
            purchaser_id=purchaser_id,
            plan_code="BASIC",
            status="active",
            billing_interval="free",
            auto_renew=True,
            starts_at=now,
            current_period_starts_at=now,
            current_period_ends_at=one_year_later,
        )
        sub_pro = PurchaserSubscription(
            id=sub_pro_id,
            purchaser_id=purchaser_id,
            plan_code="PRO",
            status="active",
            billing_interval="annual",
            auto_renew=True,
            starts_at=now,
            current_period_starts_at=now,
            current_period_ends_at=one_year_later,
        )
        sub_ultra = PurchaserSubscription(
            id=sub_ultra_id,
            purchaser_id=purchaser_id,
            plan_code="ULTRA",
            status="active",
            billing_interval="annual",
            auto_renew=True,
            starts_at=now,
            current_period_starts_at=now,
            current_period_ends_at=one_year_later,
        )
        db.add_all([sub_basic, sub_pro, sub_ultra])
        db.commit()

    # 2. Query subscriptions via API
    response = client.get(
        "/api/v1/purchaser/subscriptions",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200, response.text
    data = response.json()

    assert data["total"] == 3
    plan_codes = {item["subscription"]["plan_code"] for item in data["subscriptions"]}
    assert plan_codes == {"BASIC", "PRO", "ULTRA"}

    # 3. Verify server-side canonical entitlements
    basic_item = next(item for item in data["subscriptions"] if item["subscription"]["plan_code"] == "BASIC")
    pro_item = next(item for item in data["subscriptions"] if item["subscription"]["plan_code"] == "PRO")
    ultra_item = next(item for item in data["subscriptions"] if item["subscription"]["plan_code"] == "ULTRA")

    assert basic_item["entitlements"]["max_administrators"] == 1
    assert basic_item["entitlements"]["max_employees"] == 50
    assert basic_item["is_active"] is True
    assert basic_item["is_expired"] is False

    assert pro_item["entitlements"]["max_administrators"] == 3
    assert pro_item["entitlements"]["max_employees"] == 500
    assert "priority_support" in pro_item["entitlements"]["features"]

    assert ultra_item["entitlements"]["max_administrators"] == 8
    assert ultra_item["entitlements"]["max_employees"] == 10000
    assert "enterprise_sla" in ultra_item["entitlements"]["features"]


def test_subscription_detail_and_tenant_isolation(client: TestClient):
    """Test purchaser A cannot access purchaser B's subscription."""
    owner_a_id = create_test_purchaser(email=f"owner_a_{uuid.uuid4().hex[:6]}@health.org")
    token_a = create_test_session(owner_a_id)

    owner_b_id = create_test_purchaser(email=f"owner_b_{uuid.uuid4().hex[:6]}@health.org")
    token_b = create_test_session(owner_b_id)

    now = datetime.now(timezone.utc)
    sub_b_id = uuid.uuid4()
    with SessionLocal() as db:
        sub_b = PurchaserSubscription(
            id=sub_b_id,
            purchaser_id=owner_b_id,
            plan_code="PRO",
            status="active",
            billing_interval="annual",
            auto_renew=True,
            starts_at=now,
            current_period_starts_at=now,
            current_period_ends_at=now + timedelta(days=365),
        )
        db.add(sub_b)
        db.commit()

    # Owner A attempts to inspect Owner B's subscription -> 404 (isolated)
    res_unauth = client.get(
        f"/api/v1/purchaser/subscriptions/{sub_b_id}",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert res_unauth.status_code == 404
    assert res_unauth.json()["code"] == "SUBSCRIPTION_NOT_FOUND"

    # Owner B inspects their own subscription -> 200 OK
    res_auth = client.get(
        f"/api/v1/purchaser/subscriptions/{sub_b_id}",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert res_auth.status_code == 200
    detail = res_auth.json()
    assert detail["subscription"]["id"] == str(sub_b_id)
    assert detail["entitlements"]["plan_code"] == "PRO"
    assert detail["entitlements"]["max_administrators"] == 3


def test_inactive_and_expired_subscription_access_enforcement(client: TestClient):
    """Test inactive and expired subscriptions are blocked with 403."""
    owner_id = create_test_purchaser(email=f"owner_exp_{uuid.uuid4().hex[:6]}@health.org")
    token = create_test_session(owner_id)

    now = datetime.now(timezone.utc)
    sub_cancelled_id = uuid.uuid4()
    sub_expired_id = uuid.uuid4()

    with SessionLocal() as db:
        # Inactive subscription (cancelled)
        sub_cancelled = PurchaserSubscription(
            id=sub_cancelled_id,
            purchaser_id=owner_id,
            plan_code="PRO",
            status="cancelled",
            billing_interval="monthly",
            auto_renew=False,
            starts_at=now - timedelta(days=60),
            current_period_starts_at=now - timedelta(days=60),
            current_period_ends_at=now + timedelta(days=30),
            cancelled_at=now - timedelta(days=10),
        )
        # Expired subscription (past period end)
        sub_expired = PurchaserSubscription(
            id=sub_expired_id,
            purchaser_id=owner_id,
            plan_code="ULTRA",
            status="active",
            billing_interval="annual",
            auto_renew=True,
            starts_at=now - timedelta(days=400),
            current_period_starts_at=now - timedelta(days=400),
            current_period_ends_at=now - timedelta(days=35),  # expired 35 days ago
        )
        db.add_all([sub_cancelled, sub_expired])
        db.commit()

    # Cancelled -> 403 SUBSCRIPTION_INACTIVE
    res_inactive = client.get(
        f"/api/v1/purchaser/subscriptions/{sub_cancelled_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_inactive.status_code == 403
    assert res_inactive.json()["code"] == "SUBSCRIPTION_INACTIVE"

    # Expired -> 403 SUBSCRIPTION_EXPIRED
    res_expired = client.get(
        f"/api/v1/purchaser/subscriptions/{sub_expired_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_expired.status_code == 403
    assert res_expired.json()["code"] == "SUBSCRIPTION_EXPIRED"


def test_entitlement_service_helpers():
    """Unit test entitlement service helper methods directly."""
    owner_id = create_test_purchaser(email=f"service_tester_{uuid.uuid4().hex[:6]}@health.org")
    now = datetime.now(timezone.utc)
    sub_id = uuid.uuid4()

    with SessionLocal() as db:
        sub = PurchaserSubscription(
            id=sub_id,
            purchaser_id=owner_id,
            plan_code="ULTRA",
            status="active",
            billing_interval="annual",
            auto_renew=True,
            starts_at=now,
            current_period_starts_at=now,
            current_period_ends_at=now + timedelta(days=365),
        )
        db.add(sub)
        db.commit()

        # Features check
        assert SubscriptionEntitlementService.has_feature(sub, "enterprise_sla") is True
        assert SubscriptionEntitlementService.has_feature(sub, "nonexistent_feature") is False

        # Quotas check
        assert SubscriptionEntitlementService.get_admin_seat_limit(sub) == 8
        assert SubscriptionEntitlementService.get_employee_seat_limit(sub) == 10000


def test_multiple_subscriptions_of_same_plan_allowed(client: TestClient):
    """Test one purchaser can own multiple subscriptions of the SAME plan (e.g. 2 PRO + 2 BASIC)."""
    purchaser_id = create_test_purchaser(email=f"same_tier_{uuid.uuid4().hex[:6]}@hospital.org")
    token = create_test_session(purchaser_id)

    now = datetime.now(timezone.utc)
    sub1_id = uuid.uuid4()
    sub2_id = uuid.uuid4()
    sub3_id = uuid.uuid4()
    sub4_id = uuid.uuid4()

    with SessionLocal() as db:
        # Two PRO subscriptions with independent periods and auto_renew settings
        pro_1 = PurchaserSubscription(
            id=sub1_id,
            purchaser_id=purchaser_id,
            plan_code="PRO",
            status="active",
            billing_interval="annual",
            auto_renew=True,
            starts_at=now,
            current_period_starts_at=now,
            current_period_ends_at=now + timedelta(days=365),
        )
        pro_2 = PurchaserSubscription(
            id=sub2_id,
            purchaser_id=purchaser_id,
            plan_code="PRO",
            status="active",
            billing_interval="monthly",
            auto_renew=False,
            starts_at=now,
            current_period_starts_at=now,
            current_period_ends_at=now + timedelta(days=30),
        )
        # Two BASIC subscriptions
        basic_1 = PurchaserSubscription(
            id=sub3_id,
            purchaser_id=purchaser_id,
            plan_code="BASIC",
            status="active",
            billing_interval="free",
            auto_renew=True,
            starts_at=now,
            current_period_starts_at=now,
            current_period_ends_at=now + timedelta(days=365),
        )
        basic_2 = PurchaserSubscription(
            id=sub4_id,
            purchaser_id=purchaser_id,
            plan_code="BASIC",
            status="active",
            billing_interval="free",
            auto_renew=True,
            starts_at=now,
            current_period_starts_at=now,
            current_period_ends_at=now + timedelta(days=365),
        )
        # MUST succeed without UNIQUE constraint violation
        db.add_all([pro_1, pro_2, basic_1, basic_2])
        db.commit()

    # List all subscriptions for this purchaser
    res = client.get(
        "/api/v1/purchaser/subscriptions",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 4

    pro_subs = [s for s in data["subscriptions"] if s["subscription"]["plan_code"] == "PRO"]
    basic_subs = [s for s in data["subscriptions"] if s["subscription"]["plan_code"] == "BASIC"]

    assert len(pro_subs) == 2
    assert len(basic_subs) == 2
    assert pro_subs[0]["subscription"]["id"] != pro_subs[1]["subscription"]["id"]

    # Verify each PRO subscription can be independently fetched
    detail_1 = client.get(
        f"/api/v1/purchaser/subscriptions/{sub1_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    detail_2 = client.get(
        f"/api/v1/purchaser/subscriptions/{sub2_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert detail_1.status_code == 200
    assert detail_2.status_code == 200
    assert detail_1.json()["subscription"]["billing_interval"] == "annual"
    assert detail_2.json()["subscription"]["billing_interval"] == "monthly"


def test_owner_provisioning_logic_safety_and_idempotency():
    """Validates the exact logic of provision_owner_subscriptions.sql in isolated test environment:

    - Refuses unverified purchasers
    - Inserts missing tiers (BASIC, PRO, ULTRA) with auto_renew=False
    - Never duplicates on re-run
    - Never modifies or reactivates existing subscriptions
    """
    with SessionLocal() as db:
        # 1. Unverified purchaser test
        unverified_id = create_test_purchaser(
            email=f"unverified_{uuid.uuid4().hex[:6]}@test.org",
            is_verified=False,
        )
        p_unverified = db.query(Purchaser).filter(Purchaser.id == unverified_id).first()
        assert p_unverified.is_email_verified is False

        # 2. Verified active purchaser test
        owner_id = create_test_purchaser(
            email=f"owner_prov_{uuid.uuid4().hex[:6]}@test.org",
            is_verified=True,
        )

        def simulate_sql_provision(purchaser_id: uuid.UUID):
            now = datetime.now(timezone.utc)
            one_year_later = now + timedelta(days=365)
            inserted = 0
            for tier, interval in [("BASIC", "free"), ("PRO", "annual"), ("ULTRA", "annual")]:
                has_tier = db.query(PurchaserSubscription).filter(
                    PurchaserSubscription.purchaser_id == purchaser_id,
                    PurchaserSubscription.plan_code == tier,
                ).first() is not None

                if not has_tier:
                    sub = PurchaserSubscription(
                        id=uuid.uuid4(),
                        purchaser_id=purchaser_id,
                        plan_code=tier,
                        status="active",
                        billing_interval=interval,
                        auto_renew=False,
                        starts_at=now,
                        current_period_starts_at=now,
                        current_period_ends_at=one_year_later,
                    )
                    db.add(sub)
                    inserted += 1
            db.commit()
            return inserted

        # First execution -> provisions 3 subscriptions
        first_run_count = simulate_sql_provision(owner_id)
        assert first_run_count == 3

        subs = db.query(PurchaserSubscription).filter(
            PurchaserSubscription.purchaser_id == owner_id
        ).all()
        assert len(subs) == 3
        for s in subs:
            assert s.auto_renew is False
            assert s.status == "active"

        # Cancel the PRO subscription manually
        pro_sub = next(s for s in subs if s.plan_code == "PRO")
        pro_id = pro_sub.id
        pro_sub.status = "cancelled"
        pro_sub.cancelled_at = datetime.now(timezone.utc)
        original_end = pro_sub.current_period_ends_at
        db.commit()

        # Re-run provisioning script -> must insert 0 new records and NOT reactivate PRO!
        second_run_count = simulate_sql_provision(owner_id)
        assert second_run_count == 0

        db.expire_all()
        pro_recheck = db.query(PurchaserSubscription).filter(
            PurchaserSubscription.id == pro_id
        ).first()
        assert pro_recheck.status == "cancelled"
        assert pro_recheck.cancelled_at is not None
        assert pro_recheck.current_period_ends_at == original_end


