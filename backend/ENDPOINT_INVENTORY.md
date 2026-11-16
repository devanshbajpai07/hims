# AURA HIMS Central API Endpoint & Permission Inventory

This document provides the authoritative, exhaustive endpoint inventory for the AURA Hospital Information Management System (HIMS) backend.
Every route is classified by HTTP Method, Path, Authentication mechanism, Atomic Permission Required, Subscription Tier Restriction, and Operational Security Notes.

---

## 1. Summary of System Roles & Atomic Permissions

Permissions are canonical strings defined in `app/core/permissions.py` (43 atomic permissions across clinical, operational, workforce, and administrative domains).
Role-based access control enforces least-privilege scoping across 3 subscription tiers:
- **BASIC**: Standard single-facility clinic / community hospital operations. Predefined departments and roles only.
- **PRO**: Multi-department clinical operations, custom departments, custom roles, immutable role versioning, advanced audit export, shift management, inpatient admissions/discharge.
- **ULTRA**: Advanced multi-stage workflows, parent-child role inheritance, facility-wide cross-department scoping.

---

## 2. Exhaustive Endpoint Table

| Method | Path | Auth | Permission Required | Tier Restriction | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Admin Platform (`admin_dashboard.py`)** | | | | | |
| `GET` | `/api/v1/admin/dashboard/overview` | `AdminContext` (`get_current_admin`) | `audit:read` / Admin Context | All Tiers | Returns honest workforce metrics, quota usage, alert counts, and hospital metadata. |
| `GET` | `/api/v1/admin/employees` | `AdminContext` (`get_current_admin`) | `employee:read` | All Tiers | Lists active and suspended hospital workforce members tenant-scoped to facility. |
| `POST` | `/api/v1/admin/employees/invite` | `AdminContext` (`get_current_admin`) | `employee:manage` | All Tiers | Administrator-initiated workforce invite with atomic subscription quota enforcement and single-use token. |
| `POST` | `/api/v1/admin/employees/{membership_id}/status` | `AdminContext` (`get_current_admin`) | `employee:manage` | All Tiers | Suspend, reactivate, or terminate employee hospital membership; suspension invalidates active sessions immediately. |
| `POST` | `/api/v1/admin/employees/{membership_id}/roles` | `AdminContext` (`get_current_admin`) | `employee:manage` | All Tiers | Assign or update department roles for an employee. BASIC tier restricted to predefined roles. |
| `GET` | `/api/v1/admin/departments` | `AdminContext` (`get_current_admin`) | `department:read` | All Tiers | Lists hospital clinical departments and assigned employee counts. |
| `POST` | `/api/v1/admin/departments` | `AdminContext` (`get_current_admin`) | `department:manage` | **PRO, ULTRA** | Creates custom department. Blocked under BASIC tier (predefined clinical departments only). |
| `GET` | `/api/v1/admin/roles` | `AdminContext` (`get_current_admin`) | `role:read` | All Tiers | Lists hospital clinical/administrative roles with assigned employee counts. |
| `POST` | `/api/v1/admin/roles` | `AdminContext` (`get_current_admin`) | `role:manage` | **PRO, ULTRA** | Creates custom role. Blocked under BASIC tier (predefined system roles only). |
| `GET` | `/api/v1/admin/audit` | `AdminContext` (`get_current_admin`) | `audit:read` | All Tiers | Immutable append-only audit trail filtered by action, limit, offset. |
| `GET` | `/api/v1/admin/notifications` | `AdminContext` (`get_current_admin`) | Admin Session | All Tiers | Operational alerts, security notifications, quota warnings for active hospital. |
| `POST` | `/api/v1/admin/notifications/{notification_id}/read` | `AdminContext` (`get_current_admin`) | Admin Session | All Tiers | Marks notification as read for active administrator. |
| `GET` | `/api/v1/admin/permissions` | `AdminContext` (`get_current_admin`) | `role:read` | All Tiers | Full 43-permission catalogue with tier-eligibility flags for active hospital plan. |
| `GET` | `/api/v1/admin/roles/{role_id}/versions` | `AdminContext` (`get_current_admin`) | `role:read` | All Tiers | Version history and permission definitions for specific role. |
| `POST` | `/api/v1/admin/roles/{role_id}/versions` | `AdminContext` (`get_current_admin`) | `role:manage` | **PRO, ULTRA** | Creates and activates new role version. Dynamic derivation across employees; cycle prevention. |
| `GET` | `/api/v1/admin/employees/{membership_id}/assignments` | `AdminContext` (`get_current_admin`) | `employee:read` | All Tiers | Lists multi-department role assignments for employee. |
| `POST` | `/api/v1/admin/employees/{membership_id}/assignments` | `AdminContext` (`get_current_admin`) | `employee:manage` | All Tiers | Assigns department role slot with scope tracking (`DEPARTMENT` / `FACILITY`). |
| `DELETE` | `/api/v1/admin/employees/{membership_id}/assignments/{assignment_id}` | `AdminContext` (`get_current_admin`) | `employee:manage` | All Tiers | Revokes active role assignment for employee. |
| `GET` | `/api/v1/admin/employees/{membership_id}/overrides` | `AdminContext` (`get_current_admin`) | `employee:read` | All Tiers | Lists active `GRANT` / `DENY` permission overrides for employee. |
| `POST` | `/api/v1/admin/employees/{membership_id}/overrides` | `AdminContext` (`get_current_admin`) | `employee:manage` | All Tiers | Creates explicit override. `DENY` strictly overrides role grants; `GRANT` bounded by tier. |
| `DELETE` | `/api/v1/admin/employees/{membership_id}/overrides/{override_id}` | `AdminContext` (`get_current_admin`) | `employee:manage` | All Tiers | Revokes explicit employee permission override. |
| `GET` | `/api/v1/admin/employees/{membership_id}/effective-permissions` | `AdminContext` (`get_current_admin`) | `employee:read` | All Tiers | Authoritative 11-step inspector returning status, source role/override, scope, and rationale for all 43 permissions. |
| `GET` | `/api/v1/admin/approvals` | `AdminContext` (`get_current_admin`) | `approval:read` | All Tiers | Pending registration requests and requested role slots awaiting decision. |
| `POST` | `/api/v1/admin/approvals/{request_id}/decide` | `AdminContext` (`get_current_admin`) | `approval:manage` | All Tiers | Level-2 final administrative decision; atomically provisions membership, user, and role assignments. |
| **Approvals Workflow (`approvals.py`)** | | | | | |
| `POST` | `/api/v1/approvals/department-head` | `AdminContext` (`get_current_admin`) | `approval:manage` | All Tiers | Level-1 clinical approval: Department Head reviews requested role slot for authorized department. |
| `POST` | `/api/v1/approvals/admin-final` | `AdminContext` (`get_current_admin`) | `approval:manage` | All Tiers | Level-2 administrative approval: Verifies employee UID claim and makes final role slot decisions. |
| **Employee Authentication (`auth.py`)** | | | | | |
| `POST` | `/api/v1/auth/login` | Public (Credentials) | None | All Tiers | Username/password sign-in. Argon2id verification, session generation, workspace check. |
| `POST` | `/api/v1/auth/select-workspace` | Public / Pre-auth | None | All tiers | Facility workspace picker for employees with memberships across multiple hospitals. |
| `POST` | `/api/v1/auth/logout` | Session Cookie | None | All Tiers | Invalidates session record and clears HttpOnly session cookie. |
| `POST` | `/api/v1/auth/forgot-password` | Public | None | All Tiers | Enumeration-resistant password reset request. |
| `POST` | `/api/v1/auth/reset-password` | Public (Reset Token) | None | All Tiers | Consumes single-use reset token and verifies non-identical new password. |
| **Hospital Administrator Authentication (`admin_auth.py`)** | | | | | |
| `GET` | `/api/v1/admin/invitations/verify-token` | Public (Token Query) | None | All Tiers | Landing page validation of administrator invitation token (checks expiry and hash). |
| `POST` | `/api/v1/admin/invitations/accept` | Public (Token Payload) | None | All Tiers | Accepts admin invitation atomically: creates user identity, assigns admin role & membership. |
| `POST` | `/api/v1/admin/auth/login` | Public (Credentials) | None | All Tiers | Dedicated administrator login with subscription status and billing validity checks. |
| `POST` | `/api/v1/admin/auth/logout` | Session Cookie / Bearer | None | All Tiers | Inactivates admin session record and clears secure cookie. |
| `GET` | `/api/v1/admin/auth/me` | `AdminContext` (`get_current_admin`) | Admin Session | All Tiers | Authenticated admin profile, hospital facility context, plan entitlements, seat quotas. |
| `POST` | `/api/v1/admin/auth/forgot-password` | Public | None | All Tiers | Safe enumeration-resistant administrator password reset request. |
| `POST` | `/api/v1/admin/auth/reset-password` | Public (Reset Token) | None | All Tiers | Consumes single-use reset token and updates admin password. |
| **Purchaser Authentication (`purchaser_auth.py`)** | | | | | |
| `POST` | `/api/v1/purchaser/auth/register` | Public | None | All Tiers | Registers institutional purchaser account and dispatches 6-digit cryptographic email OTP. |
| `POST` | `/api/v1/purchaser/auth/verify-email` | Public (OTP Payload) | None | All Tiers | Verifies single-use OTP and establishes authenticated purchaser session with CSRF cookie. |
| `POST` | `/api/v1/purchaser/auth/resend-otp` | Public | None | All Tiers | Re-issues 6-digit OTP code subject to 60-second cooldown rate-limiting. |
| `POST` | `/api/v1/purchaser/auth/login` | Public (Credentials) | None | All Tiers | Purchaser email/password authentication with remember-device session duration. |
| `POST` | `/api/v1/purchaser/auth/logout` | `Purchaser` + CSRF Token | None | All Tiers | Revokes active purchaser session with double-submit CSRF verification. |
| `GET` | `/api/v1/purchaser/auth/me` | `Purchaser` (`get_current_purchaser`) | None | All Tiers | Retrieves authenticated institutional purchaser profile and account status. |
| `GET` | `/api/v1/purchaser/auth/sessions` | `Purchaser` (`get_current_purchaser`) | None | All Tiers | Lists active purchaser device sessions with IP addresses and user agents. |
| `DELETE` | `/api/v1/purchaser/auth/sessions/{session_id}` | `Purchaser` (`get_current_purchaser`) | None | All Tiers | Explicitly revokes a specific concurrent session. |
| `POST` | `/api/v1/purchaser/auth/change-password` | `Purchaser` (`get_current_purchaser`) | None | All Tiers | Changes purchaser password and revokes all other concurrent active sessions. |
| `POST` | `/api/v1/purchaser/auth/forgot-password` | Public | None | All Tiers | Dispatches password reset link (enumeration-resistant response). |
| `POST` | `/api/v1/purchaser/auth/reset-password` | Public (Reset Token) | None | All Tiers | Consumes single-use reset token and updates password. |
| `POST` | `/api/v1/purchaser/auth/change-email/request` | `Purchaser` (`get_current_purchaser`) | None | All Tiers | Initiates email update: verifies current password, dispatches verification to new address. |
| `POST` | `/api/v1/purchaser/auth/change-email/verify` | Public (Token Payload) | None | All Tiers | Completes email change upon token verification. |
| `PUT` | `/api/v1/purchaser/auth/name` | `Purchaser` (`get_current_purchaser`) | None | All Tiers | Updates purchaser's legal full name. |
| `POST` | `/api/v1/purchaser/auth/email/request-otp` | `Purchaser` (`get_current_purchaser`) | None | All Tiers | Dispatches single-use 6-digit OTP to current email to authorize address change. |
| `POST` | `/api/v1/purchaser/auth/email/confirm-otp` | `Purchaser` (`get_current_purchaser`) | None | All Tiers | Verifies OTP and commits updated email address. |
| `POST` | `/api/v1/purchaser/auth/schedule-deletion` | `Purchaser` (`get_current_purchaser`) | None | All Tiers | Schedules account deletion after 60-day recovery grace period and alerts hospital admins. |
| `POST` | `/api/v1/purchaser/auth/cancel-deletion` | `Purchaser` (`get_current_purchaser`) | None | All Tiers | Cancels pending deletion and restores enterprise account access. |
| **Purchaser Hospital Management (`purchaser_hospitals.py`)** | | | | | |
| `POST` | `/api/v1/purchaser/hospitals/register` | `Purchaser` (`get_current_purchaser`) | Purchaser Portfolio | All Tiers | Registers hospital facility under subscription; seeds default clinical departments and roles. |
| `GET` | `/api/v1/purchaser/hospitals` | `Purchaser` (`get_current_purchaser`) | Purchaser Portfolio | All Tiers | Lists all hospitals owned by purchaser with active administrator counts. |
| `GET` | `/api/v1/purchaser/hospitals/{hospital_id}` | `Purchaser` (`get_current_purchaser`) | Purchaser Portfolio | All Tiers | Full hospital administration view: current admins, pending invitations, subscription quotas. |
| `POST` | `/api/v1/purchaser/hospitals/{hospital_id}/administrators/invite` | `Purchaser` (`get_current_purchaser`) | Purchaser Portfolio | All Tiers | Invites hospital administrator with atomic subscription admin seat enforcement. |
| `POST` | `/api/v1/purchaser/hospitals/{hospital_id}/administrators/invitations/{invitation_id}/revoke` | `Purchaser` (`get_current_purchaser`) | Purchaser Portfolio | All Tiers | Revokes pending administrator invitation and invalidates token. |
| `POST` | `/api/v1/purchaser/hospitals/{hospital_id}/administrators/invitations/{invitation_id}/resend` | `Purchaser` (`get_current_purchaser`) | Purchaser Portfolio | All Tiers | Re-issues 72-hour administrator invitation email. |
| `DELETE` | `/api/v1/purchaser/hospitals/{hospital_id}/administrators/{admin_id}` | `Purchaser` (`get_current_purchaser`) | Purchaser Portfolio | All Tiers | Revokes administrator authority while preserving underlying employee record and audit logs. |
| **Purchaser Subscription Entitlements (`purchaser_subscriptions.py`)** | | | | | |
| `GET` | `/api/v1/purchaser/subscriptions/plans` | Public / Purchaser | None | All Tiers | Canonical plan catalogue: display names, max admins, max employees, pricing, feature sets. |
| `GET` | `/api/v1/purchaser/subscriptions` | `Purchaser` (`get_current_purchaser`) | Purchaser Portfolio | All Tiers | Lists active and historical subscriptions owned by purchaser. |
| `POST` | `/api/v1/purchaser/subscriptions` | `Purchaser` (`get_current_purchaser`) | Purchaser Portfolio | All Tiers | Creates new subscription license for specified tier and billing interval. |
| `GET` | `/api/v1/purchaser/subscriptions/{subscription_id}` | `Purchaser` (`get_current_purchaser`) | Purchaser Portfolio | All Tiers | Detailed subscription view: current period, renewal status, hospital binding, quota usage. |
| `POST` | `/api/v1/purchaser/subscriptions/{subscription_id}/change-plan` | `Purchaser` (`get_current_purchaser`) | Purchaser Portfolio | All Tiers | Modifies subscription tier (`BASIC` / `PRO` / `ULTRA`) with entitlement recalculation. |
| `POST` | `/api/v1/purchaser/subscriptions/{subscription_id}/cancel` | `Purchaser` (`get_current_purchaser`) | Purchaser Portfolio | All Tiers | Cancels auto-renewal at period end; maintains active state until expiration. |
| **Employee Self-Registration (`registration.py`)** | | | | | |
| `POST` | `/api/v1/registration/start` | Public | None | All Tiers | Stage 1: Initiates registration with Hospital UID and email, dispatching 6-digit OTP. |
| `POST` | `/api/v1/registration/send-otp` | Public | None | All Tiers | Resends Stage 1 OTP subject to rate limit cooldown. |
| `POST` | `/api/v1/registration/verify-otp` | Public (OTP Payload) | None | All Tiers | Verifies 6-digit OTP; unlocks Stage 2 with short-lived single-use verification token. |
| `GET` | `/api/v1/registration/available-departments` | Public (Hospital UID Query) | None | All Tiers | Lists active configured departments available for registration slot selection. |
| `GET` | `/api/v1/registration/available-roles` | Public (Hospital UID Query) | None | All Tiers | Lists active configured roles available for registration slot selection. |
| `GET` | `/api/v1/registration/check-username` | Public (Username Query) | None | All Tiers | Authoritative case-insensitive username availability check with auto-suggestions. |
| `POST` | `/api/v1/registration/submit` | Public (Stage 1 Token Payload) | None | All Tiers | Stage 2: Submits account info, unverified employee UID claim, and up to 5 role slot requests. |
| `POST` | `/api/v1/registration/additional-assignment-request` | Public | None | All Tiers | Grievance/justification request when all 5 initial registration slots are occupied. |
| `GET` | `/api/v1/registration/status` | Public (Registration ID Query) | None | All Tiers | Tracks two-level approval milestone progress (Dept Head Level 1 + Admin Level 2). |

---

## 3. Critical Security & Architectural Guarantees

1. **Granular Permission Checks (`require_permission`)**:
   High-risk administrative write operations (`POST /departments`, `POST /roles`, `POST /roles/{id}/versions`, `POST /employees/invite`, `POST /employees/{id}/status`, `POST /employees/{id}/assignments`, `DELETE /employees/{id}/assignments/{id}`, `POST /employees/{id}/overrides`, `DELETE /employees/{id}/overrides/{id}`, `POST /approvals/{id}/decide`) enforce explicit atomic permissions (`department:manage`, `role:manage`, `employee:manage`, `approval:manage`).
2. **Tier Containment**:
   BASIC tier tenants cannot create custom departments or roles (enforced by `department:manage` and `role:manage` requiring PRO tier). Role versioning is strictly prohibited in BASIC.
3. **Dynamic Derivation**:
   Employee permissions are evaluated dynamically at runtime from active role versions and unexpired overrides; modifying a role version or override immediately updates effective capabilities without mutating membership rows.
4. **Strict Override Precedence**:
   Explicit employee-level `DENY` overrides strictly take precedence over any inherited role grants. `GRANT` overrides are bounded by the hospital's subscription tier.
