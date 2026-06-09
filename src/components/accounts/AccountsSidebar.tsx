
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  FileText,
  LayoutDashboard,
  LogOut,
  Receipt,
  User,
} from 'lucide-react';

import { Logo } from '../ui/logo';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { useAuth } from '@/lib/hooks';
import { MgmtMobileNav } from '@/components/mgmt/MgmtMobileNav';

const navItems = [
  { href: '/mgmt/accounts', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/mgmt/accounts/invoices', label: 'Invoices', icon: Receipt },
  { href: '/mgmt/accounts/reports', label: 'Billing Reports', icon: FileText },
];

export function AccountsSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
      window.location.href = '/staff/login';
    }
  };

  const mobileSections = [{ title: 'Accounts', items: navItems }];

  return (
    <>
    <MgmtMobileNav title="Accounts" sections={mobileSections} />
    <aside className="hidden w-64 flex-col border-r bg-background p-4 sm:flex">
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
              pathname === item.href && 'bg-muted text-primary'
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
