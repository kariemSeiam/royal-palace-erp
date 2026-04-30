INSERT INTO customer_orders (
    order_number,
    user_id,
    business_account_id,
    order_type,
    status,
    payment_status,
    subtotal_amount,
    vat_amount,
    total_amount,
    customer_name,
    customer_phone,
    shipping_address,
    notes,
    factory_id,
    warehouse_id
)
VALUES (
    'ORD-DISPATCH-SMOKE-001',
    NULL,
    NULL,
    'b2c',
    'order_received',
    'pending',
    1000.00,
    140.00,
    1140.00,
    'Dispatch Smoke Test',
    '01000000000',
    'Test Address',
    'Dispatch smoke test order',
    2,
    1
)
ON CONFLICT (order_number) DO NOTHING;

INSERT INTO customer_order_items (
    order_id,
    product_id,
    quantity,
    unit_price,
    line_total
)
SELECT
    co.id,
    1,
    2,
    500.00,
    1000.00
FROM customer_orders co
WHERE co.order_number = 'ORD-DISPATCH-SMOKE-001'
  AND NOT EXISTS (
    SELECT 1
    FROM customer_order_items coi
    WHERE coi.order_id = co.id
      AND coi.product_id = 1
  );

SELECT
    co.id,
    co.order_number,
    co.status,
    co.factory_id,
    co.warehouse_id
FROM customer_orders co
WHERE co.order_number = 'ORD-DISPATCH-SMOKE-001';

SELECT
    coi.id,
    coi.order_id,
    coi.product_id,
    coi.quantity,
    coi.unit_price,
    coi.line_total
FROM customer_order_items coi
JOIN customer_orders co ON co.id = coi.order_id
WHERE co.order_number = 'ORD-DISPATCH-SMOKE-001';
