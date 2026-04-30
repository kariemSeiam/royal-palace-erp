BEGIN;

ALTER TABLE customer_orders
ADD COLUMN IF NOT EXISTS warehouse_id INTEGER;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'customer_orders_warehouse_id_fkey'
    ) THEN
        ALTER TABLE customer_orders
        ADD CONSTRAINT customer_orders_warehouse_id_fkey
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_customer_orders_warehouse_id
ON customer_orders (warehouse_id);

WITH default_warehouse_per_factory AS (
    SELECT DISTINCT ON (w.factory_id)
        w.factory_id,
        w.id AS warehouse_id
    FROM warehouses w
    WHERE w.is_active = TRUE
    ORDER BY w.factory_id, w.id ASC
)
UPDATE customer_orders co
SET warehouse_id = d.warehouse_id
FROM default_warehouse_per_factory d
WHERE co.factory_id = d.factory_id
  AND co.factory_id IS NOT NULL
  AND co.warehouse_id IS NULL;

COMMIT;

SELECT
    co.id,
    co.order_number,
    co.factory_id,
    co.warehouse_id
FROM customer_orders co
ORDER BY co.id;
