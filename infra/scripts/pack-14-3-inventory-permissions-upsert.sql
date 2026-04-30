DO $$
DECLARE
    has_name boolean;
    has_display_name boolean;
    has_description boolean;
    has_module boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'admin_permissions_catalog'
          AND column_name = 'name'
    ) INTO has_name;

    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'admin_permissions_catalog'
          AND column_name = 'display_name'
    ) INTO has_display_name;

    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'admin_permissions_catalog'
          AND column_name = 'description'
    ) INTO has_description;

    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'admin_permissions_catalog'
          AND column_name = 'module'
    ) INTO has_module;

    IF has_name AND has_module AND has_description THEN
        INSERT INTO admin_permissions_catalog (code, name, module, description)
        VALUES
            ('warehouses.view', 'Warehouses View', 'inventory', 'View warehouses'),
            ('warehouses.manage', 'Warehouses Manage', 'inventory', 'Manage warehouses'),
            ('inventory.view', 'Inventory View', 'inventory', 'View inventory movements and stock'),
            ('inventory.manage', 'Inventory Manage', 'inventory', 'Manage inventory movements'),
            ('stock.view', 'Stock View', 'inventory', 'View stock summaries'),
            ('stock.manage', 'Stock Manage', 'inventory', 'Manage stock operations')
        ON CONFLICT (code) DO NOTHING;

    ELSIF has_name AND has_module THEN
        INSERT INTO admin_permissions_catalog (code, name, module)
        VALUES
            ('warehouses.view', 'Warehouses View', 'inventory'),
            ('warehouses.manage', 'Warehouses Manage', 'inventory'),
            ('inventory.view', 'Inventory View', 'inventory'),
            ('inventory.manage', 'Inventory Manage', 'inventory'),
            ('stock.view', 'Stock View', 'inventory'),
            ('stock.manage', 'Stock Manage', 'inventory')
        ON CONFLICT (code) DO NOTHING;

    ELSIF has_display_name AND has_module AND has_description THEN
        INSERT INTO admin_permissions_catalog (code, display_name, module, description)
        VALUES
            ('warehouses.view', 'Warehouses View', 'inventory', 'View warehouses'),
            ('warehouses.manage', 'Warehouses Manage', 'inventory', 'Manage warehouses'),
            ('inventory.view', 'Inventory View', 'inventory', 'View inventory movements and stock'),
            ('inventory.manage', 'Inventory Manage', 'inventory', 'Manage inventory movements'),
            ('stock.view', 'Stock View', 'inventory', 'View stock summaries'),
            ('stock.manage', 'Stock Manage', 'inventory', 'Manage stock operations')
        ON CONFLICT (code) DO NOTHING;

    ELSIF has_display_name AND has_module THEN
        INSERT INTO admin_permissions_catalog (code, display_name, module)
        VALUES
            ('warehouses.view', 'Warehouses View', 'inventory'),
            ('warehouses.manage', 'Warehouses Manage', 'inventory'),
            ('inventory.view', 'Inventory View', 'inventory'),
            ('inventory.manage', 'Inventory Manage', 'inventory'),
            ('stock.view', 'Stock View', 'inventory'),
            ('stock.manage', 'Stock Manage', 'inventory')
        ON CONFLICT (code) DO NOTHING;

    ELSIF has_name THEN
        INSERT INTO admin_permissions_catalog (code, name)
        VALUES
            ('warehouses.view', 'Warehouses View'),
            ('warehouses.manage', 'Warehouses Manage'),
            ('inventory.view', 'Inventory View'),
            ('inventory.manage', 'Inventory Manage'),
            ('stock.view', 'Stock View'),
            ('stock.manage', 'Stock Manage')
        ON CONFLICT (code) DO NOTHING;

    ELSIF has_display_name THEN
        INSERT INTO admin_permissions_catalog (code, display_name)
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
END
$$;

SELECT code
FROM admin_permissions_catalog
WHERE code IN (
    'warehouses.view',
    'warehouses.manage',
    'inventory.view',
    'inventory.manage',
    'stock.view',
    'stock.manage'
)
ORDER BY code;
