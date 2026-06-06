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

export const dynamic = 'force-dynamic';

export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const superadminCookie = cookieStore.get('superadmin-session')?.value;
  let isSuperadmin = false;
  if (superadminCookie) {
    const correctUserId = process.env.SUPERADMIN_USER_ID || process.env.SUPERADMIN_EMAIL;
    const correctPassword = process.env.SUPERADMIN_PASSWORD;
    if (correctUserId && correctPassword) {
      const secret = process.env.SUPERADMIN_PASSWORD || 'superadmin_salt_key_default';
      const msgBuffer = new TextEncoder().encode(`${correctUserId}:${correctPassword}:${secret}`);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const expectedToken = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      isSuperadmin = (superadminCookie === expectedToken);
    }
  }

  if (!isSuperadmin) {
    redirect('/superadmin/login');
  }

  const navigationSections = [
    {
      title: 'Console Core',
      items: [
        { href: '/superadmin/mgmt/dashboard', label: 'Root Console', icon: LayoutDashboard },
        { href: '/superadmin/mgmt/settings?section=users', label: 'User Management', icon: Users },
        { href: '/superadmin/mgmt/settings?section=products', label: 'Product Catalog', icon: Wrench },
        { href: '/superadmin/mgmt/settings?section=custom-setups', label: 'Custom Setups', icon: Settings },
      ]
    },
    {
      title: 'System Settings',
      items: [
        { href: '/superadmin/mgmt/payment-settings', label: 'Payment Settings', icon: CreditCard },
        { href: '/superadmin/mgmt/ai-config', label: 'AI Configurations', icon: Cpu },
        { href: '/superadmin/mgmt/settings?section=website', label: 'Website Settings', icon: Activity },
        { href: '/superadmin/mgmt/settings?section=brand', label: 'Brand Settings', icon: ImageIcon },
        { href: '/superadmin/mgmt/settings?section=policies', label: 'Policies Management', icon: FileText },
        { href: '/superadmin/mgmt/settings?section=social', label: 'Social Media', icon: Share2 },
        { href: '/superadmin/mgmt/settings?section=offers', label: 'Offers & Coupons', icon: Ticket },
        { href: '/superadmin/mgmt/settings?section=marketing', label: 'Marketing Target', icon: Activity },
      ]
    },
    {
      title: 'Corporate & Finance',
      items: [
        { href: '/superadmin/mgmt/settings?section=company', label: 'Company Details', icon: Building },
        { href: '/superadmin/mgmt/settings?section=tax', label: 'Tax Configuration', icon: Percent },
        { href: '/superadmin/mgmt/settings?section=reports', label: 'System Reports', icon: ClipboardList },
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="border-b border-rose-500/20 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-6 w-6 text-rose-500" />
            <span className="font-semibold tracking-widest text-sm uppercase text-white">TecBunny Root Console</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs px-2.5 py-1 rounded bg-rose-500/10 border border-rose-500/20 text-rose-300 font-mono">
              SYSTEM_ROOT
            </span>
            <a
              href="/api/superadmin/logout"
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-rose-400 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </a>
          </div>
        </div>
      </header>

      {/* Workspace Sidebar Layout */}
      <div className="flex flex-1 max-w-7xl w-full mx-auto">
        <aside className="w-64 border-r border-rose-500/10 p-6 hidden md:block shrink-0 bg-slate-950/40">
          <div className="space-y-6">
            {navigationSections.map((sec) => (
              <div key={sec.title} className="space-y-2">
                <h3 className="text-[10px] uppercase tracking-widest text-slate-500 font-mono font-semibold">
                  {sec.title}
                </h3>
                <nav className="space-y-1">
                  {sec.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold text-slate-400 hover:bg-rose-500/5 hover:text-rose-300 transition-all"
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
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-rose-500/5 rounded-full blur-[120px] pointer-events-none" />
          {children}
        </main>
      </div>
    </div>
  );
}
