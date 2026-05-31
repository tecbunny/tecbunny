import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

// Create client for current user authentication
async function createAuthenticatedClient(_: NextRequest) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return { supabase, session };
}

// GET /api/roles - Get available user roles
export async function GET(request: NextRequest) {
  try {
    const { supabase, session } = await createAuthenticatedClient(request);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has access to role management
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (!profile || !['admin', 'manager'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Define available roles with their permissions
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

    // Filter roles based on requesting user's level
    let availableRoles = roles;
    if (profile.role !== 'admin') {
      // Managers can only assign roles lower than their own
      const userLevel = roles.find(r => r.id === profile.role)?.level || 1;
      availableRoles = roles.filter(r => r.level < userLevel);
    }

    return NextResponse.json({
      roles: availableRoles,
      total: availableRoles.length
    });

  } catch (error) {
    logger.error('Error in GET /api/roles:', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/roles - Create custom role (admin only)
export async function POST(request: NextRequest) {
  try {
    const { supabase, session } = await createAuthenticatedClient(request);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // For now, return method not implemented as we're using predefined roles
    return NextResponse.json({ 
      error: 'Custom role creation not implemented. Use predefined roles.' 
    }, { status: 501 });

  } catch (error) {
    logger.error('Error in POST /api/roles:', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
