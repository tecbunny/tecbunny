'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Loader2, FileUp, Check, AlertCircle, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

export default function AdvancePaymentPage() {
  const params = useParams();
  const router = useRouter();
  const quoteId = params.id as string;
  const { toast } = useToast();
  
  const [advancePayment, setAdvancePayment] = useState<any>(null);
  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [quotationFile, setQuotationFile] = useState<File | null>(null);
  const [customerNotes, setCustomerNotes] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);

  useEffect(() => {
    if (!quoteId) return;
    
    Promise.all([
      fetch(`/api/quotes/${quoteId}`).then(r => r.ok ? r.json() : Promise.reject('Quote not found')),
      fetch(`/api/admin/quotes/advance-payment?quote_id=${quoteId}`).then(r => r.ok ? r.json() : { data: null })
    ])
      .then(([quoteData, advanceData]) => {
        setQuote(quoteData);
        if (advanceData?.data) {
          setAdvancePayment(advanceData.data);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        toast({ 
          title: 'Error', 
          description: 'Failed to load advance payment request.',
          variant: 'destructive' 
        });
        setLoading(false);
      });
  }, [quoteId, toast]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type and size
      const validTypes = ['application/pdf', 'image/jpeg', 'image/png'];
      if (!validTypes.includes(file.type)) {
        toast({
          title: 'Invalid file type',
          description: 'Please upload a PDF, JPEG, or PNG file.',
          variant: 'destructive'
        });
        return;
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB
        toast({
          title: 'File too large',
          description: 'Please upload a file smaller than 5MB.',
          variant: 'destructive'
        });
        return;
      }
      setQuotationFile(file);
    }
  };

  const handleSubmit = async () => {
    if (!advancePayment || !agreeToTerms) {
      toast({
        title: 'Validation error',
        description: 'Please agree to the terms before proceeding.',
        variant: 'destructive'
      });
      return;
    }

    setSubmitting(true);
    try {
      let quotationUrl = null;

      // Upload quotation file if provided
      if (quotationFile) {
        setUploadingFile(true);
        const formData = new FormData();
        formData.append('file', quotationFile);
        formData.append('quote_id', quoteId);
        formData.append('type', 'final_quotation');

        const uploadRes = await fetch('/api/uploads/quote-documents', {
          method: 'POST',
          body: formData,
        });

        if (!uploadRes.ok) {
          throw new Error('Failed to upload quotation file');
        }

        const uploadData = await uploadRes.json();
        quotationUrl = uploadData.url;
        setUploadingFile(false);
      }

      // Confirm advance payment
      const confirmRes = await fetch(`/api/quotes/${quoteId}/advance-payment/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          advance_payment_id: advancePayment.id,
          final_quotation_url: quotationUrl,
          customer_notes: customerNotes,
          agree_to_terms: true,
        }),
      });

      if (!confirmRes.ok) {
        throw new Error('Failed to confirm advance payment');
      }

      const confirmData = await confirmRes.json();
      setAdvancePayment(confirmData.data);

      toast({
        title: 'Confirmed!',
        description: 'Generating payment link...'
      });

      // Generate PayU payment link
      const paymentRes = await fetch(`/api/quotes/${quoteId}/advance-payment/generate-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          advance_payment_id: advancePayment.id,
        }),
      });

      if (!paymentRes.ok) {
        throw new Error('Failed to generate payment link');
      }

      const paymentData = await paymentRes.json();
      
      // For PayU, we need to submit a form to their payment gateway
      if (advancePayment.payment_method === 'payu') {
        submitPayUForm(paymentData.data);
      } else if (advancePayment.payment_method === 'wire_transfer') {
        // Redirect to wire transfer instructions page
        window.location.href = `/quotes/${quoteId}/advance-payment/wire-transfer?ref=${advancePayment.id}`;
      }
    } catch (error: any) {
      console.error(error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to process advance payment confirmation.',
        variant: 'destructive'
      });
    } finally {
      setSubmitting(false);
      setUploadingFile(false);
    }
  };

  const submitPayUForm = (paymentData: any) => {
    // Create and submit PayU form
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = paymentData.paymentUrl;

    Object.entries(paymentData.paymentParams).forEach(([key, value]) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = key;
      input.value = String(value);
      form.appendChild(input);
    });

    document.body.appendChild(form);
    form.submit();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-950 to-slate-900">
        <Loader2 className="animate-spin h-8 w-8 text-cyan-400" />
      </div>
    );
  }

  if (!advancePayment) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 p-4">
        <div className="max-w-4xl mx-auto">
          <Card className="border-white/10 bg-white/5">
            <CardContent className="py-12">
              <p className="text-center text-slate-400">No advance payment request found for this quote.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const isConfirmed = advancePayment.status === 'confirmed' || ['payment_initiated', 'paid', 'completed'].includes(advancePayment.status);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Advance Payment Required</h1>
          <p className="text-slate-400">Please review and confirm the payment terms below</p>
        </div>

        <Separator className="bg-white/10" />

        {/* Status Badge */}
        <div className="flex items-center gap-2">
          <Badge className={`${
            advancePayment.status === 'paid' ? 'bg-green-600' :
            advancePayment.status === 'payment_initiated' ? 'bg-blue-600' :
            advancePayment.status === 'confirmed' ? 'bg-amber-600' :
            'bg-slate-600'
          }`}>
            {advancePayment.status.charAt(0).toUpperCase() + advancePayment.status.slice(1)}
          </Badge>
        </div>

        {/* Payment Details */}
        <Card className="border-cyan-500/50 bg-cyan-500/10">
          <CardHeader>
            <CardTitle className="text-cyan-200">Payment Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                <p className="text-xs text-slate-500 mb-1">Advance Amount Due</p>
                <p className="text-3xl font-bold text-cyan-300">₹{Math.round(advancePayment.advance_amount).toLocaleString('en-IN')}</p>
              </div>
              <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                <p className="text-xs text-slate-500 mb-1">Total Quote Amount</p>
                <p className="text-3xl font-bold text-slate-300">₹{Math.round(advancePayment.total_amount).toLocaleString('en-IN')}</p>
              </div>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-lg">
              <p className="text-xs text-amber-400 mb-2 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Payment Method
              </p>
              <p className="text-sm font-semibold text-amber-100">
                {advancePayment.payment_method === 'payu' ? 'Online Payment (PayU)' : 'Wire Transfer'}
              </p>
            </div>

            {advancePayment.payment_terms && (
              <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                <p className="text-sm font-semibold text-slate-300 mb-2">Payment Terms</p>
                <p className="text-sm text-slate-400 whitespace-pre-wrap">{advancePayment.payment_terms}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quote Terms */}
        {quote?.negotiation_clauses && (
          <Card className="border-white/10 bg-white/5">
            <CardHeader>
              <CardTitle className="text-slate-200">Agreed Terms & Conditions</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-400 whitespace-pre-wrap">{quote.negotiation_clauses}</p>
            </CardContent>
          </Card>
        )}

        {/* Final Quotation Upload */}
        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-slate-200 flex items-center gap-2">
              <FileUp className="h-5 w-5" />
              Final Quotation (Optional)
            </CardTitle>
            <CardDescription>Upload the final quotation document as reference</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {advancePayment.final_quotation_url && (
              <div className="bg-green-500/10 border border-green-500/30 p-4 rounded-lg flex items-center gap-2">
                <Check className="h-4 w-4 text-green-400" />
                <span className="text-sm text-green-300">Quotation uploaded successfully</span>
              </div>
            )}
            
            {!advancePayment.final_quotation_url && (
              <div className="space-y-3">
                <div className="border-2 border-dashed border-slate-600 rounded-lg p-6 text-center hover:border-slate-500 transition">
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileSelect}
                    disabled={isConfirmed}
                    className="hidden"
                    id="quotation-file"
                  />
                  <label htmlFor="quotation-file" className="cursor-pointer flex flex-col items-center gap-2">
                    <Upload className="h-6 w-6 text-slate-400" />
                    <span className="text-sm font-medium text-slate-300">
                      {quotationFile ? quotationFile.name : 'Click to select or drag file'}
                    </span>
                    <span className="text-xs text-slate-500">PDF, JPEG, or PNG (Max 5MB)</span>
                  </label>
                </div>
              </div>
            )}

            <textarea
              value={customerNotes}
              onChange={(e) => setCustomerNotes(e.target.value)}
              disabled={isConfirmed}
              placeholder="Add any notes or questions about the quotation..."
              className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50 disabled:opacity-50"
              rows={3}
            />
          </CardContent>
        </Card>

        {/* Terms Acceptance */}
        <Card className="border-white/10 bg-white/5">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-start gap-3">
              <Checkbox
                id="agree-terms"
                checked={agreeToTerms}
                onCheckedChange={(checked) => setAgreeToTerms(Boolean(checked))}
                disabled={isConfirmed}
              />
              <label
                htmlFor="agree-terms"
                className="text-sm text-slate-300 cursor-pointer flex-1 leading-relaxed"
              >
                I agree to the payment terms and conditions mentioned above. I understand that:
                <ul className="mt-2 ml-4 space-y-1 text-xs text-slate-400 list-disc">
                  <li>₹{Math.round(advancePayment.advance_amount).toLocaleString('en-IN')} is required as advance payment</li>
                  <li>Balance of ₹{Math.round(advancePayment.total_amount - advancePayment.advance_amount).toLocaleString('en-IN')} will be due upon completion</li>
                  <li>Payment is non-refundable once confirmed</li>
                  <li>I agree to the terms mentioned in the negotiation clauses</li>
                </ul>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-3 sticky bottom-4">
          <Button
            variant="outline"
            className="flex-1 border-white/20 text-slate-300 hover:bg-white/5"
            onClick={() => router.back()}
            disabled={submitting}
          >
            Go Back
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!agreeToTerms || submitting || uploadingFile || isConfirmed}
            className="flex-1 bg-cyan-600 hover:bg-cyan-700 font-semibold"
          >
            {uploadingFile || submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : isConfirmed ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Confirmed
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Confirm & Pay Now
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
