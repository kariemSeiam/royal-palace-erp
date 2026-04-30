INSERT INTO warehouses (factory_id, code, name, description, is_active)
VALUES
    (2, 'RPF-MAIN', 'المخزن الرئيسي - Royal Palace Furniture', 'المخزن الرئيسي لمصنع الأثاث', TRUE),
    (3, 'CB-MAIN', 'المخزن الرئيسي - Cloud Bed', 'المخزن الرئيسي لمصنع كلاود بد', TRUE)
ON CONFLICT (factory_id, code) DO NOTHING;

SELECT id, factory_id, code, name, is_active
FROM warehouses
ORDER BY id;
