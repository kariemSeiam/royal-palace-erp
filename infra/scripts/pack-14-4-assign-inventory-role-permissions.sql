INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, p.permission_code
FROM roles r
CROSS JOIN (
    VALUES
        ('warehouses.view'),
        ('warehouses.manage'),
        ('inventory.view'),
        ('inventory.manage'),
        ('stock.view'),
        ('stock.manage')
) AS p(permission_code)
WHERE LOWER(COALESCE(r.code, '')) IN ('admin', 'factory_admin', 'super_admin')
ON CONFLICT (role_id, permission_code) DO NOTHING;

SELECT
    r.id,
    r.code,
    rp.permission_code
FROM role_permissions rp
JOIN roles r ON r.id = rp.role_id
WHERE rp.permission_code IN (
    'warehouses.view',
    'warehouses.manage',
    'inventory.view',
    'inventory.manage',
    'stock.view',
    'stock.manage'
)
ORDER BY r.id, rp.permission_code;
