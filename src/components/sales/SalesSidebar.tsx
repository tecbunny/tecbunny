
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  LayoutDashboard,
  LogOut,
  User,
  Zap,
  FileSearch,
  History,
  PackageCheck,
  ShoppingBag,
  Package,
  Archive,
  Receipt,
  PackageSearch,
} from 'lucide-react';

import { logger } from '@/lib/logger';

import { Logo } from '@/components/ui/logo';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/hooks';
import { MgmtMobileNav } from '@/components/mgmt/MgmtMobileNav';

const navItems = [
  { href: '/mgmt/sales', label: 'Dashboard', icon: LayoutDashboard, roles: ['sales', 'manager'], exact: true },
  { href: '/mgmt/sales/quick-billing', label: 'Quick Billing', icon: Zap, roles: ['sales', 'manager'] },
  { href: '/mgmt/sales/agent-order', label: 'Agent Order', icon: ShoppingBag, roles: ['sales', 'manager'] },
  { href: '/mgmt/sales/orders', label: 'Pickup Orders', icon: ShoppingBag, roles: ['sales', 'manager'] },
  { href: '/mgmt/sales/online-orders', label: 'Online Orders', icon: PackageCheck, roles: ['sales', 'manager'] },
  { href: '/mgmt/sales/products', label: 'Product Management', icon: Package, roles: ['manager'] },
  { href: '/mgmt/sales/inventory', label: 'Inventory', icon: PackageSearch, roles: ['manager'] },
  { href: '/mgmt/sales/purchase-entry', label: 'Purchase Entry', icon: Archive, roles: ['manager'] },
  { href: '/mgmt/sales/invoice-lookup', label: 'Invoice Lookup', icon: FileSearch, roles: ['sales', 'manager'] },
  { href: '/mgmt/sales/history', label: 'Billing History', icon: History, roles: ['sales', 'manager'] },
  { href: '/mgmt/sales/expenses', label: 'Expense Entry', icon: Receipt, roles: ['sales', 'manager'] },
];

export function SalesSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      // The AuthProvider logout function now handles the redirect
    } catch (error) {
      logger.error('Logout error', { error });
      // Emergency fallback: force redirect even if logout failed
      window.location.href = '/staff/login';
    }
  };

  const accessibleNavItems = navItems.filter(item => user && item.roles.includes(user.role));
  const mobileSections = [{ title: 'Sales', items: accessibleNavItems }];

  return (
    <>
    <MgmtMobileNav title="Sales" sections={mobileSections} />
    <aside className="hidden w-64 flex-col border-r bg-background p-4 sm:flex">
      <div className="flex items-center gap-2 mb-8">
        <Logo className="h-8 w-8 text-primary" />
        <span className="text-xl font-bold">TecBunny</span>
      </div>

      <nav className="flex-1 space-y-2">
        {accessibleNavItems.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary',
               (item.exact ? (pathname === item.href) : (pathname.startsWith(item.href))) ? 'bg-muted text-primary' : ''
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </nav>
      
      <div className="mt-auto">
         <div className="flex items-center gap-2 p-2 rounded-lg bg-muted">
            <User className="h-8 w-8 text-primary"/>
            <div>
                <p className="text-sm font-semibold">{user?.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{user?.role} Staff</p>
            </div>
         </div>
         <Button variant="ghost" className="w-full justify-start gap-3 mt-2" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Logout
         </Button>
      </div>
    </aside>
    </>
  );
}