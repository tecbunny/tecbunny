
'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  LogOut,
  User,
  Users,
  Package,
  Settings,
  Shield,
  Ticket,
  Gift,
  LayoutTemplate,
  Images,
  CreditCard,
  Wrench,
  Share2,
  FileText,
  DollarSign,
  MessageCircle,
  Settings2,
  Bot,
  Activity,
  Lightbulb,
  ShoppingBag,
  Megaphone,
  Archive,
  FileSearch,
} from 'lucide-react';

import { Logo } from '@/components/ui/logo';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/hooks';

import { Separator } from '../ui/separator';
import { MgmtMobileNav } from '@/components/mgmt/MgmtMobileNav';

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

export const adminNavSections: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { href: '/mgmt/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    ]
  },
  {
    title: 'Operations',
    items: [
      { href: '/mgmt/admin/staff', label: 'Staff Management', icon: Users },
      { href: '/mgmt/admin/inventory', label: 'Inventory Management', icon: Package },
      { href: '/mgmt/admin/orders', label: 'All Orders', icon: ShoppingBag },
      { href: '/mgmt/admin/purchase', label: 'Purchase Management', icon: Archive },
      { href: '/mgmt/admin/invoice-lookup', label: 'Invoice Look-up', icon: FileSearch },
      { href: '/mgmt/admin/quotes', label: 'Quotes Management', icon: FileText },
    ]
  },
  {
    title: 'Marketing',
    items: [
      { href: '/mgmt/admin/broadcast-desk', label: 'Broadcast Desk', icon: Megaphone },
    ]
  }
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const router = useRouter();

  // (Optional) Explicit prefetch safeguard; Next's Link prefetch covers this
  React.useEffect(() => {
    adminNavSections.forEach(section => {
      section.items.forEach(item => {
        try { (router as any).prefetch?.(item.href); } catch {}
      });
    });
  }, [router]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
      window.location.href = '/staff/login';
    }
  };

  return (
    <>
    <MgmtMobileNav title="Admin" sections={adminNavSections} />
    <aside className="hidden w-64 flex-col border-r border-border bg-card p-4 sm:flex">
      <div className="flex items-center gap-2 mb-8">
        <Logo className="h-8 w-8 text-primary" />
        <span className="text-xl font-bold text-foreground">TecBunny</span>
      </div>

      <nav className="flex-1 space-y-6">
        {adminNavSections.map(section => (
          <div key={section.title}>
            <p className="px-3 py-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{section.title}</p>
            {section.items.map(item => {
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background',
                    active && 'bg-primary/10 text-primary border border-primary/20 shadow-[0_0_0_1px_rgba(37,99,235,0.15)]',
                    !active && 'hover:bg-muted hover:text-foreground'
                  )}
                >
                  <item.icon className={cn('h-4 w-4 pointer-events-none', active ? 'text-primary' : 'text-muted-foreground')} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      
      <div className="mt-auto">
         <Separator className="my-4 bg-border" />
         <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/50">
            <div className="p-2 bg-primary/10 rounded-full">
                <Shield className="h-6 w-6 text-primary"/>
            </div>
            <div>
                <p className="text-sm font-semibold text-foreground">{user?.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
            </div>
         </div>
         <Button variant="ghost" className="w-full justify-start gap-3 mt-2 text-muted-foreground hover:text-foreground hover:bg-muted" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Logout
         </Button>
      </div>
    </aside>
    </>
  );
}