'use client';

import React from 'react';
import Link from 'next/link';

import { User, CheckCircle, XCircle, Clock, Users, Edit, Camera, Monitor, Bell, Plus, Shield, ArrowLeft, FileText } from 'lucide-react';

import type { User as SupabaseUser } from '@supabase/supabase-js';

import { logger } from '@/lib/logger';

import { Button } from '@/components/ui/button';
import { useToast } from '../../hooks/use-toast';

import { EditProfileDialog } from '@/components/profile/EditProfileDialog';
import { TwoFactorSetup } from '@/components/auth/TwoFactorSetup';
import { useAuth } from '@/lib/hooks';

interface UserProfileProps {
  user: SupabaseUser;
  profile: any;
  salesAgentData: any;
  orders: Array<{ id: string; status?: string; total?: number | null; total_amount?: number | null; created_at?: string; type?: string }>;
  serviceTickets: Array<{ id: string; issue_description?: string; status?: string; priority?: string; created_at?: string }>;
  quotes: Array<{ id: string; status: string; customer_name: string; summary: string; created_at: string; expiry_at: string }>;
}

export default function UserProfile({ user, profile, salesAgentData, orders, serviceTickets, quotes }: UserProfileProps) {
  const [isApplying, setIsApplying] = React.useState(false);
  const [agentStatus, setAgentStatus] = React.useState(salesAgentData);
  const [showTwoFactorSetup, setShowTwoFactorSetup] = React.useState(false);
  const [twoFactorStatus, setTwoFactorStatus] = React.useState<any>(null);
  const { toast } = useToast();
  const { updateUser } = useAuth();

  // Fetch 2FA status on component mount
  React.useEffect(() => {
    const fetchTwoFactorStatus = async () => {
      try {
        const response = await fetch('/api/auth/2fa/status');
        if (response.ok) {
          const status = await response.json();
          setTwoFactorStatus(status);
        }
      } catch (error) {
        logger.error('Failed to fetch 2FA status:', { error });
      }
    };

    fetchTwoFactorStatus();
  }, []);

  const handleApplyForAgent = async () => {
    setIsApplying(true);
    try {
      const response = await fetch('/api/sales-agents/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error || 'Failed to submit application.');
      }

      // Update local state to show pending status
      setAgentStatus({ status: 'pending' });

      toast({
        title: 'Application Submitted',
        description: 'Your application has been submitted successfully. You will be notified once reviewed.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    } finally {
      setIsApplying(false);
    }
  };

  const handleDisable2FA = async () => {
    const code = prompt('Enter your 2FA code to disable two-factor authentication:');
    if (!code) return;

    try {
      const response = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });

      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error);
      }

      // Refresh 2FA status
      const statusResponse = await fetch('/api/auth/2fa/status');
      if (statusResponse.ok) {
        const status = await statusResponse.json();
        setTwoFactorStatus(status);
      }

      toast({
        title: '2FA Disabled',
        description: 'Two-factor authentication has been disabled for your account.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-300">
            <Clock className="h-3 w-3" />
            Pending Review
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-300">
            <CheckCircle className="h-3 w-3" />
            Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-1 text-[10px] font-semibold text-red-300">
            <XCircle className="h-3 w-3" />
            Rejected
          </span>
        );
      default:
        return null;
    }
  };

  const displayName = profile?.name && profile.name !== user.email
    ? profile.name
    : user.user_metadata?.name || user.email?.split('@')[0] || 'User';
  const initials = displayName
    .split(' ')
    .map((part: string) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const planLabel = profile?.plan || profile?.plan_name || profile?.subscription_tier || 'No plan assigned';
  const amcExpiry = profile?.amc_expiry_date || profile?.amc_expiry || profile?.amc_end_date;
  const amcDaysLeft = amcExpiry ? Math.max(0, Math.ceil((new Date(amcExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : null;
  const amcPercent = amcDaysLeft !== null ? Math.min(100, Math.max(0, Math.round((amcDaysLeft / 365) * 100))) : 0;
  const amcDashOffset = 251.2 - (251.2 * amcPercent) / 100;

  const statusStyles: Record<string, { badge: string; border: string }> = {
    completed: { badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', border: 'border-emerald-500' },
    delivered: { badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', border: 'border-emerald-500' },
    shipped: { badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30', border: 'border-cyan-500' },
    processing: { badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30', border: 'border-amber-500' },
    pending: { badge: 'bg-slate-800 text-slate-400 border-slate-700', border: 'border-slate-600' },
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#030712] text-slate-200">
      <style jsx global>{`
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #030712; }
        ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #8b5cf6; }
        .glass-panel {
          background: rgba(15, 23, 42, 0.35);
          border: 1px solid rgba(255, 255, 255, 0.06);
          box-shadow: inset 0 0 20px rgba(139, 92, 246, 0.08);
          backdrop-filter: blur(10px);
        }
        .nav-item {
          border-left: 3px solid transparent;
        }
        .nav-item:hover {
          color: #fff;
          background: linear-gradient(90deg, rgba(139, 92, 246, 0.15), transparent);
          border-left-color: #8b5cf6;
        }
        .nav-item.active {
          color: #fff;
          background: linear-gradient(90deg, rgba(139, 92, 246, 0.2), transparent);
          border-left-color: #8b5cf6;
        }
      `}</style>

      <aside className="hidden md:flex w-64 flex-col border-r border-white/5 bg-[#030712] shadow-xl shadow-purple-500/5">
        <div className="h-16 flex items-center px-6 border-b border-white/5 bg-[#030712]/95 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center bg-purple-500/10 rounded-lg border border-purple-400/20">
              <User className="h-4 w-4 text-purple-300" />
            </div>
            <span className="font-tech font-bold text-xl text-white tracking-wide">USER<span className="text-purple-300">.</span></span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-6 space-y-1">
          <div className="px-6 mb-2 text-xs font-bold text-slate-500 uppercase tracking-widest font-tech">Personal Hub</div>
          <button className="w-full text-left nav-item active flex items-center gap-3 px-6 py-3 text-sm text-slate-400 transition-all">
            <Shield className="h-4 w-4" /> My Overview
          </button>
          <Link href="/orders" className="w-full text-left nav-item flex items-center gap-3 px-6 py-3 text-sm text-slate-400 transition-all">
            <Camera className="h-4 w-4" /> My Orders
          </Link>
          <Link href="/contact" className="w-full text-left nav-item flex items-center gap-3 px-6 py-3 text-sm text-slate-400 transition-all">
            <Shield className="h-4 w-4" /> Support Tickets
          </Link>

          <div className="px-6 mt-8 mb-2 text-xs font-bold text-slate-500 uppercase tracking-widest font-tech">Account</div>
          <Link href="/services" className="w-full text-left nav-item flex items-center gap-3 px-6 py-3 text-sm text-slate-400 transition-all">
            <Users className="h-4 w-4" /> Billing & AMC
          </Link>
          <Link href="/account" className="w-full text-left nav-item flex items-center gap-3 px-6 py-3 text-sm text-slate-400 transition-all">
            <Edit className="h-4 w-4" /> Profile Settings
          </Link>
        </nav>

        <div className="px-6 pb-6">
          <Link href="/" className="flex items-center gap-2 text-xs text-slate-500 hover:text-white transition-colors">
            <ArrowLeft className="h-3 w-3" /> Back to Website
          </Link>
        </div>

        <div className="p-6 border-t border-white/5 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-blue-500 flex items-center justify-center text-white text-xs font-bold">
              {initials || 'TB'}
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-none">{displayName}</p>
              <p className="text-[10px] text-purple-300 leading-none mt-1">Tier: {planLabel}</p>
            </div>
            <button className="ml-auto text-slate-500 hover:text-white">
              <XCircle className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <header className="h-16 bg-[#030712]/80 backdrop-blur border-b border-white/5 flex items-center justify-between px-6">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            System Status: <span className="text-white font-bold">SECURE</span>
          </div>
          <div className="flex items-center gap-4">
            <Button
              type="button"
              variant="outline"
              className="hidden sm:flex items-center gap-2 border-purple-400/30 bg-purple-400/10 text-purple-200 text-xs hover:bg-purple-400 hover:text-white"
              onClick={() => window.location.href = '/contact'}
            >
              <Plus className="h-4 w-4" /> New Request
            </Button>
            <button className="relative p-2 text-slate-400 hover:text-white transition-colors">
              <Bell className="h-4 w-4" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-[#030712]"></span>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 lg:p-8 relative">
          <div className="fixed inset-0 bg-[url('/noise.svg')] opacity-5 pointer-events-none"></div>

          <div className="max-w-6xl mx-auto space-y-8 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 glass-panel p-8 rounded-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                  <Shield className="h-24 w-24 text-white" />
                </div>
                <h1 className="text-3xl font-bold text-white font-tech mb-2">Welcome back, {displayName}.</h1>
                <p className="text-slate-400 mb-6 max-w-md">Your security perimeter is active. No breaches detected in the last 24 hours.</p>
                <div className="flex flex-wrap gap-4">
                  <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-lg">
                    <span className="block text-xs text-slate-500 uppercase">Primary Contact</span>
                    <span className="text-white font-bold">{user.email}</span>
                  </div>
                  <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-lg">
                    <span className="block text-xs text-slate-500 uppercase">Plan</span>
                    <span className="text-purple-300 font-bold">{planLabel}</span>
                  </div>
                </div>
              </div>

              <div className="glass-panel p-6 rounded-2xl flex flex-col items-center justify-center relative">
                <h3 className="text-sm font-bold text-slate-300 absolute top-6 left-6">AMC Status</h3>
                <div className="relative w-32 h-32 mt-4">
                  <svg className="w-full h-full" viewBox="0 0 100 100">
                    <circle className="text-slate-800 stroke-current" strokeWidth="8" cx="50" cy="50" r="40" fill="transparent"></circle>
                    <circle
                      className="text-purple-400 stroke-current"
                      strokeWidth="8"
                      strokeLinecap="round"
                      cx="50"
                      cy="50"
                      r="40"
                      fill="transparent"
                      strokeDasharray="251.2"
                      strokeDashoffset={amcDashOffset}
                      style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', transition: 'stroke-dashoffset 0.35s' }}
                    ></circle>
                  </svg>
                  <div className="absolute top-0 left-0 w-full h-full flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-white font-tech">{amcDaysLeft ?? '—'}</span>
                    <span className="text-[10px] text-slate-500 uppercase">{amcDaysLeft !== null ? 'Days Left' : 'No AMC'}</span>
                  </div>
                </div>
                <Link href="/services" className="mt-4 text-xs text-cyan-300 hover:underline">
                  {amcDaysLeft !== null ? 'Renew Plan' : 'Add Plan'}
                </Link>
              </div>
            </div>

            <div>
              <h3 className="font-bold text-white font-tech text-lg mb-4 flex items-center gap-2">
                <Camera className="h-4 w-4 text-cyan-300" /> Recent Orders
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {orders && orders.length > 0 ? orders.map((order) => {
                  const statusKey = (order.status || 'pending').toLowerCase();
                  const styles = statusStyles[statusKey] || statusStyles.pending;
                  const amount = order.total ?? order.total_amount ?? 0;
                  const created = order.created_at ? new Date(order.created_at).toLocaleDateString() : '—';
                  return (
                    <div key={order.id} className={`glass-panel p-5 rounded-xl border-l-4 ${styles.border} group hover:bg-white/5 transition-colors`}>
                    <div className="flex justify-between items-start mb-3">
                      <div className="text-slate-400 group-hover:text-white transition-colors">
                          <Monitor className="h-5 w-5" />
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${styles.badge}`}>
                        {order.status || 'Pending'}
                      </span>
                    </div>
                    <h4 className="text-white font-bold">Order #{order.id?.slice(0, 8)}</h4>
                    <p className="text-xs text-slate-500 mt-1">{order.type || 'Delivery'} • Placed {created}</p>
                    <p className="text-sm text-white font-semibold mt-2">₹{amount.toFixed(2)}</p>
                  </div>
                  );
                }) : (
                  <div className="col-span-full text-sm text-slate-400">No orders found.</div>
                )}
              </div>
            </div>

            <div>
              <h3 className="font-bold text-white font-tech text-lg mb-4 flex items-center gap-2">
                <FileText className="h-4 w-4 text-cyan-300" /> Saved Quotes
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {(quotes || []).length > 0 ? quotes.map((quote) => {
                  const created = new Date(quote.created_at).toLocaleDateString();
                  const expired = new Date(quote.expiry_at) < new Date();
                  return (
                    <div key={quote.id} className={`glass-panel p-5 rounded-xl border-l-4 ${expired ? 'border-red-500' : 'border-cyan-500'} group hover:bg-white/5 transition-colors`}>
                      <div className="flex justify-between items-start mb-3">
                        <div className="text-slate-400 group-hover:text-white transition-colors">
                            <FileText className="h-5 w-5" />
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${expired ? 'bg-red-500/20 text-red-300 border-red-500/30' : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'}`}>
                          {expired ? 'Expired' : 'Active'}
                        </span>
                      </div>
                      <h4 className="text-white font-bold truncate" title={quote.summary}>{quote.summary || 'Custom Quote'}</h4>
                      <p className="text-xs text-slate-500 mt-1">Generated {created}</p>
                      <Button variant="link" className="p-0 h-auto text-xs text-cyan-400 mt-2 hover:text-cyan-300" onClick={() => window.open('/?quote_id=' + quote.id, '_blank')}>
                         Re-open (Future Impl)
                      </Button>
                    </div>
                  );
                }) : (
                  <div className="col-span-full text-sm text-slate-400">No saved quotes found.</div>
                )}
              </div>
            </div>

            <div className="glass-panel rounded-2xl overflow-hidden">
              <div className="p-6 border-b border-white/5 flex justify-between items-center">
                <h3 className="font-bold text-white font-tech text-lg">Service Log</h3>
                <Link
                  href="/contact"
                  className="text-xs bg-cyan-500/10 text-cyan-300 px-3 py-1 rounded hover:bg-cyan-400 hover:text-slate-900 transition-colors"
                >
                  Raise Ticket
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-400">
                  <thead className="bg-white/5 text-xs uppercase font-bold text-slate-500">
                    <tr>
                      <th className="px-6 py-4">Ticket ID</th>
                      <th className="px-6 py-4">Service Type</th>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {serviceTickets && serviceTickets.length > 0 ? serviceTickets.map((log) => (
                      <tr key={log.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 font-mono text-purple-300">#{log.id.slice(0, 8)}</td>
                        <td className="px-6 py-4">{log.issue_description || 'Service request'}</td>
                        <td className="px-6 py-4">{log.created_at ? new Date(log.created_at).toLocaleDateString() : '—'}</td>
                        <td className="px-6 py-4">
                          <span className="text-emerald-300 font-bold text-xs border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 rounded">{log.status || 'pending'}</span>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td className="px-6 py-4 text-sm text-slate-400" colSpan={4}>No service tickets yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="glass-panel p-6 rounded-2xl space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-purple-500/10">
                    <Edit className="h-5 w-5 text-purple-300" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Profile Settings</h3>
                    <p className="text-sm text-slate-400">Manage your account details and preferences.</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500">Name</p>
                    <p className="text-white font-semibold">{displayName}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Email</p>
                    <p className="text-white font-semibold">{user.email}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Role</p>
                    <p className="text-white font-semibold capitalize">{profile?.role || user.app_metadata?.role || 'customer'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Mobile</p>
                    <p className="text-white font-semibold">{profile?.mobile || 'Not provided'}</p>
                  </div>
                </div>
                <EditProfileDialog onProfileUpdate={updateUser}>
                  <Button variant="outline" className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10">
                    <Edit className="mr-2 h-4 w-4" /> Edit Profile
                  </Button>
                </EditProfileDialog>
              </div>

              <div className="glass-panel p-6 rounded-2xl space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-cyan-500/10">
                    <CheckCircle className="h-5 w-5 text-cyan-300" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Security Settings</h3>
                    <p className="text-sm text-slate-400">Manage two-factor authentication and account security.</p>
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 border border-white/10 rounded-lg">
                  <div>
                    <h4 className="font-semibold text-white">Two-Factor Authentication</h4>
                    <p className="text-sm text-slate-400">
                      {twoFactorStatus?.enabled
                        ? '2FA is enabled for your account'
                        : 'Add an extra layer of security to your account'
                      }
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {twoFactorStatus?.enabled ? (
                      <>
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-300">
                          <CheckCircle className="h-3 w-3" /> Enabled
                        </span>
                        <Button
                          onClick={handleDisable2FA}
                          variant="outline"
                          size="sm"
                          className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                        >
                          Disable
                        </Button>
                      </>
                    ) : (
                      <Button
                        onClick={() => setShowTwoFactorSetup(true)}
                        variant="outline"
                        className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                      >
                        Enable 2FA
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-panel p-6 rounded-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-full bg-emerald-500/10">
                  <Users className="h-5 w-5 text-emerald-300" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Sales Agent Program</h3>
                  <p className="text-sm text-slate-400">Join our sales agent program to earn commissions on referrals.</p>
                </div>
              </div>

              {!agentStatus ? (
                <div className="space-y-4">
                  <div className="p-4 border border-white/10 rounded-lg bg-white/5">
                    <h4 className="font-semibold mb-2 text-white">Benefits of becoming a Sales Agent:</h4>
                    <ul className="space-y-1 text-sm text-slate-400">
                      <li>• Earn points for every successful referral</li>
                      <li>• Convert points to real money (1 point = ₹1)</li>
                      <li>• Access to exclusive promotional materials</li>
                      <li>• Track your earnings and performance</li>
                    </ul>
                  </div>
                  <Button onClick={handleApplyForAgent} disabled={isApplying} className="bg-emerald-400 text-slate-900 hover:bg-white">
                    {isApplying ? 'Submitting Application...' : 'Apply to Become a Sales Agent'}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-white">Application Status</h4>
                      <p className="text-sm text-slate-400">Your sales agent application is under review.</p>
                    </div>
                    {getStatusBadge(agentStatus.status)}
                  </div>

                  {agentStatus.status === 'approved' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border border-emerald-500/30 rounded-lg bg-emerald-500/10">
                      <div>
                        <label className="text-sm font-medium text-slate-400">Your Referral Code</label>
                        <p className="text-lg font-mono text-white">{agentStatus.referral_code}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-slate-400">Points Balance</label>
                        <p className="text-lg text-white">₹{agentStatus.points_balance || 0}</p>
                      </div>
                    </div>
                  )}

                  {agentStatus.status === 'rejected' && (
                    <div className="p-4 border border-red-500/30 rounded-lg bg-red-500/10">
                      <p className="text-sm text-red-200">
                        Your application was not approved. You may contact support for more information.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {showTwoFactorSetup && (
        <TwoFactorSetup
          onComplete={() => {
            setShowTwoFactorSetup(false);
            const fetchStatus = async () => {
              try {
                const response = await fetch('/api/auth/2fa/status');
                if (response.ok) {
                  const status = await response.json();
                  setTwoFactorStatus(status);
                }
              } catch (error) {
                logger.error('Failed to refresh 2FA status:', { error });
              }
            };
            fetchStatus();
            toast({
              title: '2FA Enabled',
              description: 'Two-factor authentication has been successfully enabled for your account.',
            });
          }}
          onCancel={() => setShowTwoFactorSetup(false)}
        />
      )}
    </div>
  );
}