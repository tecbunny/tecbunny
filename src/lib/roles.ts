// Canonical role & permission definitions
// Central source of truth to avoid duplication across server/client.

export const ROLE_HIERARCHY = {
  customer: 1,
  'sales-external': 2,
  sales: 2,
  'sales-staff': 2,
  service_engineer: 2, // lateral to sales
  accounts: 3,
  manager: 4,
  admin: 5,
  superadmin: 6
} as const;

export type UserRole = keyof typeof ROLE_HIERARCHY;
export const ALL_ROLES: UserRole[] = Object.keys(ROLE_HIERARCHY) as UserRole[];

const ROLE_ALIASES: Readonly<Record<string, UserRole>> = {
  super_admin: 'superadmin',
  'super-admin': 'superadmin',
  'super admin': 'superadmin',
  'sales_staff': 'sales-staff',
  'sales staff': 'sales-staff',
  'sales_external': 'sales-external',
  'sales external': 'sales-external'
};

export function normalizeRole(value: unknown): UserRole | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (normalized in ROLE_HIERARCHY) {
    return normalized as UserRole;
  }

  return ROLE_ALIASES[normalized] ?? null;
}

// Master permission catalogue (add granular keys here; keep consistent naming)
export const PERMS = {
  PRODUCT_VIEW: 'product:view',
  PRODUCT_CREATE: 'product:create',
  ORDER_CREATE: 'order:create',
  ORDER_VIEW_SELF: 'order:view:self',
  ORDER_VIEW_ALL: 'order:view:all',
  CUSTOMER_MANAGE: 'customer:manage',
  SERVICE_TICKET_VIEW: 'service:ticket:view',
  SERVICE_TICKET_MANAGE_ASSIGNED: 'service:ticket:manage:assigned',
  SERVICE_TICKET_STATUS_UPDATE: 'service:ticket:status:update',
  SERVICE_TICKET_ADD_PARTS: 'service:ticket:add-parts',
  INVOICE_MANAGE: 'invoice:manage',
  REPORT_VIEW: 'report:view',
  INVENTORY_MANAGE: 'inventory:manage',
  SALES_TEAM_MANAGE: 'sales:team:manage',
  SERVICE_ENGINEER_ASSIGN: 'service:engineer:assign',
  USER_MANAGE: 'user:manage', // Superadmin full access
  USER_MANAGE_CUSTOMER: 'user:manage:customer', // Admin customer-only access
  SETTINGS_MANAGE: 'system:settings', // Superadmin only
  ROLE_MANAGE: 'system:roles', // Superadmin only
  SYSTEM_CONFIG: 'system:config', // Superadmin only
  AUDIT_LOG_VIEW: 'system:audit-logs', // Superadmin only
  AI_ORCHESTRATION: 'system:ai-config' // Superadmin only
} as const;

export type Permission = typeof PERMS[keyof typeof PERMS];

// Base direct permissions per role (without implicit inheritance). Roles inherit previous levels automatically.
const BASE_ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  customer: [
    PERMS.PRODUCT_VIEW,
    PERMS.ORDER_CREATE,
    PERMS.ORDER_VIEW_SELF
  ],
  sales: [
    PERMS.ORDER_VIEW_ALL,
    PERMS.CUSTOMER_MANAGE
  ],
  'sales-staff': [
    PERMS.ORDER_VIEW_ALL,
    PERMS.CUSTOMER_MANAGE
  ],
  'sales-external': [
    PERMS.ORDER_VIEW_ALL,
    PERMS.CUSTOMER_MANAGE
  ],
  service_engineer: [
    PERMS.SERVICE_TICKET_VIEW,
    PERMS.SERVICE_TICKET_MANAGE_ASSIGNED,
    PERMS.SERVICE_TICKET_STATUS_UPDATE,
    PERMS.SERVICE_TICKET_ADD_PARTS
  ],
  accounts: [
    PERMS.INVOICE_MANAGE,
    PERMS.REPORT_VIEW
  ],
  manager: [
    PERMS.INVENTORY_MANAGE,
    PERMS.SALES_TEAM_MANAGE,
    PERMS.SERVICE_ENGINEER_ASSIGN
  ],
  admin: [
    PERMS.USER_MANAGE_CUSTOMER,
    PERMS.REPORT_VIEW // ensure included even if hierarchy shifts
  ],
  superadmin: [
    PERMS.USER_MANAGE,
    PERMS.SETTINGS_MANAGE,
    PERMS.ROLE_MANAGE,
    PERMS.SYSTEM_CONFIG,
    PERMS.AUDIT_LOG_VIEW,
    PERMS.AI_ORCHESTRATION
  ]
};

// Compute inherited permissions (customer < sales < accounts < manager < admin < superadmin)
// service_engineer is a lateral branch at level 2, so it inherits customer but not sales' business perms.
function buildEffectivePermissions(): Record<UserRole, Set<Permission>> {
  const effective: Record<UserRole, Set<Permission>> = {
    customer: new Set(BASE_ROLE_PERMISSIONS.customer),
    sales: new Set(),
    'sales-staff': new Set(),
    'sales-external': new Set(),
    service_engineer: new Set(),
    accounts: new Set(),
    manager: new Set(),
    admin: new Set(),
    superadmin: new Set()
  };

  // Helper to merge
  const addAll = (target: Set<Permission>, list: Permission[]) => list.forEach(p => target.add(p));

  // customer already set
  // sales inherits customer
  addAll(effective.sales, Array.from(effective.customer));
  addAll(effective.sales, BASE_ROLE_PERMISSIONS.sales);

  // sales-staff inherits customer
  addAll(effective['sales-staff'], Array.from(effective.customer));
  addAll(effective['sales-staff'], BASE_ROLE_PERMISSIONS['sales-staff']);

  // sales-external inherits customer
  addAll(effective['sales-external'], Array.from(effective.customer));
  addAll(effective['sales-external'], BASE_ROLE_PERMISSIONS['sales-external']);

  // service_engineer inherits customer only (lateral)
  addAll(effective.service_engineer, Array.from(effective.customer));
  addAll(effective.service_engineer, BASE_ROLE_PERMISSIONS.service_engineer);

  // accounts inherits sales (which already has customer) but NOT service_engineer branch
  addAll(effective.accounts, Array.from(effective.sales));
  addAll(effective.accounts, BASE_ROLE_PERMISSIONS.accounts);

  // manager inherits accounts (+ everything below sales path)
  addAll(effective.manager, Array.from(effective.accounts));
  addAll(effective.manager, BASE_ROLE_PERMISSIONS.manager);

  // admin inherits manager
  addAll(effective.admin, Array.from(effective.manager));
  addAll(effective.admin, BASE_ROLE_PERMISSIONS.admin);

  // superadmin inherits admin
  addAll(effective.superadmin, Array.from(effective.admin));
  addAll(effective.superadmin, BASE_ROLE_PERMISSIONS.superadmin);

  return effective;
}

export const EFFECTIVE_PERMISSIONS = buildEffectivePermissions();

export function isAtLeast(actual: UserRole, required: UserRole) {
  return ROLE_HIERARCHY[actual] >= ROLE_HIERARCHY[required];
}

export function hasPermission(role: UserRole, perm: Permission): boolean {
  return EFFECTIVE_PERMISSIONS[role].has(perm);
}

export const ROLE_DISPLAY_NAME: Record<UserRole, string> = {
  customer: 'Customer',
  sales: 'Sales Representative',
  'sales-staff': 'Sales Staff',
  'sales-external': 'External Sales',
  service_engineer: 'Service Engineer',
  accounts: 'Accounts Manager',
  manager: 'Manager',
  admin: 'Administrator',
  superadmin: 'System Super Administrator'
};

export function getDisplayName(role: UserRole) { return ROLE_DISPLAY_NAME[role]; }
