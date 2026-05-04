import logging
from importlib import import_module
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from src.core.config.settings import settings
from src.core.db.session import SessionLocal

import src.models.user
import src.models.catalog
import src.models.b2b
import src.models.erp_org
import src.models.attendance
import src.models.orders
import src.models.inventory
import src.models.hr_payroll
import src.models.accounting
import src.models.crm
import src.models.project
import src.models.notification
import src.models.pos
import src.models.website
import src.models.helpdesk
import src.models.field_service
import src.models.email_marketing
import src.models.hr_advanced
import src.models.report
import src.models.planning
import src.models.quality
import src.models.maintenance
import src.models.asset
import src.models.expense
import src.models.subscription
import src.models.sign
import src.models.appointment
import src.models.barcode
import src.models.loyalty
import src.models.shipping
import src.models.ecommerce
import src.models.knowledge
import src.models.social_media_marketing
import src.models.marketing_automation
import src.models.advanced_recruitment
import src.models.advanced_barcode
import src.models.procurement_rfq

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("royal-palace-api")

app = FastAPI(title=settings.APP_NAME, debug=settings.APP_DEBUG)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://royalpalace-group.com",
        "https://admin.royalpalace-group.com",
        "https://api.royalpalace-group.com",
        "http://royalpalace-group.com",
        "http://admin.royalpalace-group.com",
        "http://api.royalpalace-group.com",
        "http://localhost:3000",
        "http://localhost:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

def mount_uploads_directory():
    candidate_paths = [
        Path("/app/uploads"),
        Path("/opt/royal-palace-erp/apps/api/uploads"),
        Path(__file__).resolve().parents[1] / "uploads",
    ]
    for path in candidate_paths:
        if path.exists() and path.is_dir():
            app.mount("/uploads", StaticFiles(directory=str(path)), name="uploads")
            logger.info("Mounted /uploads from: %s", path)
            return
    logger.warning("Uploads directory was not mounted because no candidate path exists: %s", candidate_paths)

def include_router_safe(module_path: str, router_attr: str = "router", prefix: str | None = None):
    try:
        module = import_module(module_path)
        router = getattr(module, router_attr)
        if prefix:
            app.include_router(router, prefix=prefix)
        else:
            app.include_router(router)
        logger.info("Included router: %s", module_path)
    except Exception as exc:
        logger.exception("FAILED to include router %s: %s", module_path, exc)

mount_uploads_directory()

include_router_safe("src.api.routers.health")
include_router_safe("src.api.routers.auth", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.catalog", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_catalog", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_b2b", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_crm", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_project", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_notifications", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_advanced_inventory", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_pos", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_website", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_helpdesk", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_field_service", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_email_marketing", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_hr_advanced", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_reports", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_planning", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_quality", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_maintenance", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_assets", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_expenses", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_subscriptions", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_sign", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_appointments", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_barcode", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_loyalty", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_delivery", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_ecommerce", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.portal", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.orders", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.store_account", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_erp_org", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_attendance", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.worker_attendance", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.worker_work_orders", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.worker_profile", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_hr_payroll", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.worker_hr", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_orders", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_sales_invoices", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_sales_quotations", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_dashboard", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_users", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_factories", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_departments", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_employees", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_it_access", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_it", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_inventory", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_work_orders", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_procurement", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_finance", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_accounting", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_audit", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_maker_checker", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_approvals", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_knowledge", prefix=settings.API_V1_PREFIX)

include_router_safe("src.api.routers.admin_social_media_marketing", prefix=settings.API_V1_PREFIX)

include_router_safe("src.api.routers.admin_marketing_automation", prefix=settings.API_V1_PREFIX)

include_router_safe("src.api.routers.admin_advanced_recruitment", prefix=settings.API_V1_PREFIX)

include_router_safe("src.api.routers.admin_advanced_barcode", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_stock_lots", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_account_taxes", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_mrp_boms", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_mrp_work_orders", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_mrp_variants", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_mrp_mrp", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_maintenance_preventive", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_mrp_routings", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_manufacturing_orders", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_simulation", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_mrp_alternatives", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_orders_mrp", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_smart_factory", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_blockchain", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_voice", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_mobile_sync", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_mrp_alerts", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_mrp_pivot", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_mrp_attachments", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_mrp_bom_versions", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_mrp_unbuild", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_smart_factory", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_voice", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_mobile_sync", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_mrp_workcenters", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_stock_scraps", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_account_payment_terms", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_product_supplierinfo", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_landed_costs", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_account_payment_term_lines", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_documents", prefix=settings.API_V1_PREFIX)

include_router_safe("src.api.routers.admin_events", prefix=settings.API_V1_PREFIX)

include_router_safe("src.api.routers.admin_fleet", prefix=settings.API_V1_PREFIX)

include_router_safe("src.api.routers.admin_sms_marketing", prefix=settings.API_V1_PREFIX)

include_router_safe("src.api.routers.admin_forum", prefix=settings.API_V1_PREFIX)

include_router_safe("src.api.routers.admin_elearning", prefix=settings.API_V1_PREFIX)

include_router_safe("src.api.routers.admin_rental", prefix=settings.API_V1_PREFIX)

include_router_safe("src.api.routers.admin_timesheets", prefix=settings.API_V1_PREFIX)

include_router_safe("src.api.routers.admin_equity", prefix=settings.API_V1_PREFIX)

include_router_safe("src.api.routers.admin_survey", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_budgets", prefix=settings.API_V1_PREFIX)
include_router_safe("src.api.routers.admin_cost_centers", prefix=settings.API_V1_PREFIX)


@app.on_event("startup")
async def startup_initialize_dynamic_tables():
    try:
        from src.api.routers.admin_catalog import ensure_industrial_tables
        from src.api.routers.admin_hr_payroll import ensure_hr_payroll_tables
        from src.api.routers.admin_procurement import ensure_procurement_tables
        from src.api.routers.admin_inventory import ensure_inventory_tables
        from src.api.routers.admin_sales_invoices import ensure_sales_documents_tables
        from src.api.routers.admin_sales_quotations import ensure_sales_quotations_tables
        from src.api.routers.admin_orders import ensure_delivery_notes_table
        from src.api.routers.admin_audit import ensure_audit_tables
        from src.api.routers.admin_maker_checker import ensure_maker_checker_tables
        from src.api.routers.admin_accounting import ensure_accounting_tables
        from src.api.routers.admin_knowledge import ensure_knowledge_tables
        from src.api.routers.admin_social_media_marketing import ensure_social_media_tables
        from src.api.routers.admin_marketing_automation import ensure_marketing_automation_tables
        from src.api.routers.admin_advanced_recruitment import ensure_recruitment_tables
        from src.api.routers.admin_advanced_barcode import ensure_barcode_tables

        async with SessionLocal() as db:
            await ensure_industrial_tables(db)
            await ensure_hr_payroll_tables(db)
            await ensure_procurement_tables(db)
            await ensure_inventory_tables(db)
            await ensure_sales_documents_tables(db)
            await ensure_sales_quotations_tables(db)
            await ensure_delivery_notes_table(db)
            await ensure_audit_tables(db)
            await ensure_maker_checker_tables(db)
            await ensure_accounting_tables(db)
            await ensure_knowledge_tables(db)
            await ensure_social_media_tables(db)
            await ensure_marketing_automation_tables(db)
            await ensure_recruitment_tables(db)
            await ensure_barcode_tables(db)
            await ensure_knowledge_tables(db)
            await ensure_social_media_tables(db)
            await ensure_marketing_automation_tables(db)
            await ensure_recruitment_tables(db)
            await ensure_barcode_tables(db)

        logger.info("Dynamic startup table initialization completed successfully")
    except Exception as exc:
        logger.exception("Dynamic startup table initialization failed: %s", exc)

@app.get("/")
async def root():
    return {"status": "online", "app": settings.APP_NAME, "version": "1.0.0"}