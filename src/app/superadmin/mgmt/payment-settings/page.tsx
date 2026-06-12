'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, Save, RefreshCw, CreditCard, ToggleLeft, ToggleRight, 
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
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <Link
          href="/superadmin/mgmt/dashboard"
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Control Center
        </Link>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <CreditCard className="h-6 w-6 text-primary" />
          Payment Gateway Override Settings
        </h2>
        <p className="text-zinc-400 text-xs mt-1">
          Mutate merchant keys, encryption salts, environment preference, and view callback endpoints.
        </p>
      </div>

      {isLoading ? (
        <div className="h-96 bg-zinc-900/50 border border-zinc-800 rounded-xl flex items-center justify-center">
          <RefreshCw className="h-8 w-8 text-primary animate-spin" />
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          {/* Activation status */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 shadow-lg flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">PayU Paisa Gateway Status</h3>
              <p className="text-zinc-400 text-xs mt-1">Activate or suspend the online payment processing routing.</p>
            </div>
            <button
              type="button"
              onClick={() => setIsEnabled(!isEnabled)}
              className="text-zinc-400 hover:text-white transition-colors outline-none"
            >
              {isEnabled ? (
                <ToggleRight className="h-10 w-10 text-primary" />
              ) : (
                <ToggleLeft className="h-10 w-10 text-zinc-600" />
              )}
            </button>
          </div>

          {/* Merchant keys override */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 shadow-lg space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-white tracking-wide">PayU merchant credentials</h3>
              <button
                type="button"
                onClick={() => setShowCredentials(!showCredentials)}
                className="text-xs text-primary hover:text-primary/80 transition-colors flex items-center gap-1 font-mono"
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
              <label className="text-xs text-zinc-400 block">Merchant Key</label>
              <input
                type={showCredentials ? 'text' : 'password'}
                value={merchantKey}
                onChange={(e) => setMerchantKey(e.target.value)}
                placeholder="e.g. 8qqffns1xt2"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 font-mono text-xs text-white outline-none focus:border-primary transition-colors"
                required={isEnabled}
              />
            </div>

            {/* Merchant Salt */}
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400 block">Merchant Salt</label>
              <input
                type={showCredentials ? 'text' : 'password'}
                value={merchantSalt}
                onChange={(e) => setMerchantSalt(e.target.value)}
                placeholder="e.g. 3a7f8b9c..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 font-mono text-xs text-white outline-none focus:border-primary transition-colors"
                required={isEnabled}
              />
            </div>

            {/* Gateway environment */}
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400 block">Gateway Environment Mode</label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setEnvironment('test')}
                  className={`py-2 px-4 rounded-lg border text-xs font-semibold uppercase tracking-wider transition-colors ${
                    environment === 'test'
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  Test Sandbox
                </button>
                <button
                  type="button"
                  onClick={() => setEnvironment('production')}
                  className={`py-2 px-4 rounded-lg border text-xs font-semibold uppercase tracking-wider transition-colors ${
                    environment === 'production'
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  Production Live
                </button>
              </div>
            </div>
          </div>

          {/* Webhook and return URLs display */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 shadow-lg space-y-4">
            <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-1.5">
              <Globe className="h-4 w-4 text-primary" />
              Callback URL Integration
            </h3>
            <p className="text-zinc-400 text-xs leading-relaxed">
              Add this exact endpoint URL to your PayU Merchant Dashboard under webhook parameters so status changes can be synchronised back to the local database ledger:
            </p>
            <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 flex items-center justify-between font-mono text-[10px] text-primary">
              <span className="truncate">{webhookUrl}</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(webhookUrl);
                  toast({ title: 'Copied', description: 'Callback URL copied to clipboard.' });
                }}
                className="px-2 py-1 rounded bg-primary/10 hover:bg-primary/20 text-[9px] uppercase tracking-wider text-primary transition-colors shrink-0 font-sans ml-2"
              >
                Copy
              </button>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
              <HelpCircle className="h-3 w-3" />
              <span>The surl and furl params will automatically target this verification loop.</span>
            </div>
          </div>

          {/* Save Actions */}
          <div className="flex justify-end gap-3">
            <Link
              href="/superadmin/mgmt/dashboard"
              className="px-5 py-2.5 rounded-lg text-zinc-400 hover:text-white text-xs font-semibold uppercase tracking-wider transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 bg-primary hover:bg-primary/95 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-bold text-xs tracking-widest uppercase text-white flex items-center gap-1.5 shadow-[0_0_15px_rgba(37,99,235,0.15)] transition-colors"
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
    </div>
  );
}
