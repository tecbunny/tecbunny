'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import {
  LayoutDashboard,
  LogOut,
  User,
  Users,
  Zap,
  FileSearch,
  PackageCheck,
  ShoppingBag,
  Package,
  Archive,
  BarChart2,
} from 'lucide-react';

import { logger } from '@/lib/logger';
import { Logo } from '@/components/ui/logo';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/hooks';
import { MgmtMobileNav } from '@/components/mgmt/MgmtMobileNav';

const navItems = [
  { href: '/mgmt/manager', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/mgmt/manager/salesperson', label: 'Salesperson Management', icon: Users },
  { href: '/mgmt/manager/quick-billing', label: 'Quick Billing', icon: Zap },
  { href: '/mgmt/manager/online-orders', label: 'Online Orders', icon: PackageCheck },
  { href: '/mgmt/manager/inventory', label: 'Inventory', icon: Package },
  { href: '/mgmt/manager/purchase', label: 'Purchase Entry', icon: Archive },
  { href: '/mgmt/manager/invoice-lookup', label: 'Invoice Lookup', icon: FileSearch },
  { href: '/mgmt/manager/reports', label: 'Reports', icon: BarChart2 },
];

export const managerNavSections = [{ title: 'Manager', items: navItems }];

export function ManagerSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      logger.error('Logout error', { error });
      window.location.href = '/staff/login';
    }
  };

  return (
    <>
    <MgmtMobileNav title="Manager" sections={managerNavSections} />
    <aside className="hidden w-64 flex-col border-r bg-background p-4 sm:flex min-h-screen">
      <div className="flex items-center gap-2 mb-8">
        <Logo className="h-8 w-8 text-primary" />
        <span className="text-xl font-bold">TecBunny</span>
      </div>

      <nav className="flex-1 space-y-2">
        {navItems.map((item) => (
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
                <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
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
