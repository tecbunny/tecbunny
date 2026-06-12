'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, Loader2, Handshake, Check, X, Send, CreditCard, Share2, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '../../../../hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function AdminQuotesPage() {
  const [quotes, setQuotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuote, setSelectedQuote] = useState<any>(null);
  const [showBidModal, setShowBidModal] = useState(false);
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [counterPrice, setCounterPrice] = useState('');
  const [clauses, setClauses] = useState('60% advance payment required');
  const [respondLoading, setRespondLoading] = useState(false);
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'payu' | 'wire_transfer'>('payu');
  const [advanceLoading, setAdvanceLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetch('/api/admin/quotes')
      .then(res => res.json())
      .then(data => {
        setQuotes(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const handleRespond = async (action: 'approve' | 'counter' | 'reject'): Promise<void> => {
    if (action === 'counter' && !counterPrice) {
      toast({ variant: 'destructive', title: 'Missing counter price', description: 'Please enter the counter offer price.' });
      return;
    }

    setRespondLoading(true);
    try {
      const res = await fetch(`/api/admin/quotes/${selectedQuote.id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          counterPrice: action === 'counter' ? Number(counterPrice) : null,
          clauses: action === 'counter' ? clauses : null
        })
      });

      if (!res.ok) throw new Error('Failed to respond');

      toast({
        title: 'Response sent',
        description: `Quote ${action === 'approve' ? 'approved' : action === 'counter' ? 'countered' : 'rejected'}.`
      });

      setShowBidModal(false);
      setSelectedQuote(null);
      setCounterPrice('');
      setClauses('60% advance payment required');

      // Refresh list
      const updated = await fetch('/api/admin/quotes').then(r => r.json());
      setQuotes(Array.isArray(updated) ? updated : []);
    } catch (error) {
      console.error(error);
      toast({
        title: 'Error',
        description: 'Failed to send response.',
        variant: 'destructive'
      });
    } finally {
      setRespondLoading(false);
    }
  };

  const handleSetAdvancePayment = async (): Promise<void> => {
    if (!advanceAmount || !selectedQuote) {
      toast({ variant: 'destructive', title: 'Missing advance amount', description: 'Please enter the advance payment amount.' });
      return;
    }

    const totalAmount = selectedQuote.counter_price || selectedQuote.bidded_price || selectedQuote.selections?.totals?.sale || selectedQuote.selections?.totals?.overall?.sale || 0;
    const advanceAmountNum = Number(advanceAmount);

    if (advanceAmountNum <= 0 || advanceAmountNum >= totalAmount) {
      toast({ variant: 'destructive', title: 'Invalid amount', description: 'Advance must be greater than 0 and less than total amount.' });
      return;
    }

    setAdvanceLoading(true);
    try {
      const res = await fetch('/api/admin/quotes/advance-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await getAuthToken()}` },
        body: JSON.stringify({
          quote_id: selectedQuote.id,
          advance_amount: advanceAmountNum,
          total_amount: totalAmount,
          payment_method: paymentMethod,
          payment_terms: clauses
        })
      });

      if (!res.ok) throw new Error('Failed to set advance payment');

      toast({
        title: 'Advance payment set',
        description: 'Customer has been notified and can now proceed with payment.'
      });

      setShowAdvanceModal(false);
      setSelectedQuote(null);
      setAdvanceAmount('');
      setPaymentMethod('payu');

      // Refresh list
      const updated = await fetch('/api/admin/quotes').then(r => r.json());
      setQuotes(Array.isArray(updated) ? updated : []);
    } catch (error: any) {
      console.error(error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to set advance payment.',
        variant: 'destructive'
      });
    } finally {
      setAdvanceLoading(false);
    }
  };

  const getAuthToken = async (): Promise<string> => {
    // This should be fetched from your auth context/store
    const token = localStorage.getItem('supabase_auth_token') || '';
    return token;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Quotes & Bids</h1>
        <p className="text-sm text-muted-foreground">Review, negotiate, and manage customer quote requests and bids.</p>
      </div>
      <Separator className="bg-border" />
      
      <Card className="border-border bg-card text-foreground">
        <CardHeader>
          <CardTitle>Generated Quotes & Bids</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
             <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>
          ) : quotes.length === 0 ? (
             <p className="text-center p-8 text-muted-foreground">No quotes found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-muted/30">
                  <TableHead className="text-muted-foreground">Date</TableHead>
                  <TableHead className="text-muted-foreground">Customer</TableHead>
                  <TableHead className="text-muted-foreground">Phone</TableHead>
                  <TableHead className="text-muted-foreground">Quote Price</TableHead>
                  <TableHead className="text-muted-foreground">Bid Price</TableHead>
                  <TableHead className="text-muted-foreground">Status</TableHead>
                  <TableHead className="text-right text-muted-foreground">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotes.map((quote) => (
                  <TableRow key={quote.id} className="border-border hover:bg-muted/30">
                    <TableCell className="text-sm">{format(new Date(quote.created_at), 'MMM dd, yyyy')}</TableCell>
                    <TableCell className="font-medium">
                      <div>{quote.customer_name}</div>
                      <div className="text-[10px] font-normal text-muted-foreground font-mono">
                        {quote.quote_number || quote.id.substring(0, 8)}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{quote.customer_phone}</TableCell>
                    <TableCell className="text-sm">₹{Math.round(quote.selections?.totals?.sale || quote.selections?.totals?.overall?.sale || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-sm font-semibold text-amber-500">{quote.bidded_price ? `₹${Math.round(quote.bidded_price).toLocaleString()}` : '-'}</TableCell>
                    <TableCell>
                      <Badge className={
                        quote.status === 'created' ? 'bg-blue-500/20 text-blue-500 dark:text-blue-300 border-blue-500/30' :
                        quote.status === 'bidded' ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300 border-amber-500/30' :
                        quote.status === 'accepted' ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border-emerald-500/30' :
                        quote.status === 'countered' ? 'bg-purple-500/20 text-purple-600 dark:text-purple-300 border-purple-500/30' :
                        'bg-red-500/20 text-red-600 dark:text-red-300 border-red-500/30'
                      } variant="outline">{quote.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        {quote.status === 'bidded' && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                              setSelectedQuote(quote);
                              setCounterPrice(quote.bidded_price?.toString() || '');
                              setClauses(quote.negotiation_clauses || '60% advance payment required');
                              setShowBidModal(true);
                            }}
                            className="text-primary hover:bg-primary/10"
                          >
                            <Handshake className="h-4 w-4 mr-1" /> Respond
                          </Button>
                        )}
                        {['accepted', 'countered'].includes(quote.status) && !quote.advance_payment_id && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                              setSelectedQuote(quote);
                              const total = quote.counter_price || quote.bidded_price || quote.selections?.totals?.sale || quote.selections?.totals?.overall?.sale || 0;
                              setAdvanceAmount((total * 0.6).toFixed(2));
                              setClauses(quote.negotiation_clauses || '60% advance payment required');
                              setShowAdvanceModal(true);
                            }}
                            className="text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                          >
                            <CreditCard className="h-4 w-4 mr-1" /> Advance Payment
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => {
                            const url = `${window.location.origin}/quotes/${quote.quote_number || quote.id}`;
                            navigator.clipboard.writeText(url);
                            toast({
                              title: 'Copied!',
                              description: 'Public link copied to clipboard.'
                            });
                          }}
                          className="text-primary hover:bg-primary/10 hover:text-primary/80"
                          title="Copy Public Link"
                        >
                          <Share2 className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => {
                            window.open(`/quotes/${quote.quote_number || quote.id}`, '_blank');
                          }}
                          className="text-muted-foreground hover:bg-muted hover:text-foreground"
                          title="Open Public Link"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => {
                          // Download PDF logic
                          toast({ title: 'Download', description: 'PDF download feature coming soon.' });
                        }}>
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>      {showBidModal && selectedQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <Card className="w-full max-w-2xl border-border bg-card">
            <CardHeader className="border-b border-border">
              <CardTitle className="text-foreground">Respond to Bid</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/50 p-4 rounded-lg border border-border">
                  <p className="text-xs text-muted-foreground mb-1">Original Quote Total</p>
                  <p className="text-2xl font-bold text-foreground">₹{Math.round(selectedQuote.selections?.totals?.sale || selectedQuote.selections?.totals?.overall?.sale || 0).toLocaleString()}</p>
                </div>
                <div className="bg-amber-500/10 p-4 rounded-lg border border-amber-500/30">
                  <p className="text-xs text-amber-600 dark:text-amber-400 mb-1">Customer's Bid</p>
                  <p className="text-2xl font-bold text-amber-500 dark:text-amber-300">₹{Math.round(selectedQuote.bidded_price || 0).toLocaleString()}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-muted-foreground mb-2 block">Counter Offer Price (₹)</Label>
                  <Input 
                    type="number" 
                    value={counterPrice} 
                    onChange={e => setCounterPrice(e.target.value)}
                    className="bg-muted/50 border-border text-foreground" 
                    placeholder="Enter counter offer price"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Leave empty to approve bid as-is</p>
                </div>

                <div>
                  <Label className="text-muted-foreground mb-2 block">Payment Clauses & Conditions</Label>
                  <textarea 
                    value={clauses} 
                    onChange={e => setClauses(e.target.value)}
                    rows={3}
                    className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/20"
                    placeholder="E.g. 60% advance payment, 40% on completion"
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <Button 
                  variant="ghost" 
                  onClick={() => setShowBidModal(false)}
                  className="text-muted-foreground hover:text-foreground"
                  disabled={respondLoading}
                >
                  Cancel
                </Button>
                <Button 
                  variant="destructive"
                  onClick={() => handleRespond('reject')}
                  disabled={respondLoading}
                  className="gap-2"
                >
                  <X className="h-4 w-4" /> Reject
                </Button>
                <Button 
                  onClick={() => handleRespond('approve')}
                  disabled={respondLoading || counterPrice !== ''}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 border-0"
                >
                  <Check className="h-4 w-4" /> {respondLoading ? 'Approving...' : 'Approve'}
                </Button>
                <Button 
                  onClick={() => handleRespond('counter')}
                  disabled={respondLoading || !counterPrice}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
                >
                  <Send className="h-4 w-4" /> {respondLoading ? 'Sending...' : 'Send Counter'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showAdvanceModal && selectedQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <Card className="w-full max-w-2xl border-border bg-card">
            <CardHeader className="border-b border-border">
              <CardTitle className="text-foreground">Set Advance Payment</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/50 p-4 rounded-lg border border-border">
                  <p className="text-xs text-muted-foreground mb-1">Total Amount</p>
                  <p className="text-2xl font-bold text-foreground">₹{Math.round(selectedQuote.counter_price || selectedQuote.bidded_price || selectedQuote.selections?.totals?.sale || selectedQuote.selections?.totals?.overall?.sale || 0).toLocaleString()}</p>
                </div>
                <div className="bg-emerald-500/10 p-4 rounded-lg border border-emerald-500/30">
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-1">Balance Due</p>
                  <p className="text-2xl font-bold text-emerald-500 dark:text-emerald-300">₹{Math.round((selectedQuote.counter_price || selectedQuote.bidded_price || selectedQuote.selections?.totals?.sale || selectedQuote.selections?.totals?.overall?.sale || 0) - Number(advanceAmount || 0)).toLocaleString()}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-muted-foreground mb-2 block">Advance Amount (₹)</Label>
                  <Input 
                    type="number" 
                    value={advanceAmount} 
                    onChange={e => setAdvanceAmount(e.target.value)}
                    className="bg-muted/50 border-border text-foreground" 
                    placeholder="Enter advance amount"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Typically 50-60% of total amount</p>
                </div>

                <div>
                  <Label className="text-muted-foreground mb-2 block">Payment Method</Label>
                  <div className="flex gap-3">
                    <Button 
                      variant={paymentMethod === 'payu' ? 'default' : 'outline'}
                      onClick={() => setPaymentMethod('payu')}
                      className={paymentMethod === 'payu' ? 'bg-primary hover:bg-primary/90 text-primary-foreground border-0' : 'border-border'}
                    >
                      PayU Online
                    </Button>
                    <Button 
                      variant={paymentMethod === 'wire_transfer' ? 'default' : 'outline'}
                      onClick={() => setPaymentMethod('wire_transfer')}
                      className={paymentMethod === 'wire_transfer' ? 'bg-primary hover:bg-primary/90 text-primary-foreground border-0' : 'border-border'}
                    >
                      Wire Transfer
                    </Button>
                  </div>
                </div>

                <div>
                  <Label className="text-muted-foreground mb-2 block">Payment Terms & Conditions</Label>
                  <textarea 
                    value={clauses} 
                    onChange={e => setClauses(e.target.value)}
                    rows={3}
                    className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/20"
                    placeholder="E.g. 60% advance payment, 40% on completion. Free installation valid upto ₹2,499"
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <Button 
                  variant="ghost" 
                  onClick={() => setShowAdvanceModal(false)}
                  className="text-muted-foreground hover:text-foreground"
                  disabled={advanceLoading}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleSetAdvancePayment}
                  disabled={advanceLoading || !advanceAmount}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 border-0"
                >
                  <CreditCard className="h-4 w-4" /> {advanceLoading ? 'Setting...' : 'Set & Notify'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
