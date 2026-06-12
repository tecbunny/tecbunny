'use client';

import { useEffect, useRef, useState, Suspense, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';

import { ArrowLeft, CreditCard, Loader2, ShieldCheck } from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '../../../../hooks/use-toast';
import { formatOrderNumber } from '@/lib/order-utils';
import { logger } from '@/lib/logger';

interface OrderRow {
  id: string;
  total: number;
  customer_name: string;
  customer_email?: string | null;
  customer_phone?: string | null;
  status: string;
  items?: string | Record<string, unknown> | null;
  fullTotal?: number;
  isPartPayment?: boolean;
}

interface OrderExtras {
  customer_email?: string;
  customer_phone?: string;
  part_payment_amount?: number | null;
}

interface PayuInitiateResponse {
  paymentUrl: string;
  params: Record<string, string>;
  transactionId: string;
  environment: 'test' | 'production';
}

function PayuPaymentContent() {
  const params = useParams();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const { toast } = useToast();
  const supabase = createClient();

  const [order, setOrder] = useState<OrderRow | null>(null);
  const [customerEmail, setCustomerEmail] = useState<string | null>(null);
  const [customerPhone, setCustomerPhone] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [payuData, setPayuData] = useState<PayuInitiateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const orderId = Array.isArray(params.orderId) ? params.orderId[0] : params.orderId;

  const resolveErrorMessage = (input: unknown): string | undefined => {
    if (!input) return undefined;
    if (typeof input === 'string') return input;
    if (typeof input === 'object') {
      try {
        const obj = input as Record<string, unknown>;
        if (typeof obj.message === 'string' && obj.message) return obj.message;
        if (typeof obj.error === 'string' && obj.error) return obj.error;
        return JSON.stringify(obj);
      } catch {
        return 'Unexpected error response';
      }
    }
    return String(input);
  };

  const parseOrderExtras = useCallback((raw: OrderRow['items']): OrderExtras => {
    if (!raw) return {};
    try {
      if (typeof raw === 'string') {
        return JSON.parse(raw) as OrderExtras;
      }
      if (typeof raw === 'object') {
        return raw as OrderExtras;
      }
    } catch (err) {
      console.warn('payu_payment.parse_items_failed', err);
    }
    return {};
  }, []);

  const fetchOrder = useCallback(async () => {
    if (!orderId) {
      setLoading(false);
      setError('Order reference missing.');
      return;
    }

    try {
      setLoading(true);
      const { data, error: orderError } = await supabase
        .from('orders')
        .select('id, total, customer_name, customer_email, customer_phone, status, items')
        .eq('id', orderId)
        .single();

      if (orderError || !data) {
        setError('Unable to load order details.');
        return;
      }

      const extras = parseOrderExtras(data.items);
      const resolvedEmail = extras.customer_email ?? data.customer_email ?? null;
      const resolvedPhone = extras.customer_phone ?? data.customer_phone ?? null;
      const payableAmount = extras.part_payment_amount ? Number(extras.part_payment_amount) : Number(data.total ?? 0);

      setOrder({
        id: data.id,
        total: payableAmount,
        customer_name: data.customer_name ?? 'Customer',
        customer_email: resolvedEmail,
        customer_phone: resolvedPhone,
        status: data.status ?? 'Pending',
        items: data.items,
        fullTotal: Number(data.total ?? 0),
        isPartPayment: !!extras.part_payment_amount
      });
      setCustomerEmail(resolvedEmail);
      setCustomerPhone(resolvedPhone);
      setError(null);
    } catch (err) {
      console.error('payu_payment.fetch_order_failed', err);
      setError('Unexpected error while loading order details.');
    } finally {
      setLoading(false);
    }
  }, [orderId, parseOrderExtras, supabase]);

  useEffect(() => {
    void fetchOrder();
  }, [fetchOrder]);

  const initiatePayuPayment = async () => {
    if (!orderId) {
      setError('Order reference missing.');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const response = await fetch('/api/payment/payu/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orderId }),
      });

      const data: PayuInitiateResponse & { error?: unknown } = await response.json();

      if (!response.ok || !data?.params) {
        const message = resolveErrorMessage(data?.error) || 'Failed to initiate PayU payment';
        throw new Error(message);
      }

      setPayuData(data);
      setSubmitted(true);
      toast({
        title: 'Redirecting to PayU',
        description: 'Please complete the payment on PayU secure gateway.',
      });
    } catch (err) {
      console.error('payu_payment.initiate_failed', err);
      const message = err instanceof Error ? err.message : 'Unable to start PayU payment';
      setError(message);
      toast({
        title: 'Payment Initiation Failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  useEffect(() => {
    if (!payuData || !formRef.current) {
      return;
    }

    const formElement = formRef.current;
    const timer = setTimeout(() => {
      if (process.env.NODE_ENV !== 'production') {
        const debugData = new FormData(formElement);
        const payloadEntries: Record<string, string> = {};
        debugData.forEach((value, key) => {
          if (typeof value === 'string') {
            payloadEntries[key] = value;
          }
        });
        try { logger.info('payu_payment.payload', payloadEntries); } catch {};
      }
      formElement.submit();
    }, 400);

    return () => clearTimeout(timer);
  }, [payuData]);

  if (loading) {
    return (
      <div className="container max-w-xl mx-auto py-12">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-sm text-muted-foreground">Loading order details…</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="container max-w-xl mx-auto py-10">
        <Card>
          <CardHeader>
            <CardTitle>Payment Unavailable</CardTitle>
            <CardDescription>{error || 'Order could not be found.'}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline" onClick={() => router.push('/checkout')}>
              Try Again
            </Button>
            <Button onClick={() => router.push('/contact')}>
              Contact Support
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formattedAmount = Number.isFinite(order.total) ? order.total.toFixed(2) : '0.00';
  const environmentBadge = payuData?.environment === 'production'
    ? { label: 'Live', variant: 'default' as const }
    : { label: 'Sandbox', variant: 'secondary' as const };
  const gatewayUrl = payuData?.paymentUrl;

  return (
    <div className="container max-w-2xl mx-auto py-10">
      <Button
        variant="ghost"
        onClick={() => router.back()}
        className="mb-6"
        disabled={processing}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>

      <Card>
        <CardHeader className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-xl">
              <ShieldCheck className="h-5 w-5 text-green-600" />
              Pay securely with PayU
            </CardTitle>
            <Badge variant={environmentBadge.variant}>{environmentBadge.label}</Badge>
          </div>
          <CardDescription>
            Transaction for order #{formatOrderNumber(order.id)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border bg-muted/40 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Customer</span>
              <span className="font-medium">{order.customer_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{order.isPartPayment ? 'Payable Part Amount' : 'Amount'}</span>
              <span className="font-semibold text-primary">₹{formattedAmount}</span>
            </div>
            {order.isPartPayment && (
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>Total CCTV Order Amount</span>
                <span>₹{order.fullTotal?.toFixed(2)}</span>
              </div>
            )}
            {customerEmail && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium text-foreground">{customerEmail}</span>
              </div>
            )}
            {customerPhone && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Phone</span>
                <span className="font-medium text-foreground">{customerPhone}</span>
              </div>
            )}
            <Separator className="my-3" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Order Status</span>
              <Badge variant="outline">{order.status}</Badge>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            You will be redirected to PayU to complete your payment. Please do not refresh or close the window during the transaction.
          </p>

          <Button
            onClick={initiatePayuPayment}
            disabled={processing}
            className="w-full"
            size="lg"
          >
            {processing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting to PayU…
              </>
            ) : (
              <>
                <CreditCard className="mr-2 h-4 w-4" />
                Proceed to PayU Checkout
              </>
            )}
          </Button>

          {submitted && gatewayUrl && (
            <p className="text-xs text-muted-foreground text-center">
              Redirecting to <span className="font-medium">{gatewayUrl}</span>. If nothing happens,
              <Button
                variant="link"
                className="p-0 h-auto align-baseline"
                onClick={() => formRef.current?.submit()}
              >
                click here
              </Button>
              .
            </p>
          )}

          {payuData && (
            <form
              ref={formRef}
              method="post"
              action={payuData.paymentUrl}
              className="hidden"
            >
              {Object.entries(payuData.params).map(([key, value]) => (
                <input key={key} type="hidden" name={key} value={value} />
              ))}
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function PayuClientPage() {
  return (
    <Suspense fallback={<div className="py-10 text-center">Loading…</div>}>
      <PayuPaymentContent />
    </Suspense>
  );
}
