import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { 
  ShieldAlert, Settings, Cpu, CreditCard, ClipboardList, 
  Users, UserCheck, Key, RefreshCw, LogOut, ArrowRight 
} from 'lucide-react';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function SuperadminDashboard() {
  const cookieStore = await cookies();
  const superadminCookie = cookieStore.get('superadmin-session')?.value;
  let isSuperadmin = false;
  if (superadminCookie) {
    const correctEmail = process.env.SUPERADMIN_USER_ID || process.env.SUPERADMIN_EMAIL;
    const correctPassword = process.env.SUPERADMIN_PASSWORD;
    if (correctEmail && correctPassword) {
      const secret = process.env.SUPERADMIN_PASSWORD || 'superadmin_salt_key_default';
      const msgBuffer = new TextEncoder().encode(`${correctEmail}:${correctPassword}:${secret}`);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const expectedToken = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      isSuperadmin = (superadminCookie === expectedToken);
    }
  }

  if (!isSuperadmin) {
    redirect('/superadmin/login');
  }

  const supabase = createServiceClient();

  // Fetch telemetry counts from DB safely
  let userCount = 0;
  let adminCount = 0;
  let recentLogs: any[] = [];

  try {
    const { count } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });
    userCount = count || 0;

    const { count: admins } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .in('role', ['admin', 'superadmin']);
    adminCount = admins || 0;

    const { data: logs } = await supabase
      .from('security_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    recentLogs = logs || [];
  } catch (e) {
    console.error('Superadmin dashboard data fetch failed:', e);
  }

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
            <div className="flex items-center">
              {/* Force log out path */}
              <a
                href="/api/superadmin/logout"
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-rose-400 transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Main Console Panel */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-3 gap-8 relative">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-rose-500/5 rounded-full blur-[120px] pointer-events-none" />

        {/* Dashboard Grid Header */}
        <div className="lg:col-span-3 mb-2">
          <h2 className="text-3xl font-extrabold text-white tracking-tight">System Administration</h2>
          <p className="text-slate-400 text-sm mt-1">Configure parameters, inspect user tables, and mutate core orchestration variables.</p>
        </div>

        {/* Telemetry/Widgets Panel */}
        <div className="lg:col-span-2 space-y-8">
          {/* Statistics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 shadow-lg">
              <div className="flex items-center justify-between mb-3 text-slate-400">
                <span className="text-xs uppercase tracking-wider font-semibold">Total User Profiles</span>
                <Users className="h-5 w-5 text-indigo-400" />
              </div>
              <span className="text-3xl font-bold text-white font-mono">{userCount}</span>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 shadow-lg">
              <div className="flex items-center justify-between mb-3 text-slate-400">
                <span className="text-xs uppercase tracking-wider font-semibold">Privileged Accounts</span>
                <UserCheck className="h-5 w-5 text-rose-400" />
              </div>
              <span className="text-3xl font-bold text-white font-mono">{adminCount}</span>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 shadow-lg">
              <div className="flex items-center justify-between mb-3 text-slate-400">
                <span className="text-xs uppercase tracking-wider font-semibold">Security Settings</span>
                <Key className="h-5 w-5 text-emerald-400" />
              </div>
              <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                Active & Enforced
              </span>
            </div>
          </div>

          {/* Quick-Access Control Panels */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* AI Settings */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 flex flex-col justify-between hover:border-rose-500/30 transition-all group shadow-md">
              <div>
                <div className="w-12 h-12 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-5">
                  <Cpu className="h-6 w-6 text-rose-500" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">AI Orchestration Engine</h3>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Run-time mutations of AI prompts, temperature thresholds, model mappings, and Gemini API keys.
                </p>
              </div>
              <Link 
                href="/superadmin/mgmt/ai-config"
                className="mt-6 inline-flex items-center gap-1.5 text-xs text-rose-400 group-hover:text-white font-semibold transition-colors uppercase tracking-wider"
              >
                Configure Prompts <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            {/* Payment Gateways */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 flex flex-col justify-between hover:border-rose-500/30 transition-all group shadow-md">
              <div>
                <div className="w-12 h-12 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-5">
                  <CreditCard className="h-6 w-6 text-indigo-400" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Payment Gateways</h3>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Configure merchant credentials, PayU endpoints, salt strings, and live transaction webhooks.
                </p>
              </div>
              <Link 
                href="/superadmin/mgmt/payment-settings"
                className="mt-6 inline-flex items-center gap-1.5 text-xs text-indigo-400 group-hover:text-white font-semibold transition-colors uppercase tracking-wider"
              >
                Configure Gateways <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </div>

        {/* Audit Log Sidebar */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 shadow-lg h-fit">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4.5 w-4.5 text-rose-500" />
              <h3 className="text-md font-bold text-white tracking-wide">System Audit Trails</h3>
            </div>
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">Live Logs</span>
          </div>

          <div className="space-y-4">
            {recentLogs.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center italic">No security events recorded in audit engine.</p>
            ) : (
              recentLogs.map((log) => (
                <div key={log.id} className="p-3 bg-slate-900/40 border border-slate-900 rounded-lg space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-rose-400 font-mono uppercase font-semibold">{log.event_type}</span>
                    <span className="text-slate-500 font-mono">{new Date(log.created_at).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-slate-300 text-xs truncate">
                    {log.event_data?.setting_key ? `Key: ${log.event_data.setting_key}` : 'Event data modified'}
                  </p>
                  <span className="text-[9px] text-slate-500 font-mono">Severity: {log.severity || 'low'}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
