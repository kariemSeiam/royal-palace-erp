CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    description TEXT NULL,
    is_system BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(150) NOT NULL UNIQUE,
    module VARCHAR(100) NOT NULL,
    action VARCHAR(100) NOT NULL,
    scope VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT NULL,
    is_system BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT permissions_scope_chk CHECK (scope IN ('group', 'factory', 'department', 'self'))
);

CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    scope_type VARCHAR(50) NOT NULL DEFAULT 'group',
    factory_id UUID NULL,
    department_id UUID NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    assigned_by UUID NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT user_roles_scope_type_chk CHECK (scope_type IN ('group', 'factory', 'department', 'self')),
    CONSTRAINT user_roles_scope_guard_chk CHECK (
        (scope_type = 'group' AND factory_id IS NULL AND department_id IS NULL)
        OR
        (scope_type = 'factory' AND factory_id IS NOT NULL)
        OR
        (scope_type = 'department' AND factory_id IS NOT NULL AND department_id IS NOT NULL)
        OR
        (scope_type = 'self')
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_roles_active_scope
ON user_roles(user_id, role_id, scope_type, COALESCE(factory_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(department_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE INDEX IF NOT EXISTS ix_roles_code ON roles(code);
CREATE INDEX IF NOT EXISTS ix_permissions_code ON permissions(code);
CREATE INDEX IF NOT EXISTS ix_permissions_module ON permissions(module);
CREATE INDEX IF NOT EXISTS ix_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS ix_user_roles_role_id ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS ix_user_roles_factory_id ON user_roles(factory_id);
CREATE INDEX IF NOT EXISTS ix_user_roles_department_id ON user_roles(department_id);
CREATE INDEX IF NOT EXISTS ix_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS ix_role_permissions_permission_id ON role_permissions(permission_id);

INSERT INTO roles (code, name, description, is_system, is_active)
VALUES
('super_admin', 'Super Admin', 'Full enterprise-wide access across all factories and modules', TRUE, TRUE),
('group_admin', 'Group Admin', 'Group-level operational administration', TRUE, TRUE),
('factory_admin', 'Factory Admin', 'Factory-wide management and reporting access', TRUE, TRUE),
('hr_manager', 'HR Manager', 'HR, employees, attendance and payroll operations', TRUE, TRUE),
('production_manager', 'Production Manager', 'Production, lines, machines and workflow operations', TRUE, TRUE),
('warehouse_manager', 'Warehouse Manager', 'Warehouses, stock movement and inventory control', TRUE, TRUE),
('sales_manager', 'Sales Manager', 'Orders, quotations, B2B/B2C sales operations', TRUE, TRUE),
('finance_manager', 'Finance Manager', 'Payments, profitability, VAT and reporting', TRUE, TRUE),
('department_supervisor', 'Department Supervisor', 'Department-scoped operational supervision', TRUE, TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (code, module, action, scope, name, description, is_system, is_active)
VALUES
('users.read', 'users', 'read', 'group', 'Read Users', 'View users', TRUE, TRUE),
('users.create', 'users', 'create', 'group', 'Create Users', 'Create users', TRUE, TRUE),
('users.update', 'users', 'update', 'group', 'Update Users', 'Update users', TRUE, TRUE),
('users.assign_roles', 'users', 'assign_roles', 'group', 'Assign User Roles', 'Assign roles to users', TRUE, TRUE),
('users.view', 'users', 'view', 'group', 'View Users', 'Legacy alias for viewing users', TRUE, TRUE),
('users.manage', 'users', 'manage', 'group', 'Manage Users', 'Legacy alias for managing users', TRUE, TRUE),

('roles.read', 'roles', 'read', 'group', 'Read Roles', 'View roles', TRUE, TRUE),
('roles.create', 'roles', 'create', 'group', 'Create Roles', 'Create roles', TRUE, TRUE),
('roles.update', 'roles', 'update', 'group', 'Update Roles', 'Update roles', TRUE, TRUE),
('roles.assign_permissions', 'roles', 'assign_permissions', 'group', 'Assign Role Permissions', 'Attach permissions to roles', TRUE, TRUE),
('roles.view', 'roles', 'view', 'group', 'View Roles', 'Legacy alias for viewing roles', TRUE, TRUE),
('roles.manage', 'roles', 'manage', 'group', 'Manage Roles', 'Legacy alias for managing roles', TRUE, TRUE),

('factories.read', 'factories', 'read', 'group', 'Read Factories', 'View factories', TRUE, TRUE),
('factories.view', 'factories', 'view', 'group', 'View Factories', 'Legacy alias for viewing factories', TRUE, TRUE),
('factories.manage', 'factories', 'manage', 'group', 'Manage Factories', 'Legacy alias for managing factories', TRUE, TRUE),

('departments.read', 'departments', 'read', 'factory', 'Read Departments', 'View departments', TRUE, TRUE),
('departments.view', 'departments', 'view', 'factory', 'View Departments', 'Legacy alias for viewing departments', TRUE, TRUE),
('departments.manage', 'departments', 'manage', 'factory', 'Manage Departments', 'Legacy alias for managing departments', TRUE, TRUE),

('employees.read', 'employees', 'read', 'factory', 'Read Employees', 'View employees', TRUE, TRUE),
('employees.create', 'employees', 'create', 'factory', 'Create Employees', 'Create employees', TRUE, TRUE),
('employees.update', 'employees', 'update', 'factory', 'Update Employees', 'Update employees', TRUE, TRUE),
('employees.view', 'employees', 'view', 'factory', 'View Employees', 'Legacy alias for viewing employees', TRUE, TRUE),
('employees.manage', 'employees', 'manage', 'factory', 'Manage Employees', 'Legacy alias for managing employees', TRUE, TRUE),

('attendance.read', 'attendance', 'read', 'factory', 'Read Attendance', 'View attendance', TRUE, TRUE),
('attendance.review', 'attendance', 'review', 'factory', 'Review Attendance', 'Approve/review attendance anomalies', TRUE, TRUE),
('attendance.view', 'attendance', 'view', 'factory', 'View Attendance', 'Legacy alias for viewing attendance', TRUE, TRUE),
('attendance.manage', 'attendance', 'manage', 'factory', 'Manage Attendance', 'Legacy alias for managing attendance', TRUE, TRUE),

('employee_leaves.read', 'employee_leaves', 'read', 'factory', 'Read Employee Leaves', 'View employee leaves', TRUE, TRUE),
('employee_leaves.create', 'employee_leaves', 'create', 'factory', 'Create Employee Leaves', 'Create employee leaves', TRUE, TRUE),
('employee_leaves.update', 'employee_leaves', 'update', 'factory', 'Update Employee Leaves', 'Update employee leaves', TRUE, TRUE),
('employee_leaves.view', 'employee_leaves', 'view', 'factory', 'View Employee Leaves', 'Legacy alias for viewing employee leaves', TRUE, TRUE),
('employee_leaves.manage', 'employee_leaves', 'manage', 'factory', 'Manage Employee Leaves', 'Legacy alias for managing employee leaves', TRUE, TRUE),

('employee_evaluations.read', 'employee_evaluations', 'read', 'factory', 'Read Employee Evaluations', 'View employee evaluations', TRUE, TRUE),
('employee_evaluations.create', 'employee_evaluations', 'create', 'factory', 'Create Employee Evaluations', 'Create employee evaluations', TRUE, TRUE),
('employee_evaluations.update', 'employee_evaluations', 'update', 'factory', 'Update Employee Evaluations', 'Update employee evaluations', TRUE, TRUE),
('employee_evaluations.view', 'employee_evaluations', 'view', 'factory', 'View Employee Evaluations', 'Legacy alias for viewing employee evaluations', TRUE, TRUE),
('employee_evaluations.manage', 'employee_evaluations', 'manage', 'factory', 'Manage Employee Evaluations', 'Legacy alias for managing employee evaluations', TRUE, TRUE),

('employee_compensations.read', 'employee_compensations', 'read', 'factory', 'Read Employee Compensations', 'View employee compensations', TRUE, TRUE),
('employee_compensations.create', 'employee_compensations', 'create', 'factory', 'Create Employee Compensations', 'Create employee compensations', TRUE, TRUE),
('employee_compensations.update', 'employee_compensations', 'update', 'factory', 'Update Employee Compensations', 'Update employee compensations', TRUE, TRUE),
('employee_compensations.view', 'employee_compensations', 'view', 'factory', 'View Employee Compensations', 'Legacy alias for viewing employee compensations', TRUE, TRUE),
('employee_compensations.manage', 'employee_compensations', 'manage', 'factory', 'Manage Employee Compensations', 'Legacy alias for managing employee compensations', TRUE, TRUE),

('payroll.read', 'payroll', 'read', 'factory', 'Read Payroll', 'View payroll runs and slips', TRUE, TRUE),
('payroll.generate', 'payroll', 'generate', 'factory', 'Generate Payroll', 'Generate payroll runs', TRUE, TRUE),
('payroll.mark_paid', 'payroll', 'mark_paid', 'factory', 'Mark Payroll Paid', 'Mark payroll receipt as paid', TRUE, TRUE),
('payroll.view', 'payroll', 'view', 'factory', 'View Payroll', 'Legacy alias for viewing payroll', TRUE, TRUE),
('payroll.manage', 'payroll', 'manage', 'factory', 'Manage Payroll', 'Legacy alias for managing payroll', TRUE, TRUE),

('hr.read', 'hr', 'read', 'factory', 'Read HR Module', 'Umbrella read access for HR pages', TRUE, TRUE),
('hr.manage', 'hr', 'manage', 'factory', 'Manage HR Module', 'Umbrella manage access for HR pages', TRUE, TRUE),

('warehouses.read', 'warehouses', 'read', 'factory', 'Read Warehouses', 'View warehouses', TRUE, TRUE),
('warehouses.view', 'warehouses', 'view', 'factory', 'View Warehouses', 'Legacy alias for viewing warehouses', TRUE, TRUE),
('warehouses.manage', 'warehouses', 'manage', 'factory', 'Manage Warehouses', 'Legacy alias for managing warehouses', TRUE, TRUE),

('inventory.read', 'inventory', 'read', 'factory', 'Read Inventory', 'View inventory', TRUE, TRUE),
('inventory.adjust', 'inventory', 'adjust', 'factory', 'Adjust Inventory', 'Adjust stock quantities', TRUE, TRUE),
('inventory.view', 'inventory', 'view', 'factory', 'View Inventory', 'Legacy alias for viewing inventory', TRUE, TRUE),
('inventory.manage', 'inventory', 'manage', 'factory', 'Legacy alias for managing inventory', TRUE, TRUE),
('stock.view', 'stock', 'view', 'factory', 'View Stock', 'Legacy stock view alias', TRUE, TRUE),
('stock.manage', 'stock', 'manage', 'factory', 'Manage Stock', 'Legacy stock manage alias', TRUE, TRUE),

('products.read', 'products', 'read', 'group', 'Read Products', 'View products', TRUE, TRUE),
('products.create', 'products', 'create', 'group', 'Create Products', 'Create products', TRUE, TRUE),
('products.update', 'products', 'update', 'group', 'Update Products', 'Update products', TRUE, TRUE),
('products.view', 'products', 'view', 'group', 'View Products', 'Legacy alias for viewing products', TRUE, TRUE),
('products.manage', 'products', 'manage', 'group', 'Manage Products', 'Legacy alias for managing products', TRUE, TRUE),
('catalog.view', 'catalog', 'view', 'group', 'View Catalog', 'Legacy alias for viewing catalog', TRUE, TRUE),
('catalog.manage', 'catalog', 'manage', 'group', 'Manage Catalog', 'Legacy alias for managing catalog', TRUE, TRUE),

('orders.read', 'orders', 'read', 'factory', 'Read Orders', 'View orders', TRUE, TRUE),
('orders.create', 'orders', 'create', 'factory', 'Create Orders', 'Create orders', TRUE, TRUE),
('orders.approve', 'orders', 'approve', 'factory', 'Approve Orders', 'Approve orders', TRUE, TRUE),
('orders.view', 'orders', 'view', 'factory', 'View Orders', 'Legacy alias for viewing orders', TRUE, TRUE),
('orders.manage', 'orders', 'manage', 'factory', 'Manage Orders', 'Legacy alias for managing orders', TRUE, TRUE),

('dashboard.read', 'dashboard', 'read', 'group', 'Read Dashboard', 'View executive dashboard', TRUE, TRUE),
('dashboard.view', 'dashboard', 'view', 'group', 'View Dashboard', 'Legacy alias for viewing dashboard', TRUE, TRUE),

('audit_logs.read', 'audit_logs', 'read', 'group', 'Read Audit Logs', 'View audit logs', TRUE, TRUE)
ON CONFLICT (code) DO NOTHING;

WITH super_admin_role AS (
    SELECT id FROM roles WHERE code = 'super_admin'
),
all_permissions AS (
    SELECT id FROM permissions
)
INSERT INTO role_permissions (role_id, permission_id)
SELECT super_admin_role.id, all_permissions.id
FROM super_admin_role, all_permissions
ON CONFLICT DO NOTHING;

WITH group_admin_role AS (
    SELECT id FROM roles WHERE code = 'group_admin'
),
group_permissions AS (
    SELECT id FROM permissions
    WHERE code IN (
        'users.read','users.create','users.update','users.assign_roles','users.view','users.manage',
        'roles.read','roles.create','roles.update','roles.assign_permissions','roles.view','roles.manage',
        'factories.read','factories.view','factories.manage',
        'products.read','products.create','products.update','products.view','products.manage',
        'catalog.view','catalog.manage',
        'dashboard.read','dashboard.view','audit_logs.read'
    )
)
INSERT INTO role_permissions (role_id, permission_id)
SELECT group_admin_role.id, group_permissions.id
FROM group_admin_role, group_permissions
ON CONFLICT DO NOTHING;

WITH factory_admin_role AS (
    SELECT id FROM roles WHERE code = 'factory_admin'
),
factory_permissions AS (
    SELECT id FROM permissions
    WHERE code IN (
        'departments.read','departments.view','departments.manage',
        'employees.read','employees.create','employees.update','employees.view','employees.manage',
        'attendance.read','attendance.review','attendance.view','attendance.manage',
        'employee_leaves.read','employee_leaves.view',
        'employee_evaluations.read','employee_evaluations.view',
        'employee_compensations.read','employee_compensations.view',
        'payroll.read','payroll.view',
        'hr.read',
        'warehouses.read','warehouses.view','warehouses.manage',
        'inventory.read','inventory.adjust','inventory.view','inventory.manage','stock.view','stock.manage',
        'orders.read','orders.create','orders.approve','orders.view','orders.manage',
        'dashboard.read','dashboard.view'
    )
)
INSERT INTO role_permissions (role_id, permission_id)
SELECT factory_admin_role.id, factory_permissions.id
FROM factory_admin_role, factory_permissions
ON CONFLICT DO NOTHING;

WITH hr_manager_role AS (
    SELECT id FROM roles WHERE code = 'hr_manager'
),
hr_permissions AS (
    SELECT id FROM permissions
    WHERE code IN (
        'departments.read','departments.view',
        'employees.read','employees.create','employees.update','employees.view','employees.manage',
        'attendance.read','attendance.review','attendance.view','attendance.manage',
        'employee_leaves.read','employee_leaves.create','employee_leaves.update','employee_leaves.view','employee_leaves.manage',
        'employee_evaluations.read','employee_evaluations.create','employee_evaluations.update','employee_evaluations.view','employee_evaluations.manage',
        'employee_compensations.read','employee_compensations.create','employee_compensations.update','employee_compensations.view','employee_compensations.manage',
        'payroll.read','payroll.generate','payroll.mark_paid','payroll.view','payroll.manage',
        'hr.read','hr.manage',
        'dashboard.read','dashboard.view'
    )
)
INSERT INTO role_permissions (role_id, permission_id)
SELECT hr_manager_role.id, hr_permissions.id
FROM hr_manager_role, hr_permissions
ON CONFLICT DO NOTHING;

WITH finance_manager_role AS (
    SELECT id FROM roles WHERE code = 'finance_manager'
),
finance_permissions AS (
    SELECT id FROM permissions
    WHERE code IN (
        'employee_compensations.read','employee_compensations.view',
        'payroll.read','payroll.generate','payroll.mark_paid','payroll.view','payroll.manage',
        'hr.read',
        'dashboard.read','dashboard.view'
    )
)
INSERT INTO role_permissions (role_id, permission_id)
SELECT finance_manager_role.id, finance_permissions.id
FROM finance_manager_role, finance_permissions
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_roles_updated_at ON roles;
CREATE TRIGGER trg_roles_updated_at
BEFORE UPDATE ON roles
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_permissions_updated_at ON permissions;
CREATE TRIGGER trg_permissions_updated_at
BEFORE UPDATE ON permissions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_user_roles_updated_at ON user_roles;
CREATE TRIGGER trg_user_roles_updated_at
BEFORE UPDATE ON user_roles
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
