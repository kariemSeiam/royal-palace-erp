INSERT INTO inventory_movements (
    factory_id,
    warehouse_id,
    product_id,
    movement_type,
    quantity,
    reference_type,
    reference_id,
    notes
)
VALUES
    (2, 1, 1, 'in', 25, 'manual', NULL, 'initial stock smoke test'),
    (2, 1, 1, 'out', 3, 'manual', NULL, 'manual issue smoke test');

SELECT
    factory_id,
    warehouse_id,
    product_id,
    movement_type,
    quantity,
    notes
FROM inventory_movements
ORDER BY id DESC
LIMIT 10;

SELECT
    factory_id,
    warehouse_id,
    product_id,
    current_stock
FROM inventory_stock_summary
ORDER BY warehouse_id, product_id;
