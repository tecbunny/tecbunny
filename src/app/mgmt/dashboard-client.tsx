'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

import { 
  Shield, 
  ShoppingCart, 
  BarChart3, 
  CreditCard,
  ArrowRight,
  Lock
} from 'lucide-react';

import { useAuth } from '@/lib/hooks';
import { isAtLeast } from '@/lib/roles';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function ManagementDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Single redirect effect - only run once when loading completes
  React.useEffect(() => {
    if (!loading && !user) {
      router.replace('/staff/login'); // CRM portal — staff login only
      return;
    }
    
    // Redirect to role-specific dashboard if user is authenticated
    if (!loading && user) {
      let redirectPath: string;
      
      switch (user.role) {
        case 'admin':
          redirectPath = '/mgmt/admin';
          break;
        case 'manager':
          redirectPath = '/mgmt/manager';
          break;
        case 'sales':
        case 'service_engineer':
          redirectPath = '/mgmt/sales';
          break;
        case 'sales-staff':
          redirectPath = '/mgmt/sales-staff';
          break;
        case 'sales-external':
          redirectPath = '/mgmt/sales-external';
          break;
        case 'accounts':
          redirectPath = '/mgmt/accounts';
          break;
        default:
          redirectPath = '/'; // Customers go to homepage
          break;
      }
      
      router.replace(redirectPath);
      return;
    }
  }, [loading, user, router]);

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="container mx-auto px-6 pb-16 pt-12">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-slate-600">Loading dashboard...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show access denied if no user (should redirect, but just in case)
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="container mx-auto px-6 pb-16 pt-12">
          <div className="max-w-md mx-auto text-center">
            <Lock className="h-16 w-16 text-slate-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-4 text-slate-900">Access Denied</h1>
            <p className="text-slate-600 mb-6">
              You need to be logged in to access the management dashboard.
            </p>
            <Button onClick={() => router.push('/auth/signin')}>
              Go to Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const role = user?.role || 'customer';
  const isAdmin = isAtLeast(role, 'admin');
  const isSales = role === 'sales' || isAtLeast(role, 'manager');
  const isAccountant = role === 'accounts' || isAtLeast(role, 'manager');

  const managementModules = [
    {
      title: 'Admin Panel',
      description: 'Complete system administration and settings',
      icon: Shield,
      href: '/mgmt/admin',
      color: 'text-red-600 bg-red-50',
      available: isAdmin,
      restricted: !isAdmin
    },
    {
      title: 'Sales Management',
      description: 'Orders, products, and sales operations',
      icon: ShoppingCart,
      href: '/mgmt/sales',
      color: 'text-blue-600 bg-blue-50',
      available: isSales || isAdmin,
      restricted: !(isSales || isAdmin)
    },
    {
      title: 'Accounts & Finance',
      description: 'Financial reports and accounting',
      icon: CreditCard,
      href: '/mgmt/accounts',
      color: 'text-green-600 bg-green-50',
      available: isAccountant || isAdmin,
      restricted: !(isAccountant || isAdmin)
    }
  ];

  const quickActions = [
    {
      title: 'View Orders',
      description: 'Check recent orders',
      href: '/mgmt/sales/orders',
      available: isSales || isAdmin
    },
    {
      title: 'Add Products',
      description: 'Add new inventory',
      href: '/mgmt/sales/products/new',
      available: isSales || isAdmin
    },
    {
      title: 'User Management',
      description: 'Manage system users',
      href: '/mgmt/admin/users',
      available: isAdmin
    },
    {
      title: 'System Settings',
      description: 'Configure application',
      href: '/mgmt/admin/settings',
      available: isAdmin
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-6 pb-16 pt-12">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 text-slate-900">Management Dashboard</h1>
          <p className="text-lg text-slate-600">
            Welcome back, {user?.name || user?.email}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-sm px-2 py-1 bg-blue-100 text-blue-700 rounded-full capitalize">
              {user?.role || 'User'}
            </span>
          </div>
        </div>

        {/* Management Modules */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {managementModules.map((module) => {
            const IconComponent = module.icon;
            return (
              <Card 
                key={module.href} 
                className={`relative ${module.restricted ? 'opacity-60' : 'hover:shadow-lg transition-shadow cursor-pointer'}`}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className={`p-3 rounded-lg ${module.color}`}>
                      <IconComponent className="h-6 w-6" />
                    </div>
                    {module.restricted && (
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <CardTitle className="text-xl">{module.title}</CardTitle>
                  <CardDescription>{module.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    className="w-full" 
                    disabled={module.restricted}
                    onClick={() => !module.restricted && router.push(module.href)}
                  >
                    {module.restricted ? 'Access Restricted' : 'Open Dashboard'}
                    {!module.restricted && <ArrowRight className="h-4 w-4 ml-2" />}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Quick Actions</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions
              .filter(action => action.available)
              .map((action) => (
                <Button
                  key={action.href}
                  variant="outline"
                  className="h-auto p-4 flex flex-col items-start text-left"
                  onClick={() => router.push(action.href)}
                >
                  <div className="font-medium mb-1">{action.title}</div>
                  <div className="text-sm text-muted-foreground">{action.description}</div>
                </Button>
              ))}
          </div>
        </div>

        {/* System Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              System Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">Online</div>
                <div className="text-sm text-muted-foreground">System Status</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{user?.role || 'User'}</div>
                <div className="text-sm text-muted-foreground">Your Access Level</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">Active</div>
                <div className="text-sm text-muted-foreground">Session Status</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  );
}
