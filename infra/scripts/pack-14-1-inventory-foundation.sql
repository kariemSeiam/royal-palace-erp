BEGIN;

CREATE TABLE IF NOT EXISTS warehouses (
    id SERIAL PRIMARY KEY,
    factory_id INTEGER NOT NULL REFERENCES factories(id) ON DELETE RESTRICT,
    code VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(factory_id, code),
    UNIQUE(factory_id, name)
);

CREATE INDEX IF NOT EXISTS idx_warehouses_factory_id
    ON warehouses(factory_id);

CREATE TABLE IF NOT EXISTS inventory_movements (
    id SERIAL PRIMARY KEY,
    factory_id INTEGER NOT NULL REFERENCES factories(id) ON DELETE RESTRICT,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    movement_type VARCHAR(30) NOT NULL,
    quantity NUMERIC(14,2) NOT NULL,
    reference_type VARCHAR(50) NULL,
    reference_id INTEGER NULL,
    notes TEXT NULL,
    created_by_user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (movement_type IN ('in','out','adjustment'))
);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_factory_id
    ON inventory_movements(factory_id);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_warehouse_id
    ON inventory_movements(warehouse_id);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_product_id
    ON inventory_movements(product_id);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_created_at
    ON inventory_movements(created_at DESC);

DO $$
DECLARE
    has_permissions_table BOOLEAN := FALSE;
    has_name_column BOOLEAN := FALSE;
    has_module_column BOOLEAN := FALSE;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'admin_permissions_catalog'
    )
    INTO has_permissions_table;

    IF has_permissions_table THEN
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'admin_permissions_catalog'
              AND column_name = 'name'
        )
        INTO has_name_column;

        SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'admin_permissions_catalog'
              AND column_name = 'module'
        )
        INTO has_module_column;

        IF has_name_column AND has_module_column THEN
            INSERT INTO admin_permissions_catalog (code, name, module)
            VALUES
                ('warehouses.view', 'Warehouses View', 'inventory'),
                ('warehouses.manage', 'Warehouses Manage', 'inventory'),
                ('inventory.view', 'Inventory View', 'inventory'),
                ('inventory.manage', 'Inventory Manage', 'inventory'),
                ('stock.view', 'Stock View', 'inventory'),
                ('stock.manage', 'Stock Manage', 'inventory')
            ON CONFLICT (code) DO NOTHING;
        ELSIF has_name_column THEN
            INSERT INTO admin_permissions_catalog (code, name)
            VALUES
                ('warehouses.view', 'Warehouses View'),
                ('warehouses.manage', 'Warehouses Manage'),
                ('inventory.view', 'Inventory View'),
                ('inventory.manage', 'Inventory Manage'),
                ('stock.view', 'Stock View'),
                ('stock.manage', 'Stock Manage')
            ON CONFLICT (code) DO NOTHING;
        ELSE
            INSERT INTO admin_permissions_catalog (code)
            VALUES
                ('warehouses.view'),
                ('warehouses.manage'),
                ('inventory.view'),
                ('inventory.manage'),
                ('stock.view'),
                ('stock.manage')
            ON CONFLICT (code) DO NOTHING;
        END IF;
    END IF;
END
$$;

COMMIT;

SELECT
    'WAREHOUSES_TABLE' AS section,
    COUNT(*)::text AS total
FROM warehouses
UNION ALL
SELECT
    'INVENTORY_MOVEMENTS_TABLE' AS section,
    COUNT(*)::text AS total
FROM inventory_movements;
