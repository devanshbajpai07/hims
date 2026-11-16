import uuid
from datetime import datetime, timezone, timedelta
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db.database import SessionLocal
from app.models.user import User
from app.models.session import SessionRecord
from app.models.membership import TenantMembership
from app.models.assignment import RoleAssignment
from app.models.role import Role
from app.models.department import Department
from app.core.security import hash_token

def test_dept_head_api_endpoints(client: TestClient):
    db = SessionLocal()
    try:
        # Find any user with a dept_head assignment in test database
        dh_asgn = (
            db.query(RoleAssignment)
            .join(TenantMembership, TenantMembership.id == RoleAssignment.membership_id)
            .join(Role, Role.id == RoleAssignment.role_id)
            .filter(
                Role.code == "dept_head",
                RoleAssignment.is_active == True,
            )
            .first()
        )
        assert dh_asgn is not None, "No dept_head assignment in test DB"

        mem = db.query(TenantMembership).filter(TenantMembership.id == dh_asgn.membership_id).first()
        user = db.query(User).filter(User.id == mem.user_id).first()
        assert user is not None

        # Create active session token
        from app.core.security import create_access_token
        token_claims = {
            "hospital_id": str(mem.hospital_id),
            "hospital_uid": mem.hospital.hospital_uid,
            "membership_id": str(mem.id),
            "assignment_id": str(dh_asgn.id),
            "role": "dept_head",
            "department": dh_asgn.department.name if dh_asgn.department else "Cardiology",
        }
        raw_token = create_access_token(
            subject=str(user.id),
            extra_claims=token_claims,
            expires_delta=timedelta(days=1),
        )
        token_hash = hash_token(raw_token)
        sess = SessionRecord(
            user_id=user.id,
            hospital_id=mem.hospital_id,
            token_hash=token_hash,
            remember_me=False,
            expires_at=datetime.now(timezone.utc) + timedelta(days=1),
            is_revoked=False,
        )
        db.add(sess)
        db.commit()

        headers = {
            "Authorization": f"Bearer {raw_token}",
            "X-Assignment-Id": str(dh_asgn.id),
        }

        # 1. Dashboard summary
        res = client.get("/api/v1/clinical/department-head/dashboard-summary", headers=headers)
        assert res.status_code == 200, res.text
        data = res.json()
        assert "registered_patients_count" in data
        assert "today_scheduled_count" in data
        assert "department_staff_count" in data
        print("Summary response:", data)

        # 2. Department employees
        res_emp = client.get("/api/v1/clinical/department-head/employees", headers=headers)
        assert res_emp.status_code == 200, res_emp.text
        employees = res_emp.json()
        assert isinstance(employees, list)
        print(f"Found {len(employees)} department employees")

        # 3. Department revocation requests
        res_rev = client.get("/api/v1/clinical/department-head/revocation-requests", headers=headers)
        assert res_rev.status_code == 200, res_rev.text
        assert isinstance(res_rev.json(), list)

    finally:
        db.close()
