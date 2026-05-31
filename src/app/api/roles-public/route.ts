import { NextRequest, NextResponse } from 'next/server';

// GET /api/roles-public - Get available user roles (public endpoint for UI)
export async function GET(_: NextRequest) {
  try {
    // Define available roles with their permissions (this is static data)
    const roles = [
      {
        id: 'customer',
        name: 'Customer',
        description: 'Regular customer with basic access',
        permissions: ['view_products', 'place_orders', 'view_own_orders'],
        level: 1
      },
      {
        id: 'sales',
        name: 'Sales Representative',
        description: 'Sales team member with customer management access',
        permissions: ['view_products', 'place_orders', 'view_all_orders', 'manage_customers'],
        level: 2
      },
      {
        id: 'accounts',
        name: 'Accounts Manager',
        description: 'Financial operations and reporting access',
        permissions: ['view_products', 'place_orders', 'view_all_orders', 'manage_customers', 'manage_invoices', 'view_reports'],
        level: 3
      },
      {
        id: 'manager',
        name: 'Manager',
        description: 'Department manager with team oversight',
        permissions: ['view_products', 'place_orders', 'view_all_orders', 'manage_customers', 'manage_invoices', 'view_reports', 'manage_inventory', 'manage_sales_team'],
        level: 4
      },
      {
        id: 'admin',
        name: 'Administrator',
        description: 'Full system access and user management',
        permissions: ['all_permissions', 'manage_users', 'manage_settings', 'system_admin'],
        level: 5
      }
    ];

    return NextResponse.json({
      roles,
      total: roles.length,
      message: 'Roles retrieved successfully'
    });

  } catch (error) {
    console.error('Error in GET /api/roles-public:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
