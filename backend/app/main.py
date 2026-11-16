import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.exceptions import HIMSException
from app.db.database import create_tables

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("hims.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Verify database schema and RBAC templates
    if settings.ENVIRONMENT != "testing":
        logger.info("Verifying HIMS database tables...")
        try:
            create_tables()
            from app.db.database import SessionLocal
            from app.db.rbac_seeder import backfill_all_hospitals_rbac
            with SessionLocal() as db:
                backfill_all_hospitals_rbac(db)
            logger.info("HIMS database tables and RBAC templates initialized.")
        except Exception as e:
            logger.error("Database initialization warning: %s", e)

    yield
    # Shutdown
    logger.info("HIMS backend shutdown.")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS Middleware: robust configuration supporting localhost, mobile local network (Android/iOS), and production domains
cors_origins = (
    settings.FRONTEND_ORIGINS
    if isinstance(settings.FRONTEND_ORIGINS, list)
    else [settings.FRONTEND_ORIGINS]
)
if settings.ENVIRONMENT.lower() == "production":
    cors_origins = [o for o in cors_origins if o != "*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|.*\.vercel\.app|.*\.onrender\.com|.*\.netlify\.app)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(HIMSException)
async def hims_exception_handler(request: Request, exc: HIMSException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "code": exc.code},
        headers=exc.headers,
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    error_messages = []
    for err in exc.errors():
        field = err.get("loc", [""])[-1]
        msg = err.get("msg", "Invalid value")
        error_messages.append(f"{field}: {msg}")
    formatted = "; ".join(error_messages)
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": formatted, "code": "VALIDATION_ERROR"},
    )


# Include API v1 router
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/health", tags=["Health"])
def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
    }


@app.get("/", tags=["Root"])
def root():
    return {
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "api_docs": "/docs",
    }

