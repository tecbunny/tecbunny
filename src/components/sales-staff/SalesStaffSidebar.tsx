'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  LayoutDashboard,
  LogOut,
  User,
  Zap,
  FileSearch,
  ShoppingBag,
  BarChart2,
} from 'lucide-react';

import { logger } from '@/lib/logger';
import { Logo } from '@/components/ui/logo';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/hooks';
import { MgmtMobileNav } from '@/components/mgmt/MgmtMobileNav';

const navItems = [
  { href: '/mgmt/sales-staff', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/mgmt/sales-staff/quick-billing', label: 'Quick Billing', icon: Zap },
  { href: '/mgmt/sales-staff/order-tracking', label: 'Order Tracking', icon: ShoppingBag },
  { href: '/mgmt/sales-staff/invoice-lookup', label: 'Invoice Lookup', icon: FileSearch },
  { href: '/mgmt/sales-staff/reports', label: 'Reports', icon: BarChart2 },
];

export function SalesStaffSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      logger.error('Logout error', { error });
      window.location.href = '/staff/login';
    }
  };

  const mobileSections = [{ title: 'Sales Staff', items: navItems }];

  return (
    <>
    <MgmtMobileNav title="Sales Staff" sections={mobileSections} />
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
