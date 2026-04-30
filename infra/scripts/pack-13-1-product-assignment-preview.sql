-- REVIEW FIRST, THEN EXECUTE ONLY IF CORRECT

-- Royal Palace Furniture Factory
UPDATE products SET factory_id = 2 WHERE id IN (1, 2, 3, 4);

-- Cloud Bed Factory
UPDATE products SET factory_id = 3 WHERE id IN (6);

-- Verify
SELECT id, name_ar, sku, factory_id
FROM products
ORDER BY id;
