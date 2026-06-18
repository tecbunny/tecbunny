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
    completed: { badge: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border-emerald-500/30', border: 'border-emerald-500' },
    delivered: { badge: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border-emerald-500/30', border: 'border-emerald-500' },
    shipped: { badge: 'bg-blue-500/20 text-blue-600 dark:text-blue-300 border-blue-500/30', border: 'border-blue-500' },
    processing: { badge: 'bg-amber-500/20 text-amber-600 dark:text-amber-300 border-amber-500/30', border: 'border-amber-500' },
    pending: { badge: 'bg-muted text-muted-foreground border-border', border: 'border-muted-foreground/30' },
  };

  return (
    <div className="flex min-h-[calc(100vh-73px)] bg-background text-foreground">
      

      <aside className="hidden md:flex w-64 flex-col border-r border-border bg-card shadow-sm sticky top-[73px] h-[calc(100vh-73px)]">
        <div className="h-16 flex items-center px-6 border-b border-border bg-card/95 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center bg-primary/10 rounded-lg border border-primary/20">
              <User className="h-4 w-4 text-primary" />
            </div>
            <span className="font-tech font-bold text-xl text-foreground tracking-wide">USER<span className="text-primary">.</span></span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-6 space-y-1">
          <button className="w-full text-left nav-item active flex items-center gap-3 px-6 py-3 text-sm text-foreground/80 hover:text-foreground hover:bg-muted/50 transition-all font-medium">
            <Shield className="h-4 w-4 text-primary" /> My Overview
          </button>
          <Link href="/orders" className="w-full text-left nav-item flex items-center gap-3 px-6 py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all">
            <Camera className="h-4 w-4" /> My Orders
          </Link>
          <Link href="/contact" className="w-full text-left nav-item flex items-center gap-3 px-6 py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all">
            <Shield className="h-4 w-4" /> Support Tickets
          </Link>

          <div className="px-6 mt-8 mb-2 text-xs font-bold text-muted-foreground uppercase tracking-widest font-tech">Account</div>
          <Link href="/services" className="w-full text-left nav-item flex items-center gap-3 px-6 py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all">
            <Users className="h-4 w-4" /> Billing & AMC
          </Link>
          <Link href="/profile" className="w-full text-left nav-item flex items-center gap-3 px-6 py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all">
            <Edit className="h-4 w-4" /> Profile Settings
          </Link>
        </nav>

        <div className="px-6 pb-6">
          <Link href="/" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-3 w-3" /> Back to Website
          </Link>
        </div>

        <div className="p-6 border-t border-border bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold">
              {initials || 'TB'}
            </div>
            <div>
              <p className="text-sm font-bold text-foreground leading-none">{displayName}</p>
              <p className="text-[10px] text-primary leading-none mt-1 font-medium">Tier: {planLabel}</p>
            </div>
            <button className="ml-auto text-muted-foreground hover:text-foreground">
              <XCircle className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative">
        <header className="h-16 bg-background/85 backdrop-blur border-b border-border flex items-center justify-between px-6 sticky top-[73px] z-30">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
            System Status: <span className="text-foreground font-bold">SECURE</span>
          </div>
          <div className="flex items-center gap-4">
            <Button
              type="button"
              variant="outline"
              className="hidden sm:flex items-center gap-2 border-primary/20 bg-primary/10 text-primary text-xs hover:bg-primary hover:text-white"
              onClick={() => window.location.href = '/contact'}
            >
              <Plus className="h-4 w-4" /> New Request
            </Button>
            <button className="relative p-2 text-muted-foreground hover:text-foreground transition-colors">
              <Bell className="h-4 w-4" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-background"></span>
            </button>
          </div>
        </header>

        <div className="flex-1 p-6 lg:p-8 relative bg-background">
          <div className="fixed inset-0 bg-noise opacity-5 pointer-events-none"></div>

          <div className="max-w-6xl mx-auto space-y-8 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bento-card p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                  <Shield className="h-24 w-24 text-foreground" />
                </div>
                <h1 className="text-3xl font-bold font-tech mb-2 tech-heading">Welcome back, {displayName}.</h1>
                <p className="text-muted-foreground mb-6 max-w-md">Your security perimeter is active. No breaches detected in the last 24 hours.</p>
                <div className="flex flex-wrap gap-4">
                  <div className="bg-muted/50 border border-border px-4 py-2 rounded-lg">
                    <span className="block text-xs text-muted-foreground uppercase">Primary Contact</span>
                    <span className="font-bold text-foreground">{user.email}</span>
                  </div>
                  <div className="bg-muted/50 border border-border px-4 py-2 rounded-lg">
                    <span className="block text-xs text-muted-foreground uppercase">Plan</span>
                    <span className="text-primary font-bold">{planLabel}</span>
                  </div>
                </div>
              </div>

              <div className="bento-card p-6 flex flex-col items-center justify-center relative">
                <h3 className="text-sm font-bold text-muted-foreground absolute top-6 left-6">AMC Status</h3>
                <div className="relative w-32 h-32 mt-4">
                  <svg className="w-full h-full" viewBox="0 0 100 100">
                    <circle className="text-muted/40 stroke-current" strokeWidth="8" cx="50" cy="50" r="40" fill="transparent"></circle>
                    <circle
                      className="text-primary stroke-current"
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
                    <span className="text-2xl font-bold font-tech text-foreground">{amcDaysLeft ?? '—'}</span>
                    <span className="text-[10px] text-muted-foreground uppercase">{amcDaysLeft !== null ? 'Days Left' : 'No AMC'}</span>
                  </div>
                </div>
                <Link href="/services" className="mt-4 text-xs text-primary hover:underline font-medium">
                  {amcDaysLeft !== null ? 'Renew Plan' : 'Add Plan'}
                </Link>
              </div>
            </div>

            <div>
              <h3 className="font-bold font-tech text-lg mb-4 flex items-center gap-2 tech-heading">
                <Camera className="h-4 w-4 text-primary" /> Recent Orders
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {orders && orders.length > 0 ? orders.map((order) => {
                  const statusKey = (order.status || 'pending').toLowerCase();
                  const styles = statusStyles[statusKey] || statusStyles.pending;
                  const amount = order.total ?? order.total_amount ?? 0;
                  const created = order.created_at ? new Date(order.created_at).toLocaleDateString() : '—';
                  return (
                    <div key={order.id} className={`bento-card p-5 border-l-4 ${styles.border} group transition-all`}>
                      <div className="flex justify-between items-start mb-3">
                        <div className="text-muted-foreground group-hover:text-foreground transition-colors">
                            <Monitor className="h-5 w-5" />
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${styles.badge}`}>
                          {order.status || 'Pending'}
                        </span>
                      </div>
                      <h4 className="font-bold text-foreground">Order #{order.id?.slice(0, 8)}</h4>
                      <p className="text-xs text-muted-foreground mt-1">{order.type || 'Delivery'} • Placed {created}</p>
                      <p className="text-sm font-semibold mt-2 text-foreground">₹{amount.toFixed(2)}</p>
                    </div>
                  );
                }) : (
                  <div className="col-span-full text-sm text-muted-foreground">No orders found.</div>
                )}
              </div>
            </div>

            <div>
              <h3 className="font-bold font-tech text-lg mb-4 flex items-center gap-2 tech-heading">
                <FileText className="h-4 w-4 text-primary" /> Saved Quotes
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {(quotes || []).length > 0 ? quotes.map((quote) => {
                  const created = new Date(quote.created_at).toLocaleDateString();
                  const expired = new Date(quote.expiry_at) < new Date();
                  return (
                    <div key={quote.id} className={`bento-card p-5 border-l-4 ${expired ? 'border-red-500' : 'border-primary'} group transition-all`}>
                      <div className="flex justify-between items-start mb-3">
                        <div className="text-muted-foreground group-hover:text-foreground transition-colors">
                            <FileText className="h-5 w-5" />
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${expired ? 'bg-red-500/25 text-red-600 dark:text-red-300 border-red-500/30' : 'bg-primary/10 text-primary border-primary/20'}`}>
                          {expired ? 'Expired' : 'Active'}
                        </span>
                      </div>
                      <h4 className="font-bold truncate text-foreground" title={quote.summary}>{quote.summary || 'Custom Quote'}</h4>
                      <p className="text-xs text-muted-foreground mt-1">Generated {created}</p>
                      <Button variant="link" className="p-0 h-auto text-xs text-primary mt-2 hover:text-primary/80 font-medium" onClick={() => window.open('/?quote_id=' + quote.id, '_blank')}>
                         Re-open (Future Impl)
                      </Button>
                    </div>
                  );
                }) : (
                  <div className="col-span-full text-sm text-muted-foreground">No saved quotes found.</div>
                )}
              </div>
            </div>

            <div className="bento-card overflow-hidden border border-border">
              <div className="p-6 border-b border-border flex justify-between items-center bg-muted/10">
                <h3 className="font-bold font-tech text-lg tech-heading">Service Log</h3>
                <Link
                  href="/contact"
                  className="text-xs bg-primary text-white px-3 py-1.5 rounded hover:bg-primary/90 transition-colors font-medium"
                >
                  Raise Ticket
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-foreground/80">
                  <thead className="bg-muted/50 text-xs uppercase font-bold text-muted-foreground">
                    <tr>
                      <th className="px-6 py-4">Ticket ID</th>
                      <th className="px-6 py-4">Service Type</th>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {serviceTickets && serviceTickets.length > 0 ? serviceTickets.map((log) => (
                      <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-6 py-4 font-mono text-primary">#{log.id.slice(0, 8)}</td>
                        <td className="px-6 py-4">{log.issue_description || 'Service request'}</td>
                        <td className="px-6 py-4">{log.created_at ? new Date(log.created_at).toLocaleDateString() : '—'}</td>
                        <td className="px-6 py-4">
                          <span className="text-emerald-600 dark:text-emerald-300 font-bold text-xs border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 rounded">{log.status || 'pending'}</span>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td className="px-6 py-4 text-sm text-muted-foreground" colSpan={4}>No service tickets yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bento-card p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-primary/10">
                    <Edit className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold tech-heading">Profile Settings</h3>
                    <p className="text-sm text-muted-foreground">Manage your account details and preferences.</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground/80">Name</p>
                    <p className="font-semibold text-foreground">{displayName}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground/80">Email</p>
                    <p className="font-semibold text-foreground">{user.email}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground/80">Role</p>
                    <p className="font-semibold capitalize text-foreground">{profile?.role || user.app_metadata?.role || 'customer'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground/80">Mobile</p>
                    <p className="font-semibold text-foreground">{profile?.mobile || 'Not provided'}</p>
                  </div>
                </div>
                <EditProfileDialog onProfileUpdate={updateUser}>
                  <Button variant="outline" className="border-border bg-background text-foreground hover:bg-muted/50">
                    <Edit className="mr-2 h-4 w-4" /> Edit Profile
                  </Button>
                </EditProfileDialog>
              </div>

              <div className="bento-card p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-primary/10">
                    <CheckCircle className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold tech-heading">Security Settings</h3>
                    <p className="text-sm text-muted-foreground">Manage two-factor authentication and account security.</p>
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-muted/10">
                  <div>
                    <h4 className="font-semibold text-foreground">Two-Factor Authentication</h4>
                    <p className="text-sm text-muted-foreground">
                      {twoFactorStatus?.enabled
                        ? '2FA is enabled for your account'
                        : 'Add an extra layer of security to your account'
                      }
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {twoFactorStatus?.enabled ? (
                      <>
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-300">
                          <CheckCircle className="h-3 w-3" /> Enabled
                        </span>
                        <Button
                          onClick={handleDisable2FA}
                          variant="outline"
                          size="sm"
                          className="border-border bg-background text-foreground hover:bg-muted/50"
                        >
                          Disable
                        </Button>
                      </>
                    ) : (
                      <Button
                        onClick={() => setShowTwoFactorSetup(true)}
                        variant="outline"
                        className="border-border bg-background text-foreground hover:bg-muted/50"
                      >
                        Enable 2FA
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="bento-card p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-full bg-emerald-500/10">
                  <Users className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold tech-heading">Sales Agent Program</h3>
                  <p className="text-sm text-muted-foreground">Join our sales agent program to earn commissions on referrals.</p>
                </div>
              </div>

              {!agentStatus ? (
                <div className="space-y-4">
                  <div className="p-4 border border-border rounded-lg bg-muted/10">
                    <h4 className="font-semibold mb-2 text-foreground">Benefits of becoming a Sales Agent:</h4>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li>• Earn points for every successful referral</li>
                      <li>• Convert points to real money (1 point = ₹1)</li>
                      <li>• Access to exclusive promotional materials</li>
                      <li>• Track your earnings and performance</li>
                    </ul>
                  </div>
                  <Button onClick={handleApplyForAgent} disabled={isApplying} className="bg-primary text-white hover:bg-primary/90 transition-colors font-medium">
                    {isApplying ? 'Submitting Application...' : 'Apply to Become a Sales Agent'}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-foreground">Application Status</h4>
                      <p className="text-sm text-muted-foreground">Your sales agent application is under review.</p>
                    </div>
                    {getStatusBadge(agentStatus.status)}
                  </div>

                  {agentStatus.status === 'approved' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border border-emerald-500/30 rounded-lg bg-emerald-500/10">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Your Referral Code</label>
                        <p className="text-lg font-mono text-foreground font-bold">{agentStatus.referral_code}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Points Balance</label>
                        <p className="text-lg text-foreground font-bold">₹{agentStatus.points_balance || 0}</p>
                      </div>
                    </div>
                  )}

                  {agentStatus.status === 'rejected' && (
                    <div className="p-4 border border-red-500/30 rounded-lg bg-red-500/10">
                      <p className="text-sm text-red-600 dark:text-red-200">
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