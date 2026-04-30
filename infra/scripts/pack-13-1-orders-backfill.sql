WITH order_factory_candidates AS (
  SELECT
    co.id AS order_id,
    MIN(p.factory_id) AS candidate_factory_id,
    COUNT(DISTINCT p.factory_id) FILTER (WHERE p.factory_id IS NOT NULL) AS distinct_factory_count
  FROM customer_orders co
  LEFT JOIN customer_order_items coi ON coi.order_id = co.id
  LEFT JOIN products p ON p.id = coi.product_id
  GROUP BY co.id
)
UPDATE customer_orders co
SET factory_id = ofc.candidate_factory_id
FROM order_factory_candidates ofc
WHERE co.id = ofc.order_id
  AND ofc.distinct_factory_count = 1
  AND co.factory_id IS NULL;

SELECT
  co.id,
  co.order_number,
  co.customer_name,
  COUNT(DISTINCT p.factory_id) FILTER (WHERE p.factory_id IS NOT NULL) AS distinct_factories
FROM customer_orders co
LEFT JOIN customer_order_items coi ON coi.order_id = co.id
LEFT JOIN products p ON p.id = coi.product_id
GROUP BY co.id, co.order_number, co.customer_name
HAVING COUNT(DISTINCT p.factory_id) FILTER (WHERE p.factory_id IS NOT NULL) > 1
ORDER BY co.id;

SELECT id, order_number, customer_name, factory_id
FROM customer_orders
ORDER BY id;
