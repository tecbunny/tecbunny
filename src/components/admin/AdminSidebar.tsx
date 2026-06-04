
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
} from 'lucide-react';

import { Logo } from '@/components/ui/logo';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/hooks';

import { Separator } from '../ui/separator';

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

const navSections: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { href: '/mgmt/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
      { href: '/mgmt/admin/analytics', label: 'Analytics', icon: Activity },
      { href: '/mgmt/admin/ai-assistant', label: 'AI Assistant', icon: Bot },
    ]
  },
  {
    title: 'Customers & Sales',
    items: [
      { href: '/mgmt/admin/users', label: 'User Management', icon: Users },
      { href: '/mgmt/admin/sales-agents', label: 'Sales Agents', icon: User },
      { href: '/mgmt/admin/contact-messages', label: 'Contact Messages', icon: MessageCircle },
      { href: '/mgmt/admin/quotes', label: 'Quotes', icon: FileText },
    ]
  },
  {
    title: 'Catalog & Services',
    items: [
      { href: '/mgmt/admin/products', label: 'Product Catalog', icon: Package },
      { href: '/mgmt/admin/pricing', label: 'Pricing Management', icon: DollarSign },
      { href: '/mgmt/admin/custom-setups', label: 'Custom Setups', icon: Settings2 },
      { href: '/mgmt/admin/services', label: 'Service Management', icon: Wrench },
    ]
  },
  {
    title: 'Promotions & Content',
    items: [
      { href: '/mgmt/admin/offers', label: 'Offers & Discounts', icon: Gift },
      { href: '/mgmt/admin/coupons', label: 'Coupons', icon: Ticket },
      { href: '/mgmt/admin/policies', label: 'Policies Management', icon: FileText },
      { href: '/mgmt/admin/social-media', label: 'Social Media', icon: Share2 },
    ]
  },
  {
    title: 'Experience & Branding',
    items: [
      { href: '/mgmt/admin/homepage-settings', label: 'Homepage Settings', icon: LayoutTemplate },
      { href: '/mgmt/admin/hero-banners', label: 'Hero Banners', icon: Images },
      { href: '/mgmt/admin/innovation', label: 'Innovation Content', icon: Lightbulb },
    ]
  },
  {
    title: 'Operations & Security',
    items: [
      { href: '/mgmt/admin/security', label: 'Security Dashboard', icon: Shield },
      { href: '/mgmt/admin/payment-api', label: 'Payment API', icon: CreditCard },
      { href: '/mgmt/admin/settings', label: 'Site Settings', icon: Settings },
    ]
  }
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const router = useRouter();

  // (Optional) Explicit prefetch safeguard; Next's Link prefetch covers this
  React.useEffect(() => {
    navSections.forEach(section => {
      section.items.forEach(item => {
        try { (router as any).prefetch?.(item.href); } catch {}
      });
    });
  }, [router]);

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  return (
    <aside className="hidden w-64 flex-col border-r border-white/10 bg-[#030712] p-4 sm:flex">
      <div className="flex items-center gap-2 mb-8">
        <Logo className="h-8 w-8 text-cyan-300" />
        <span className="text-xl font-bold text-white">TecBunny</span>
      </div>

      <nav className="flex-1 space-y-6">
        {navSections.map(section => (
          <div key={section.title}>
            <p className="px-3 py-2 text-xs font-semibold uppercase tracking-widest text-slate-500">{section.title}</p>
            {section.items.map(item => {
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-slate-300 transition-all outline-none focus:ring-2 focus:ring-cyan-400/50 focus:ring-offset-2 focus:ring-offset-[#030712]',
                    active && 'bg-white/10 text-white border border-white/10 shadow-[0_0_0_1px_rgba(14,116,144,0.15)]',
                    !active && 'hover:bg-white/5 hover:text-cyan-200'
                  )}
                >
                  <item.icon className={cn('h-4 w-4 pointer-events-none', active ? 'text-cyan-300' : 'text-slate-400')} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      
      <div className="mt-auto">
         <Separator className="my-4 bg-white/10" />
         <div className="flex items-center gap-3 p-3 rounded-lg border border-white/10 bg-slate-900/60">
            <div className="p-2 bg-cyan-500/10 rounded-full">
                <Shield className="h-6 w-6 text-cyan-300"/>
            </div>
            <div>
                <p className="text-sm font-semibold text-white">{user?.name}</p>
                <p className="text-xs text-slate-400 capitalize">{user?.role}</p>
            </div>
         </div>
         <Button variant="ghost" className="w-full justify-start gap-3 mt-2 text-slate-300 hover:text-white hover:bg-white/5" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Logout
         </Button>
      </div>
    </aside>
  );
}