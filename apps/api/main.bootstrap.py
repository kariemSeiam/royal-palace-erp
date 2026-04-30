from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import logging
from src.modules.rbac.router import router as rbac_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s"
)

logger = logging.getLogger("royalpalace.api")

app = FastAPI(
    title="Royal Palace ERP API",
    version="1.1.0",
    description="Royal Palace Group Enterprise ERP API"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def include_optional_router(import_path: str, label: str) -> None:
    try:
        module_path, attr_name = import_path.rsplit(".", 1)
        module = __import__(module_path, fromlist=[attr_name])
        router = getattr(module, attr_name)
        app.include_router(router)
app.include_router(rbac_router)
        logger.info("%s router loaded", label)
    except Exception as e:
        logger.warning("%s router not loaded: %s", label, e)


include_optional_router("src.modules.rbac.router", "RBAC")
include_optional_router("src.modules.dashboard.router", "Dashboard")


@app.get("/")
async def root():
    return {
        "service": "Royal Palace ERP API",
        "status": "running",
        "version": "1.1.0"
    }


@app.get("/health/live")
async def health_live():
    return {"status": "live"}


@app.get("/health/ready")
async def health_ready():
    return {"status": "ready"}


@app.on_event("startup")
async def startup_event():
    logger.info("Royal Palace ERP API started")


@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Royal Palace ERP API shutting down")