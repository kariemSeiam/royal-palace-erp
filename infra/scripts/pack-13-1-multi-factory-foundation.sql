BEGIN;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS factory_id INTEGER;

ALTER TABLE customer_orders
  ADD COLUMN IF NOT EXISTS factory_id INTEGER;

ALTER TABLE business_accounts
  ADD COLUMN IF NOT EXISTS factory_id INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'products_factory_id_fkey'
      AND table_name = 'products'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_factory_id_fkey
      FOREIGN KEY (factory_id) REFERENCES factories(id) ON DELETE RESTRICT;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'customer_orders_factory_id_fkey'
      AND table_name = 'customer_orders'
  ) THEN
    ALTER TABLE customer_orders
      ADD CONSTRAINT customer_orders_factory_id_fkey
      FOREIGN KEY (factory_id) REFERENCES factories(id) ON DELETE RESTRICT;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'business_accounts_factory_id_fkey'
      AND table_name = 'business_accounts'
  ) THEN
    ALTER TABLE business_accounts
      ADD CONSTRAINT business_accounts_factory_id_fkey
      FOREIGN KEY (factory_id) REFERENCES factories(id) ON DELETE RESTRICT;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_products_factory_id ON products(factory_id);
CREATE INDEX IF NOT EXISTS idx_customer_orders_factory_id ON customer_orders(factory_id);
CREATE INDEX IF NOT EXISTS idx_business_accounts_factory_id ON business_accounts(factory_id);

COMMIT;
