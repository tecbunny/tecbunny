import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import React from 'react';
import { 
  ShieldAlert, Settings, Cpu, CreditCard, Users, 
  FileText, Share2, Ticket, LayoutDashboard, Wrench, 
  Activity, Building, Percent, ClipboardList, LogOut,
  Image as ImageIcon
} from 'lucide-react';
import Link from 'next/link';
import { verifySuperadminSessionToken } from '@/lib/auth/superadmin-session';

export const dynamic = 'force-dynamic';

export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const superadminCookie = cookieStore.get('superadmin-session')?.value;
  const isSuperadmin = Boolean(await verifySuperadminSessionToken(superadminCookie));

  if (!isSuperadmin) {
    redirect('/superadmin/login');
  }

  const navigationSections = [
    {
      title: 'Console Core',
      items: [
        { href: '/superadmin/mgmt/dashboard', label: 'Root Console', icon: LayoutDashboard },
        { href: '/superadmin/mgmt/users', label: 'User Management', icon: Users },
        { href: '/superadmin/mgmt/products', label: 'Product Catalog', icon: Wrench },
        { href: '/superadmin/mgmt/custom-setups', label: 'Custom Setups', icon: Settings },
        { href: '/superadmin/mgmt/services', label: 'Services Manager', icon: Settings },
        { href: '/superadmin/mgmt/leads', label: 'Infrastructure Leads', icon: ClipboardList },
        { href: '/superadmin/mgmt/catalogue', label: 'PDF Catalogue', icon: FileText },
      ]
    },
    {
      title: 'System Settings',
      items: [
        { href: '/superadmin/mgmt/payment-settings', label: 'Payment Settings', icon: CreditCard },
        { href: '/superadmin/mgmt/ai-config', label: 'AI Configurations', icon: Cpu },
        { href: '/superadmin/mgmt/settings?section=website', label: 'Website Settings', icon: Activity },
        { href: '/superadmin/mgmt/settings?section=brand', label: 'Brand Settings', icon: ImageIcon },
        { href: '/superadmin/mgmt/policies', label: 'Policies Management', icon: FileText },
        { href: '/superadmin/mgmt/social-media', label: 'Social Media', icon: Share2 },
        { href: '/superadmin/mgmt/offers', label: 'Offers & Coupons', icon: Ticket },
        { href: '/superadmin/mgmt/marketing', label: 'Marketing Target', icon: Activity },
      ]
    },
    {
      title: 'Corporate & Finance',
      items: [
        { href: '/superadmin/mgmt/settings?section=company', label: 'Company Details', icon: Building },
        { href: '/superadmin/mgmt/settings?section=tax', label: 'Tax Configuration', icon: Percent },
        { href: '/superadmin/mgmt/reports', label: 'System Reports', icon: ClipboardList },
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-6 w-6 text-primary" />
            <span className="font-semibold tracking-widest text-sm uppercase text-white">TecBunny Root Console</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs px-2.5 py-1 rounded bg-primary/10 border border-primary/20 text-primary font-mono">
              SYSTEM_ROOT
            </span>
            <a
              href="/api/superadmin/logout"
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-primary transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </a>
          </div>
        </div>
      </header>

      {/* Workspace Sidebar Layout */}
      <div className="flex flex-1 max-w-7xl w-full mx-auto">
        <aside className="w-64 border-r border-zinc-800 p-6 hidden md:block shrink-0 bg-zinc-950/40">
          <div className="space-y-6">
            {navigationSections.map((sec) => (
              <div key={sec.title} className="space-y-2">
                <h3 className="text-[10px] uppercase tracking-widest text-zinc-500 font-mono font-semibold">
                  {sec.title}
                </h3>
                <nav className="space-y-1">
                  {sec.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold text-zinc-400 hover:bg-zinc-800/50 hover:text-white transition-all"
                    >
                      {React.createElement(item.icon, { className: 'h-4 w-4 shrink-0' })}
                      {item.label}
                    </Link>
                  ))}
                </nav>
              </div>
            ))}
          </div>
        </aside>

        {/* Content Pane */}
        <main className="flex-1 p-6 lg:p-10 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
          {children}
        </main>
      </div>
    </div>
  );
}
