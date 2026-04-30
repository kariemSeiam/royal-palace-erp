from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps.admin_auth import require_it_manage, require_it_view
from src.core.db.session import get_db
from src.models.user import User

router = APIRouter(prefix="/admin/maker-checker", tags=["admin-maker-checker"])


def _safe_int(value, default=0):
    try:
        return int(value or 0)
    except Exception:
        return default


async def ensure_maker_checker_tables(db: AsyncSession):
    await db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS approval_policies (
                id SERIAL PRIMARY KEY,
                module VARCHAR(100) NOT NULL,
                entity_type VARCHAR(100) NOT NULL,
                action_code VARCHAR(100) NOT NULL,
                title VARCHAR(255) NOT NULL,
                maker_permission_code VARCHAR(150) NULL,
                checker_permission_code VARCHAR(150) NULL,
                require_different_checker BOOLEAN NOT NULL DEFAULT TRUE,
                require_reason_on_reject BOOLEAN NOT NULL DEFAULT TRUE,
                require_reason_on_override BOOLEAN NOT NULL DEFAULT TRUE,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE(module, entity_type, action_code)
            )
            """
        )
    )

    await db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS approval_requests (
                id SERIAL PRIMARY KEY,
                factory_id INTEGER NULL REFERENCES factories(id) ON DELETE SET NULL,
                policy_id INTEGER NOT NULL REFERENCES approval_policies(id) ON DELETE CASCADE,
                entity_type VARCHAR(100) NOT NULL,
                entity_id INTEGER NOT NULL,
                action_code VARCHAR(100) NOT NULL,
                requested_by_user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
                assigned_checker_user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
                checked_by_user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
                status VARCHAR(50) NOT NULL DEFAULT 'pending',
                request_reason TEXT NULL,
                rejection_reason TEXT NULL,
                override_reason TEXT NULL,
                metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
                requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                checked_at TIMESTAMPTZ NULL,
                UNIQUE(policy_id, entity_type, entity_id, action_code)
            )
            """
        )
    )

    await db.execute(text("CREATE INDEX IF NOT EXISTS ix_approval_policies_module ON approval_policies(module)"))
    await db.execute(text("CREATE INDEX IF NOT EXISTS ix_approval_policies_entity_type ON approval_policies(entity_type)"))
    await db.execute(text("CREATE INDEX IF NOT EXISTS ix_approval_requests_factory_id ON approval_requests(factory_id)"))
    await db.execute(text("CREATE INDEX IF NOT EXISTS ix_approval_requests_entity ON approval_requests(entity_type, entity_id)"))
    await db.execute(text("CREATE INDEX IF NOT EXISTS ix_approval_requests_status ON approval_requests(status)"))
    await db.execute(text("CREATE INDEX IF NOT EXISTS ix_approval_requests_requested_by ON approval_requests(requested_by_user_id)"))
    await db.execute(text("CREATE INDEX IF NOT EXISTS ix_approval_requests_checked_by ON approval_requests(checked_by_user_id)"))

    # Commit DDL/index work first so later seed work does not keep wide locks open.
    await db.commit()

    # Serialize seed work across concurrent requests to avoid deadlocks on approval_policies.
    await db.execute(text("SELECT pg_advisory_xact_lock(91824017)"))

    defaults = [
        {
            "module": "procurement",
            "entity_type": "purchase_order",
            "action_code": "approve",
            "title": "اعتماد أمر شراء",
            "maker_permission_code": "procurement.manage",
            "checker_permission_code": "procurement.manage",
        },
        {
            "module": "procurement",
            "entity_type": "supplier_payment",
            "action_code": "approve",
            "title": "اعتماد سداد مورد",
            "maker_permission_code": "procurement.manage",
            "checker_permission_code": "finance.manage",
        },
        {
            "module": "sales",
            "entity_type": "sales_quotation",
            "action_code": "approve",
            "title": "اعتماد عرض سعر",
            "maker_permission_code": "orders.manage",
            "checker_permission_code": "orders.manage",
        },
        {
            "module": "sales",
            "entity_type": "sales_quotation",
            "action_code": "convert",
            "title": "تحويل عرض سعر إلى طلب",
            "maker_permission_code": "orders.manage",
            "checker_permission_code": "orders.manage",
        },
        {
            "module": "sales",
            "entity_type": "sales_invoice",
            "action_code": "cancel",
            "title": "إلغاء فاتورة مبيعات",
            "maker_permission_code": "orders.manage",
            "checker_permission_code": "finance.manage",
        },
        {
            "module": "sales",
            "entity_type": "sales_invoice_return",
            "action_code": "refund",
            "title": "اعتماد رد مبلغ",
            "maker_permission_code": "orders.manage",
            "checker_permission_code": "finance.manage",
        },
        {
            "module": "orders",
            "entity_type": "customer_order",
            "action_code": "dispatch",
            "title": "اعتماد شحن الطلب",
            "maker_permission_code": "orders.manage",
            "checker_permission_code": "orders.manage",
        },
        {
            "module": "orders",
            "entity_type": "customer_order",
            "action_code": "deliver",
            "title": "اعتماد تسليم الطلب",
            "maker_permission_code": "orders.manage",
            "checker_permission_code": "orders.manage",
        },
        {
            "module": "inventory",
            "entity_type": "inventory_movement",
            "action_code": "adjust",
            "title": "اعتماد حركة مخزون يدوية",
            "maker_permission_code": "inventory.manage",
            "checker_permission_code": "inventory.manage",
        },
    ]

    for item in defaults:
        await db.execute(
            text(
                """
                INSERT INTO approval_policies (
                    module,
                    entity_type,
                    action_code,
                    title,
                    maker_permission_code,
                    checker_permission_code,
                    require_different_checker,
                    require_reason_on_reject,
                    require_reason_on_override,
                    is_active
                )
                VALUES (
                    :module,
                    :entity_type,
                    :action_code,
                    :title,
                    :maker_permission_code,
                    :checker_permission_code,
                    TRUE,
                    TRUE,
                    TRUE,
                    TRUE
                )
                ON CONFLICT (module, entity_type, action_code)
                DO NOTHING
                """
            ),
            item,
        )

    await db.commit()


@router.get("/summary")
async def get_maker_checker_summary(
    current_user: User = Depends(require_it_view),
    db: AsyncSession = Depends(get_db),
):
    await ensure_maker_checker_tables(db)

    policies_count = _safe_int((await db.execute(text("SELECT COUNT(*) FROM approval_policies"))).scalar())
    active_policies_count = _safe_int((await db.execute(text("SELECT COUNT(*) FROM approval_policies WHERE is_active = TRUE"))).scalar())
    requests_count = _safe_int((await db.execute(text("SELECT COUNT(*) FROM approval_requests"))).scalar())
    pending_requests_count = _safe_int((await db.execute(text("SELECT COUNT(*) FROM approval_requests WHERE status = 'pending'"))).scalar())
    approved_requests_count = _safe_int((await db.execute(text("SELECT COUNT(*) FROM approval_requests WHERE status = 'approved'"))).scalar())
    rejected_requests_count = _safe_int((await db.execute(text("SELECT COUNT(*) FROM approval_requests WHERE status = 'rejected'"))).scalar())
    overridden_requests_count = _safe_int((await db.execute(text("SELECT COUNT(*) FROM approval_requests WHERE status = 'overridden'"))).scalar())

    return {
        "summary": {
            "policies_count": policies_count,
            "active_policies_count": active_policies_count,
            "requests_count": requests_count,
            "pending_requests_count": pending_requests_count,
            "approved_requests_count": approved_requests_count,
            "rejected_requests_count": rejected_requests_count,
            "overridden_requests_count": overridden_requests_count,
        }
    }


@router.get("/policies")
async def list_approval_policies(
    current_user: User = Depends(require_it_view),
    db: AsyncSession = Depends(get_db),
):
    await ensure_maker_checker_tables(db)
    result = await db.execute(
        text(
            """
            SELECT
                id,
                module,
                entity_type,
                action_code,
                title,
                maker_permission_code,
                checker_permission_code,
                require_different_checker,
                require_reason_on_reject,
                require_reason_on_override,
                is_active,
                created_at,
                updated_at
            FROM approval_policies
            ORDER BY module ASC, entity_type ASC, action_code ASC, id ASC
            """
        )
    )
    return [dict(row) for row in result.mappings().all()]


@router.get("/requests")
async def list_approval_requests(
    current_user: User = Depends(require_it_view),
    db: AsyncSession = Depends(get_db),
):
    await ensure_maker_checker_tables(db)
    result = await db.execute(
        text(
            """
            SELECT
                ar.id,
                ar.factory_id,
                f.name AS factory_name,
                ar.policy_id,
                ap.module,
                ap.title AS policy_title,
                ar.entity_type,
                ar.entity_id,
                ar.action_code,
                ar.requested_by_user_id,
                ru.full_name AS requested_by_name,
                ar.assigned_checker_user_id,
                acu.full_name AS assigned_checker_name,
                ar.checked_by_user_id,
                cu.full_name AS checked_by_name,
                ar.status,
                ar.request_reason,
                ar.rejection_reason,
                ar.override_reason,
                ar.metadata_json,
                ar.requested_at,
                ar.checked_at
            FROM approval_requests ar
            JOIN approval_policies ap ON ap.id = ar.policy_id
            LEFT JOIN factories f ON f.id = ar.factory_id
            LEFT JOIN users ru ON ru.id = ar.requested_by_user_id
            LEFT JOIN users acu ON acu.id = ar.assigned_checker_user_id
            LEFT JOIN users cu ON cu.id = ar.checked_by_user_id
            ORDER BY ar.id DESC
            LIMIT 200
            """
        )
    )
    return [dict(row) for row in result.mappings().all()]


@router.post("/requests")
async def create_approval_request(
    payload: dict,
    current_user: User = Depends(require_it_manage),
    db: AsyncSession = Depends(get_db),
):
    await ensure_maker_checker_tables(db)

    policy_id = payload.get("policy_id")
    entity_type = str(payload.get("entity_type") or "").strip()
    entity_id = payload.get("entity_id")
    action_code = str(payload.get("action_code") or "").strip()
    factory_id = payload.get("factory_id")
    request_reason = payload.get("request_reason")
    assigned_checker_user_id = payload.get("assigned_checker_user_id")
    metadata = payload.get("metadata_json") or {}

    if not policy_id:
        raise HTTPException(status_code=400, detail="policy_id is required")
    if not entity_type:
        raise HTTPException(status_code=400, detail="entity_type is required")
    if not entity_id:
        raise HTTPException(status_code=400, detail="entity_id is required")
    if not action_code:
        raise HTTPException(status_code=400, detail="action_code is required")

    policy_result = await db.execute(
        text(
            """
            SELECT *
            FROM approval_policies
            WHERE id = :policy_id
            LIMIT 1
            """
        ),
        {"policy_id": policy_id},
    )
    policy = policy_result.mappings().first()
    if not policy:
        raise HTTPException(status_code=404, detail="Approval policy not found")

    if not bool(policy.get("is_active")):
        raise HTTPException(status_code=409, detail="Approval policy is inactive")

    if str(policy.get("entity_type") or "") != entity_type or str(policy.get("action_code") or "") != action_code:
        raise HTTPException(status_code=409, detail="Policy does not match entity_type/action_code")

    existing_result = await db.execute(
        text(
            """
            SELECT id, status
            FROM approval_requests
            WHERE policy_id = :policy_id
              AND entity_type = :entity_type
              AND entity_id = :entity_id
              AND action_code = :action_code
            LIMIT 1
            """
        ),
        {
            "policy_id": policy_id,
            "entity_type": entity_type,
            "entity_id": int(entity_id),
            "action_code": action_code,
        },
    )
    existing = existing_result.mappings().first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Approval request already exists with status {existing.get('status')}")

    if policy.get("require_different_checker") and assigned_checker_user_id and int(assigned_checker_user_id) == int(current_user.id):
        raise HTTPException(status_code=409, detail="Maker and checker must be different users for this policy")

    insert_result = await db.execute(
        text(
            """
            INSERT INTO approval_requests (
                factory_id,
                policy_id,
                entity_type,
                entity_id,
                action_code,
                requested_by_user_id,
                assigned_checker_user_id,
                status,
                request_reason,
                metadata_json
            )
            VALUES (
                :factory_id,
                :policy_id,
                :entity_type,
                :entity_id,
                :action_code,
                :requested_by_user_id,
                :assigned_checker_user_id,
                'pending',
                :request_reason,
                CAST(:metadata_json AS JSONB)
            )
            RETURNING id
            """
        ),
        {
            "factory_id": factory_id,
            "policy_id": int(policy_id),
            "entity_type": entity_type,
            "entity_id": int(entity_id),
            "action_code": action_code,
            "requested_by_user_id": current_user.id,
            "assigned_checker_user_id": assigned_checker_user_id,
            "request_reason": request_reason,
            "metadata_json": str(metadata).replace("'", '"'),
        },
    )
    approval_request_id = int(insert_result.scalar())
    await db.commit()

    result = await db.execute(
        text(
            """
            SELECT
                ar.*,
                ap.module,
                ap.title AS policy_title
            FROM approval_requests ar
            JOIN approval_policies ap ON ap.id = ar.policy_id
            WHERE ar.id = :approval_request_id
            LIMIT 1
            """
        ),
        {"approval_request_id": approval_request_id},
    )
    return dict(result.mappings().first())


@router.post("/requests/{approval_request_id}/approve")
async def approve_approval_request(
    approval_request_id: int,
    payload: dict | None = None,
    current_user: User = Depends(require_it_manage),
    db: AsyncSession = Depends(get_db),
):
    await ensure_maker_checker_tables(db)
    payload = payload or {}

    result = await db.execute(
        text(
            """
            SELECT
                ar.*,
                ap.title AS policy_title,
                ap.require_different_checker
            FROM approval_requests ar
            JOIN approval_policies ap ON ap.id = ar.policy_id
            WHERE ar.id = :approval_request_id
            LIMIT 1
            """
        ),
        {"approval_request_id": approval_request_id},
    )
    request_row = result.mappings().first()
    if not request_row:
        raise HTTPException(status_code=404, detail="Approval request not found")

    if str(request_row.get("status") or "") != "pending":
        raise HTTPException(status_code=409, detail="Only pending requests can be approved")

    if bool(request_row.get("require_different_checker")) and request_row.get("requested_by_user_id") and int(request_row.get("requested_by_user_id")) == int(current_user.id):
        raise HTTPException(status_code=409, detail="Maker cannot approve the same request")

    await db.execute(
        text(
            """
            UPDATE approval_requests
            SET
                status = 'approved',
                checked_by_user_id = :checked_by_user_id,
                checked_at = NOW(),
                override_reason = NULL,
                rejection_reason = NULL
            WHERE id = :approval_request_id
            """
        ),
        {"approval_request_id": approval_request_id, "checked_by_user_id": current_user.id},
    )
    await db.commit()
    return {"ok": True, "approval_request_id": approval_request_id, "status": "approved"}


@router.post("/requests/{approval_request_id}/reject")
async def reject_approval_request(
    approval_request_id: int,
    payload: dict | None = None,
    current_user: User = Depends(require_it_manage),
    db: AsyncSession = Depends(get_db),
):
    await ensure_maker_checker_tables(db)
    payload = payload or {}
    rejection_reason = str(payload.get("rejection_reason") or "").strip()
    if not rejection_reason:
        raise HTTPException(status_code=400, detail="rejection_reason is required")

    result = await db.execute(
        text(
            """
            SELECT
                ar.*,
                ap.require_different_checker
            FROM approval_requests ar
            JOIN approval_policies ap ON ap.id = ar.policy_id
            WHERE ar.id = :approval_request_id
            LIMIT 1
            """
        ),
        {"approval_request_id": approval_request_id},
    )
    request_row = result.mappings().first()
    if not request_row:
        raise HTTPException(status_code=404, detail="Approval request not found")

    if str(request_row.get("status") or "") != "pending":
        raise HTTPException(status_code=409, detail="Only pending requests can be rejected")

    if bool(request_row.get("require_different_checker")) and request_row.get("requested_by_user_id") and int(request_row.get("requested_by_user_id")) == int(current_user.id):
        raise HTTPException(status_code=409, detail="Maker cannot reject the same request")

    await db.execute(
        text(
            """
            UPDATE approval_requests
            SET
                status = 'rejected',
                checked_by_user_id = :checked_by_user_id,
                checked_at = NOW(),
                rejection_reason = :rejection_reason
            WHERE id = :approval_request_id
            """
        ),
        {
            "approval_request_id": approval_request_id,
            "checked_by_user_id": current_user.id,
            "rejection_reason": rejection_reason,
        },
    )
    await db.commit()
    return {"ok": True, "approval_request_id": approval_request_id, "status": "rejected"}


@router.post("/requests/{approval_request_id}/override")
async def override_approval_request(
    approval_request_id: int,
    payload: dict | None = None,
    current_user: User = Depends(require_it_manage),
    db: AsyncSession = Depends(get_db),
):
    await ensure_maker_checker_tables(db)
    payload = payload or {}
    override_reason = str(payload.get("override_reason") or "").strip()
    if not override_reason:
        raise HTTPException(status_code=400, detail="override_reason is required")

    result = await db.execute(
        text(
            """
            SELECT ar.*
            FROM approval_requests ar
            WHERE ar.id = :approval_request_id
            LIMIT 1
            """
        ),
        {"approval_request_id": approval_request_id},
    )
    request_row = result.mappings().first()
    if not request_row:
        raise HTTPException(status_code=404, detail="Approval request not found")

    if str(request_row.get("status") or "") not in {"pending", "rejected"}:
        raise HTTPException(status_code=409, detail="Only pending/rejected requests can be overridden")

    await db.execute(
        text(
            """
            UPDATE approval_requests
            SET
                status = 'overridden',
                checked_by_user_id = :checked_by_user_id,
                checked_at = NOW(),
                override_reason = :override_reason
            WHERE id = :approval_request_id
            """
        ),
        {
            "approval_request_id": approval_request_id,
            "checked_by_user_id": current_user.id,
            "override_reason": override_reason,
        },
    )
    await db.commit()
    return {"ok": True, "approval_request_id": approval_request_id, "status": "overridden"}
