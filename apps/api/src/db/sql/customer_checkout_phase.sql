ALTER TABLE users
ADD COLUMN IF NOT EXISTS phone VARCHAR(50);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'uq_users_phone'
    ) THEN
        ALTER TABLE users
        ADD CONSTRAINT uq_users_phone UNIQUE (phone);
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS customer_profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    governorate VARCHAR(100),
    city VARCHAR(100),
    address_line TEXT,
    address_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO customer_profiles (user_id, created_at, updated_at)
SELECT u.id, NOW(), NOW()
FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM customer_profiles cp WHERE cp.user_id = u.id
);
