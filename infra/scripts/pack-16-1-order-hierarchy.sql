BEGIN;

ALTER TABLE customer_orders
ADD COLUMN IF NOT EXISTS parent_order_id INTEGER NULL REFERENCES customer_orders(id) ON DELETE SET NULL;

ALTER TABLE customer_orders
ADD COLUMN IF NOT EXISTS is_master_order BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_customer_orders_parent_order_id
ON customer_orders(parent_order_id);

CREATE INDEX IF NOT EXISTS idx_customer_orders_is_master_order
ON customer_orders(is_master_order);

COMMIT;

SELECT
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'customer_orders'
  AND column_name IN ('parent_order_id', 'is_master_order')
ORDER BY column_name;
