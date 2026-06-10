'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, Check, X, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { useAuth } from '@/lib/hooks';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function QuoteDetailPage() {
  const params = useParams();
  const quoteId = params.id as string;
  const { toast } = useToast();
  const { user, supabase } = useAuth();
  
  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(false);

  // Auth / OTP signup state
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authStep, setAuthStep] = useState<'details' | 'otp'>('details');
  const [authForm, setAuthForm] = useState({
    name: '',
    email: '',
    mobile: '',
    address: '',
    password: 'TecBunny@2026!'
  });
  const [otpCode, setOtpCode] = useState('');
  const [otpId, setOtpId] = useState('');
  const [otpChannel, setOtpChannel] = useState<'whatsapp' | 'email'>('whatsapp');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  useEffect(() => {
    if (!quoteId) return;
    
    fetch(`/api/quotes/${quoteId}`)
      .then(res => {
        if (!res.ok) throw new Error('Quote not found');
        return res.json();
      })
      .then(data => {
        setQuote(data);
        setAuthForm({
          name: data.customer_name || '',
          email: data.customer_email || '',
          mobile: data.customer_phone || '',
          address: data.customer_address || '',
          password: 'TecBunny@2026!'
        });
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        toast({ 
          title: 'Error', 
          description: 'Failed to load quote.',
          variant: 'destructive' 
        });
        setLoading(false);
      });
  }, [quoteId, toast]);

  const handleAcceptCounter = async () => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }

    if (!quote?.counter_price) return;
    
    setResponding(true);
    try {
      const res = await fetch(`/api/quotes/${quoteId}/accept-counter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!res.ok) throw new Error('Failed to accept');

      toast({
        title: 'Counter-offer accepted!',
        description: 'Your booking has been confirmed. Proceeding to payment...'
      });

      // Redirect to checkout
      setTimeout(() => {
        window.location.href = `/checkout?quoteId=${quote.quote_number || quote.id}`;
      }, 1500);
    } catch (error) {
      console.error(error);
      toast({
        title: 'Error',
        description: 'Failed to accept counter-offer.',
        variant: 'destructive'
      });
    } finally {
      setResponding(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authForm.name || !authForm.mobile) {
      toast({ variant: 'destructive', title: 'Error', description: 'Name and mobile number are required.' });
      return;
    }
    setSendingOtp(true);
    try {
      const resolvedEmail = authForm.email || `${authForm.mobile}@tecbunny.com`;
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-bypass-captcha': '1' },
        body: JSON.stringify({
          email: resolvedEmail,
          password: authForm.password,
          name: authForm.name,
          mobile: authForm.mobile,
          channel: otpChannel
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send verification code');
      
      setOtpId(data.otpId);
      setAuthStep('otp');
      toast({ title: 'OTP Sent', description: `Verification code sent via ${otpChannel}.` });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtpAndComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.length !== 6) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please enter a valid 6-digit OTP' });
      return;
    }
    setVerifyingOtp(true);
    try {
      const resolvedEmail = authForm.email || `${authForm.mobile}@tecbunny.com`;
      // Step 1: Verify OTP
      const verifyRes = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-bypass-captcha': '1' },
        body: JSON.stringify({
          email: resolvedEmail,
          mobile: authForm.mobile,
          otp: otpCode,
          otpId,
          channel: otpChannel,
          type: 'signup'
        })
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(verifyData.error?.message || verifyData.error || 'Verification failed');

      // Step 2: Complete signup
      const completeRes = await fetch('/api/auth/complete-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: resolvedEmail,
          password: authForm.password,
          name: authForm.name,
          mobile: authForm.mobile,
          otpId
        })
      });
      const completeData = await completeRes.json();
      if (!completeRes.ok) throw new Error(completeData.error || 'Failed to create account');

      // Set the session client side so the browser is logged in!
      if (completeData.session) {
        const { error: sessionErr } = await supabase.auth.setSession({
          access_token: completeData.session.access_token,
          refresh_token: completeData.session.refresh_token
        });
        if (sessionErr) {
          console.error('Failed to set browser session:', sessionErr);
        }
      }

      toast({ title: 'Account Verified!', description: 'Your account has been created. Processing booking...' });

      // Automatically accept the counter-offer now that they are logged in
      const acceptRes = await fetch(`/api/quotes/${quoteId}/accept-counter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!acceptRes.ok) throw new Error('Failed to confirm quote acceptance');

      setIsAuthModalOpen(false);
      
      // Redirect to checkout with quote ID
      setTimeout(() => {
        window.location.href = `/checkout?quoteId=${quote.quote_number || quote.id}`;
      }, 1000);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleRejectCounter = async () => {
    if (!quote?.counter_price) return;
    
    setResponding(true);
    try {
      const res = await fetch(`/api/quotes/${quoteId}/reject-counter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!res.ok) throw new Error('Failed to reject');

      toast({
        title: 'Counter-offer declined',
        description: 'You can contact us to negotiate further.'
      });

      // Refresh quote
      const updated = await fetch(`/api/quotes/${quoteId}`).then(r => r.json());
      setQuote(updated);
    } catch (error) {
      console.error(error);
      toast({
        title: 'Error',
        description: 'Failed to reject counter-offer.',
        variant: 'destructive'
      });
    } finally {
      setResponding(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-950 to-slate-900">
        <Loader2 className="animate-spin h-8 w-8 text-cyan-400" />
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 p-4">
        <div className="max-w-4xl mx-auto">
          <Card className="border-white/10 bg-white/5">
            <CardContent className="py-12">
              <p className="text-center text-slate-400">Quote not found.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const originalPrice = quote.selections?.totals?.sale || quote.selections?.totals?.overall?.sale || 0;
  const bidPrice = quote.bidded_price;
  const counterPrice = quote.counter_price;
  const savings = originalPrice - (counterPrice || bidPrice || originalPrice);
  const savingsPercent = originalPrice > 0 ? ((savings / originalPrice) * 100).toFixed(1) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Your Quote</h1>
            <p className="text-slate-400">Quote Number: {quote.quote_number || quote.id}</p>
          </div>
          <Button
            onClick={async () => {
              try {
                const res = await fetch(`/api/quotes/${quote.quote_number || quote.id}?format=pdf`);
                if (!res.ok) throw new Error('Download failed');
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `quote-${quote.quote_number || quote.id}.pdf`;
                document.body.appendChild(link);
                link.click();
                link.remove();
                window.URL.revokeObjectURL(url);
                toast({ title: 'Success', description: 'Quote PDF downloaded successfully.' });
              } catch (err) {
                toast({ variant: 'destructive', title: 'Error', description: 'Failed to download PDF.' });
              }
            }}
            className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold gap-2 self-stretch sm:self-auto"
          >
            <Download className="h-4 w-4" /> Download PDF
          </Button>
        </div>

        <Separator className="bg-white/10" />

        {/* Quote Summary */}
        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-white">Quote Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                <p className="text-xs text-slate-500 mb-1">Original Quote</p>
                <p className="text-2xl font-bold text-white">₹{Math.round(originalPrice).toLocaleString()}</p>
              </div>
              {quote.status === 'created' && (
                <div className="bg-slate-500/10 p-4 rounded-lg border border-slate-500/30">
                  <p className="text-xs text-slate-400 mb-1">Status</p>
                  <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">Pending Your Bid</Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Bid Section */}
        {bidPrice && (
          <Card className="border-amber-500/30 bg-amber-500/10">
            <CardHeader>
              <CardTitle className="text-amber-200">Your Bid Submitted</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-end gap-4">
                <div>
                  <p className="text-sm text-amber-400/70 mb-1">Price You Offered</p>
                  <p className="text-3xl font-bold text-amber-300">₹{Math.round(bidPrice).toLocaleString()}</p>
                </div>
                <div className="text-sm text-amber-400">
                  {originalPrice > bidPrice ? (
                    <>
                      <p>You asked for {((originalPrice - bidPrice) / originalPrice * 100).toFixed(1)}% off</p>
                    </>
                  ) : (
                    <p>Higher than original</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Counter Offer Section */}
        {counterPrice && (
          <Card className="border-cyan-500/50 bg-cyan-500/10">
            <CardHeader>
              <CardTitle className="text-cyan-200">Counter-Offer Received</CardTitle>
              <p className="text-xs text-cyan-400/70 mt-2">Our team has reviewed your bid and made a revised offer:</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                  <p className="text-xs text-slate-500 mb-1">Your Bid</p>
                  <p className="text-2xl font-bold text-amber-300">₹{Math.round(bidPrice).toLocaleString()}</p>
                </div>
                <div className="bg-cyan-600/20 p-4 rounded-lg border border-cyan-500/50">
                  <p className="text-xs text-cyan-400 mb-1">Our Counter Offer</p>
                  <p className="text-2xl font-bold text-cyan-300">₹{Math.round(counterPrice).toLocaleString()}</p>
                  {savings > 0 && (
                    <p className="text-xs text-green-400 mt-1">
                      ✓ {savingsPercent}% off original ({Math.round(savings).toLocaleString()} saved)
                    </p>
                  )}
                </div>
              </div>

              {quote.negotiation_clauses && (
                <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                  <p className="text-sm font-semibold text-slate-300 mb-2">Payment Terms</p>
                  <p className="text-sm text-slate-400 whitespace-pre-wrap">{quote.negotiation_clauses}</p>
                </div>
              )}

              <div className="flex gap-3">
                <Button 
                  onClick={handleRejectCounter}
                  disabled={responding}
                  variant="outline"
                  className="flex-1 border-white/20 text-slate-300 hover:bg-white/5"
                >
                  {responding ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <X className="h-4 w-4 mr-2" />}
                  Decline
                </Button>
                <Button 
                  onClick={handleAcceptCounter}
                  disabled={responding}
                  className="flex-1 bg-cyan-600 hover:bg-cyan-700"
                >
                  {responding ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                  Accept & Proceed
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Status Flow */}
        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-sm text-slate-400">Quote Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex gap-3 items-start">
                <div className="mt-1.5">
                  <div className="h-3 w-3 rounded-full bg-cyan-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Quote Generated</p>
                  <p className="text-xs text-slate-500">{format(new Date(quote.created_at), 'PPP p')}</p>
                </div>
              </div>
              
              {bidPrice && (
                <div className="flex gap-3 items-start">
                  <div className="mt-1.5">
                    <div className="h-3 w-3 rounded-full bg-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">Your Bid Received</p>
                    <p className="text-xs text-slate-500">You offered ₹{Math.round(bidPrice).toLocaleString()}</p>
                  </div>
                </div>
              )}

              {counterPrice && (
                <div className="flex gap-3 items-start">
                  <div className="mt-1.5">
                    <div className="h-3 w-3 rounded-full bg-cyan-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">Counter-Offer Sent</p>
                    <p className="text-xs text-slate-500">We're offering ₹{Math.round(counterPrice).toLocaleString()}</p>
                  </div>
                </div>
              )}

              {quote.status === 'accepted' && (
                <div className="flex gap-3 items-start">
                  <div className="mt-1.5">
                    <div className="h-3 w-3 rounded-full bg-green-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">Booking Confirmed</p>
                    <p className="text-xs text-slate-500">Ready for installation scheduling</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Account Verification Modal */}
      <Dialog open={isAuthModalOpen} onOpenChange={setIsAuthModalOpen}>
        <DialogContent className="sm:max-w-md border-white/10 bg-slate-900/95 text-slate-100 backdrop-blur-md">
          <DialogHeader>
            <DialogTitle className="text-2xl text-center font-bold text-white">Create Account & Proceed</DialogTitle>
            <DialogDescription className="text-center text-slate-400">
              Verify your details to secure your account and checkout.
            </DialogDescription>
          </DialogHeader>

          {authStep === 'details' ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Name</label>
                <input
                  type="text"
                  required
                  placeholder="Enter your name"
                  className="w-full bg-white/5 border border-white/10 rounded-md p-2 text-white"
                  value={authForm.name}
                  onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Mobile Number</label>
                <input
                  type="tel"
                  required
                  placeholder="Enter your 10-digit mobile number"
                  className="w-full bg-white/5 border border-white/10 rounded-md p-2 text-white"
                  value={authForm.mobile}
                  onChange={(e) => setAuthForm({ ...authForm, mobile: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Email Address (Optional)</label>
                <input
                  type="email"
                  placeholder="Enter your email address"
                  className="w-full bg-white/5 border border-white/10 rounded-md p-2 text-white"
                  value={authForm.email}
                  onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Installation Address (Optional)</label>
                <textarea
                  placeholder="Enter installation address"
                  className="w-full bg-white/5 border border-white/10 rounded-md p-2 text-white h-20 resize-none"
                  value={authForm.address}
                  onChange={(e) => setAuthForm({ ...authForm, address: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Account Password</label>
                <input
                  type="password"
                  required
                  placeholder="Enter password"
                  className="w-full bg-white/5 border border-white/10 rounded-md p-2 text-white"
                  value={authForm.password}
                  onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                />
                <p className="text-[10px] text-slate-500">Min. 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char.</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300 block">Send OTP via</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="radio"
                      name="otp_channel"
                      checked={otpChannel === 'whatsapp'}
                      onChange={() => setOtpChannel('whatsapp')}
                    />
                    WhatsApp
                  </label>
                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="radio"
                      name="otp_channel"
                      checked={otpChannel === 'email'}
                      onChange={() => setOtpChannel('email')}
                    />
                    Email
                  </label>
                </div>
              </div>

              <Button
                type="submit"
                disabled={sendingOtp}
                className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold"
              >
                {sendingOtp ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Send OTP
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtpAndComplete} className="space-y-6">
              <div className="space-y-2 text-center">
                <p className="text-sm text-slate-300">
                  Enter the 6-digit code sent via {otpChannel === 'whatsapp' ? 'WhatsApp' : 'Email'}
                </p>
              </div>

              <input
                type="text"
                required
                maxLength={6}
                placeholder="000000"
                className="w-full bg-white/5 border border-white/10 rounded-md p-3 text-white text-center text-xl font-mono tracking-widest"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 border-white/10 text-slate-300 hover:bg-white/5"
                  onClick={() => setAuthStep('details')}
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={verifyingOtp || otpCode.length !== 6}
                  className="flex-1 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold"
                >
                  {verifyingOtp ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Verify & Complete
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
