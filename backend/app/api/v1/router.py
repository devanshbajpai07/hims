from fastapi import APIRouter
from app.api.v1.endpoints import (
    admin_auth,
    admin_dashboard,
    approvals,
    auth,
    clinical,
    communication,
    documents,
    employee_account,
    employee_invitations,
    purchaser_auth,
    purchaser_hospitals,
    purchaser_subscriptions,
    registration,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(registration.router)
api_router.include_router(approvals.router)
api_router.include_router(purchaser_auth.router)
api_router.include_router(purchaser_subscriptions.router)
api_router.include_router(purchaser_hospitals.router)
api_router.include_router(admin_auth.router)
api_router.include_router(admin_dashboard.router)
api_router.include_router(employee_invitations.router)
api_router.include_router(documents.router)
api_router.include_router(employee_account.router)
api_router.include_router(clinical.router)
api_router.include_router(communication.router)



