-- ==============================================================================
-- AURA HIMS — Manual Owner Subscription Provisioning Script
-- ==============================================================================
-- Target Database: Neon PostgreSQL (aura-hims-dev)
-- Table: purchaser_subscriptions
--
-- PURPOSE:
-- MANUAL DEVELOPMENT-ONLY OPERATION for owner multi-tier testing.
-- Transactionally and idempotently provisions exactly one BASIC, one PRO,
-- and one ULTRA subscription for a single verified owner/purchaser account.
--
-- CRITICAL BEHAVIOURAL RULES:
-- 1. Uses explicit purchaser-level row locking (SELECT ... FOR UPDATE) inside
--    a single atomic transaction to prevent concurrent duplicate insertion.
-- 2. Checks whether each tier (BASIC, PRO, ULTRA) already exists for this purchaser.
-- 3. Inserts missing tiers with auto_renew = FALSE.
-- 4. NEVER modifies existing subscription records.
-- 5. NEVER reactivates cancelled or expired subscriptions.
-- 6. NEVER resets existing billing periods.
-- 7. Generates independent UUID primary keys for every subscription.
--
-- INSTRUCTIONS FOR THE OWNER:
-- 1. Register your personal account via the web UI at /account/register
-- 2. Verify your email via /account/verify-email
-- 3. Replace 'YOUR_VERIFIED_EMAIL@DOMAIN.COM' below with your actual verified email.
-- 4. Execute this script in your Neon PostgreSQL SQL editor or psql console.
-- ==============================================================================

BEGIN;

DO $$
DECLARE
    v_target_email TEXT := LOWER(TRIM('YOUR_VERIFIED_EMAIL@DOMAIN.COM'));
    v_purchaser_id UUID;
    v_is_verified BOOLEAN;
    v_account_status TEXT;
    v_full_name TEXT;
    v_has_basic BOOLEAN := FALSE;
    v_has_pro BOOLEAN := FALSE;
    v_has_ultra BOOLEAN := FALSE;
    v_inserted_count INT := 0;
BEGIN
    -- 1. Sanity check: Ensure the placeholder has been replaced
    IF v_target_email = 'your_verified_email@domain.com' THEN
        RAISE EXCEPTION 'Aborted: Please replace YOUR_VERIFIED_EMAIL@DOMAIN.COM with your actual registered email address.';
    END IF;

    -- 2. Validate purchaser existence and acquire purchaser-level row lock (FOR UPDATE)
    SELECT id, is_email_verified, account_status, full_name
    INTO v_purchaser_id, v_is_verified, v_account_status, v_full_name
    FROM purchasers
    WHERE email_normalized = v_target_email
    FOR UPDATE;

    IF v_purchaser_id IS NULL THEN
        RAISE EXCEPTION 'Aborted: No purchaser record found for email % in purchasers table. Please register first at /account/register.', v_target_email;
    END IF;

    IF NOT v_is_verified THEN
        RAISE EXCEPTION 'Aborted: Purchaser % (%) is not yet email-verified. Please verify your email at /account/verify-email before provisioning subscriptions.', v_full_name, v_target_email;
    END IF;

    IF v_account_status <> 'active' THEN
        RAISE EXCEPTION 'Aborted: Purchaser account status is "%" (must be "active").', v_account_status;
    END IF;

    RAISE NOTICE 'Locked verified purchaser record: % (ID: %). Inspecting existing subscriptions...', v_full_name, v_purchaser_id;

    -- 3. Check for existing subscriptions of each tier for this purchaser
    -- (Does not rely on a unique constraint; checks actual database state)
    SELECT EXISTS (
        SELECT 1 FROM purchaser_subscriptions 
        WHERE purchaser_id = v_purchaser_id AND plan_code = 'BASIC'
    ) INTO v_has_basic;

    SELECT EXISTS (
        SELECT 1 FROM purchaser_subscriptions 
        WHERE purchaser_id = v_purchaser_id AND plan_code = 'PRO'
    ) INTO v_has_pro;

    SELECT EXISTS (
        SELECT 1 FROM purchaser_subscriptions 
        WHERE purchaser_id = v_purchaser_id AND plan_code = 'ULTRA'
    ) INTO v_has_ultra;

    -- 4. Provision BASIC Subscription (if not already present)
    IF NOT v_has_basic THEN
        INSERT INTO purchaser_subscriptions (
            id,
            purchaser_id,
            plan_code,
            status,
            billing_interval,
            auto_renew,
            starts_at,
            current_period_starts_at,
            current_period_ends_at,
            cancelled_at,
            created_at,
            updated_at
        ) VALUES (
            gen_random_uuid(),
            v_purchaser_id,
            'BASIC',
            'active',
            'free',
            false, -- Development subscriptions: auto_renew = FALSE
            clock_timestamp(),
            clock_timestamp(),
            clock_timestamp() + INTERVAL '365 days',
            NULL,
            clock_timestamp(),
            clock_timestamp()
        );
        v_inserted_count := v_inserted_count + 1;
        RAISE NOTICE 'Provisioned NEW [BASIC] subscription for % (auto_renew=false, 365 days).', v_full_name;
    ELSE
        RAISE NOTICE 'Skipped [BASIC]: An existing BASIC subscription record is already present for % (left unmodified).', v_full_name;
    END IF;

    -- 5. Provision PRO Subscription (if not already present)
    IF NOT v_has_pro THEN
        INSERT INTO purchaser_subscriptions (
            id,
            purchaser_id,
            plan_code,
            status,
            billing_interval,
            auto_renew,
            starts_at,
            current_period_starts_at,
            current_period_ends_at,
            cancelled_at,
            created_at,
            updated_at
        ) VALUES (
            gen_random_uuid(),
            v_purchaser_id,
            'PRO',
            'active',
            'annual',
            false, -- Development subscriptions: auto_renew = FALSE
            clock_timestamp(),
            clock_timestamp(),
            clock_timestamp() + INTERVAL '365 days',
            NULL,
            clock_timestamp(),
            clock_timestamp()
        );
        v_inserted_count := v_inserted_count + 1;
        RAISE NOTICE 'Provisioned NEW [PRO] subscription for % (auto_renew=false, 365 days).', v_full_name;
    ELSE
        RAISE NOTICE 'Skipped [PRO]: An existing PRO subscription record is already present for % (left unmodified).', v_full_name;
    END IF;

    -- 6. Provision ULTRA Subscription (if not already present)
    IF NOT v_has_ultra THEN
        INSERT INTO purchaser_subscriptions (
            id,
            purchaser_id,
            plan_code,
            status,
            billing_interval,
            auto_renew,
            starts_at,
            current_period_starts_at,
            current_period_ends_at,
            cancelled_at,
            created_at,
            updated_at
        ) VALUES (
            gen_random_uuid(),
            v_purchaser_id,
            'ULTRA',
            'active',
            'annual',
            false, -- Development subscriptions: auto_renew = FALSE
            clock_timestamp(),
            clock_timestamp(),
            clock_timestamp() + INTERVAL '365 days',
            NULL,
            clock_timestamp(),
            clock_timestamp()
        );
        v_inserted_count := v_inserted_count + 1;
        RAISE NOTICE 'Provisioned NEW [ULTRA] subscription for % (auto_renew=false, 365 days).', v_full_name;
    ELSE
        RAISE NOTICE 'Skipped [ULTRA]: An existing ULTRA subscription record is already present for % (left unmodified).', v_full_name;
    END IF;

    RAISE NOTICE 'Summary: % new development subscriptions inserted. Existing records preserved intact.', v_inserted_count;
END $$;

-- 7. Verification Query: Inspect all subscriptions currently present for the purchaser
SELECT 
    p.full_name AS purchaser_name,
    p.email_normalized AS purchaser_email,
    ps.id AS subscription_id,
    ps.plan_code,
    ps.status,
    ps.billing_interval,
    ps.auto_renew,
    ps.starts_at,
    ps.current_period_starts_at,
    ps.current_period_ends_at,
    ps.cancelled_at,
    CASE 
        WHEN ps.plan_code = 'BASIC' THEN '1 Admin Seat, Up to 50 Staff'
        WHEN ps.plan_code = 'PRO' THEN '3 Admin Seats, Up to 500 Staff'
        WHEN ps.plan_code = 'ULTRA' THEN '8 Admin Seats, Up to 10,000 Staff'
    END AS tier_entitlement_summary,
    ps.created_at
FROM purchaser_subscriptions ps
JOIN purchasers p ON ps.purchaser_id = p.id
WHERE p.email_normalized = LOWER(TRIM('YOUR_VERIFIED_EMAIL@DOMAIN.COM'))
ORDER BY 
    CASE ps.plan_code 
        WHEN 'BASIC' THEN 1 
        WHEN 'PRO' THEN 2 
        WHEN 'ULTRA' THEN 3 
    END,
    ps.created_at ASC;

COMMIT;
