'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ShieldAlert, ArrowLeft, Terminal, Save, 
  RefreshCw, CreditCard, ToggleLeft, ToggleRight, 
  HelpCircle, Eye, EyeOff, Globe 
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function PaymentSettingsConsole() {
  const [isEnabled, setIsEnabled] = useState(true);
  const [merchantKey, setMerchantKey] = useState('');
  const [merchantSalt, setMerchantSalt] = useState('');
  const [environment, setEnvironment] = useState('test');
  const [showCredentials, setShowCredentials] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const [webhookUrl, setWebhookUrl] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setWebhookUrl(`${window.location.origin}/api/payment/payu/callback`);
    }

    const loadPaymentSettings = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/settings?keys=payu_enabled,payu_merchant_key,payu_merchant_salt,payu_environment');
        if (response.ok) {
          const data = await response.json();
          setIsEnabled(data.payu_enabled === 'true' || data.payu_enabled === undefined);
          setMerchantKey(data.payu_merchant_key || '');
          setMerchantSalt(data.payu_merchant_salt || '');
          setEnvironment(data.payu_environment || 'test');
        }
      } catch (err) {
        console.error('Failed to load payment settings:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadPaymentSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const settings = [
        { key: 'payu_enabled', value: isEnabled ? 'true' : 'false', description: 'Enable or disable PayU gateway' },
        { key: 'payu_merchant_key', value: merchantKey.trim(), description: 'PayU Merchant Key credential' },
        { key: 'payu_merchant_salt', value: merchantSalt.trim(), description: 'PayU Cryptographic Merchant Salt' },
        { key: 'payu_environment', value: environment, description: 'Active PayU Environment: test or production' }
      ];

      for (const setting of settings) {
        const response = await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(setting)
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || `Failed to save ${setting.key}`);
        }
      }

      toast({
        title: 'Credentials Saved',
        description: 'PayU credentials and routing updated successfully.',
      });
    } catch (err: any) {
      console.error('Save failed:', err);
      toast({
        title: 'Error Saving Settings',
        description: err.message || 'Check database configurations.',
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex flex-col font-sans relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-rose-500/5 rounded-full blur-[140px] pointer-events-none" />

      {/* Header */}
      <header className="border-b border-rose-500/20 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-6 w-6 text-rose-500" />
            <span className="font-semibold tracking-widest text-sm uppercase text-white">Payment settings console</span>
          </div>
          <Link
            href="/superadmin/mgmt/dashboard"
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Control Center
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-10 space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-rose-500" />
            Payment Gateway Override Settings
          </h2>
          <p className="text-slate-400 text-xs mt-1">
            Mutate merchant keys, encryption salts, environment preference, and view callback endpoints.
          </p>
        </div>

        {isLoading ? (
          <div className="h-96 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-center">
            <RefreshCw className="h-8 w-8 text-rose-500 animate-spin" />
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            {/* Activation status */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 shadow-lg flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white tracking-wide">PayU Paisa Gateway Status</h3>
                <p className="text-slate-400 text-xs mt-1">Activate or suspend the online payment processing routing.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsEnabled(!isEnabled)}
                className="text-slate-400 hover:text-white transition-colors outline-none"
              >
                {isEnabled ? (
                  <ToggleRight className="h-10 w-10 text-emerald-400" />
                ) : (
                  <ToggleLeft className="h-10 w-10 text-slate-600" />
                )}
              </button>
            </div>

            {/* Merchant keys override */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 shadow-lg space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-white tracking-wide">PayU merchant credentials</h3>
                <button
                  type="button"
                  onClick={() => setShowCredentials(!showCredentials)}
                  className="text-xs text-rose-400 hover:text-rose-300 transition-colors flex items-center gap-1 font-mono"
                >
                  {showCredentials ? (
                    <>
                      <EyeOff className="h-3.5 w-3.5" /> MASK_KEYS
                    </>
                  ) : (
                    <>
                      <Eye className="h-3.5 w-3.5" /> REVEAL_KEYS
                    </>
                  )}
                </button>
              </div>

              {/* Merchant Key */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 block">Merchant Key</label>
                <input
                  type={showCredentials ? 'text' : 'password'}
                  value={merchantKey}
                  onChange={(e) => setMerchantKey(e.target.value)}
                  placeholder="e.g. 8qqffns1xt2"
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-2.5 font-mono text-xs text-white outline-none focus:border-rose-500 transition-colors"
                  required={isEnabled}
                />
              </div>

              {/* Merchant Salt */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 block">Merchant Salt</label>
                <input
                  type={showCredentials ? 'text' : 'password'}
                  value={merchantSalt}
                  onChange={(e) => setMerchantSalt(e.target.value)}
                  placeholder="e.g. 3a7f8b9c..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-2.5 font-mono text-xs text-white outline-none focus:border-rose-500 transition-colors"
                  required={isEnabled}
                />
              </div>

              {/* Gateway environment */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 block">Gateway Environment Mode</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setEnvironment('test')}
                    className={`py-2 px-4 rounded-lg border text-xs font-semibold uppercase tracking-wider transition-colors ${
                      environment === 'test'
                        ? 'bg-rose-500/10 border-rose-500 text-rose-400'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    Test Sandbox
                  </button>
                  <button
                    type="button"
                    onClick={() => setEnvironment('production')}
                    className={`py-2 px-4 rounded-lg border text-xs font-semibold uppercase tracking-wider transition-colors ${
                      environment === 'production'
                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    Production Live
                  </button>
                </div>
              </div>
            </div>

            {/* Webhook and return URLs display */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 shadow-lg space-y-4">
              <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-1.5">
                <Globe className="h-4 w-4 text-indigo-400" />
                Callback URL Integration
              </h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Add this exact endpoint URL to your PayU Merchant Dashboard under webhook parameters so status changes can be synchronised back to the local database ledger:
              </p>
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex items-center justify-between font-mono text-[10px] text-indigo-300">
                <span className="truncate">{webhookUrl}</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(webhookUrl);
                    toast({ title: 'Copied', description: 'Callback URL copied to clipboard.' });
                  }}
                  className="px-2 py-1 rounded bg-indigo-500/10 hover:bg-indigo-500/20 text-[9px] uppercase tracking-wider text-indigo-400 transition-colors shrink-0 font-sans ml-2"
                >
                  Copy
                </button>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                <HelpCircle className="h-3 w-3" />
                <span>The surl and furl params will automatically target this verification loop.</span>
              </div>
            </div>

            {/* Save Actions */}
            <div className="flex justify-end gap-3">
              <Link
                href="/superadmin/mgmt/dashboard"
                className="px-5 py-2.5 rounded-lg text-slate-400 hover:text-white text-xs font-semibold uppercase tracking-wider transition-colors"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-bold text-xs tracking-widest uppercase text-white flex items-center gap-1.5 shadow-[0_0_15px_rgba(244,63,94,0.15)] transition-colors"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5" /> Save Configuration
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
