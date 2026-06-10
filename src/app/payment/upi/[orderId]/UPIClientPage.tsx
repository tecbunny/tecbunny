'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

import { ArrowLeft, Smartphone, Copy, Check, QrCode, Clock, CreditCard } from 'lucide-react';

import QRCode from 'qrcode';

import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '../../../../hooks/use-toast';
import { logger } from '@/lib/logger';
import { formatOrderNumber } from '@/lib/order-utils';


interface Order {
  id: string;
  total: number;
  status: string;
  created_at: string;
  customer_name: string;
  payment_status?: string | null;
  payment_method?: string | null;
  items?: string | Record<string, unknown> | null;
  fullTotal?: number;
  isPartPayment?: boolean;
  isPendingPayment?: boolean;
}

type PaymentState = 'pending' | 'paid';

interface OrderExtras {
  cart_items?: Array<Record<string, unknown>>;
  customer_email?: string;
  customer_phone?: string;
  delivery_address?: string;
  payment_method?: string;
  customer_notes?: string;
  part_payment_amount?: number | null;
}

export default function UPIPaymentPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const orderId = Array.isArray(params.orderId) ? params.orderId[0] : params.orderId;
  const [order, setOrder] = useState<Order | null>(null);
  const [customerEmail, setCustomerEmail] = useState<string | null>(null);
  const [customerPhone, setCustomerPhone] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<PaymentState>('pending');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const supabase = createClient();

  // UPI ID for payments (configurable via env; fallback provided for dev)
  const UPI_ID = process.env.NEXT_PUBLIC_UPI_ID || "9604136010@okbizaxis";

  const parseOrderExtras = useCallback((rawItems: Order['items']): OrderExtras => {
    if (!rawItems) return {};
    try {
      if (typeof rawItems === 'string') {
        return JSON.parse(rawItems) as OrderExtras;
      }
      if (typeof rawItems === 'object') {
        return rawItems as OrderExtras;
      }
    } catch (error) {
      logger.warn('upi_payment.parse_items_failed', {
        error: error instanceof Error ? error.message : 'unknown',
      });
    }
    return {};
  }, []);

  const resolvePaymentState = useCallback((status?: string, paymentStatus?: string | null): PaymentState => {
    const paymentStatusText = paymentStatus?.toLowerCase() ?? '';
    if (paymentStatusText === 'payment confirmed') {
      return 'paid';
    }

    if (!status) {
      return 'pending';
    }

    const normalized = status.toLowerCase();
    return ['payment confirmed', 'confirmed', 'completed', 'delivered'].includes(normalized)
      ? 'paid'
      : 'pending';
  }, []);

  const generateUPILink = useCallback(
    (currentOrder?: Order | null) => {
      const amount = currentOrder?.total ?? order?.total ?? 0;
      const amountText = Number.isFinite(amount) ? amount.toFixed(2) : '0';
      if (!orderId) return `upi://pay?pa=${UPI_ID}&pn=TecBunny Store&am=0&cu=INR&tn=Order`;
      return `upi://pay?pa=${UPI_ID}&pn=TecBunny Store&am=${amountText}&cu=INR&tn=Order ${orderId}`;
    },
    [UPI_ID, order?.total, orderId]
  );

  const fetchOrder = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select('id, total, status, payment_status, payment_method, created_at, customer_name, items')
        .eq('id', orderId)
        .single();

      if (error) throw error;

      const extras = parseOrderExtras(data.items ?? null);
      const isInitialConfirmed = data.payment_status === 'Payment Confirmed' || 
        ['Payment Confirmed', 'Confirmed', 'Processing', 'Ready to Ship', 'Shipped', 'Ready for Pickup', 'Completed', 'Delivered', 'Delivered/Picked Up'].includes(data.status ?? '');
      const isPendingPaymentMode = isInitialConfirmed && extras.part_payment_amount && (extras as any).pending_payment_status !== 'paid';

      const payableAmount = isPendingPaymentMode
        ? Number(data.total ?? 0) - Number(extras.part_payment_amount)
        : extras.part_payment_amount ? Number(extras.part_payment_amount) : Number(data.total ?? 0);

      const normalizedOrder: Order = {
        id: data.id,
        total: payableAmount,
        status: data.status ?? 'Pending',
        created_at: data.created_at,
        customer_name: data.customer_name ?? 'Customer',
        payment_status: typeof data.payment_status === 'string' ? data.payment_status : null,
        payment_method: typeof data.payment_method === 'string' ? data.payment_method : null,
        items: data.items ?? null,
        fullTotal: Number(data.total ?? 0),
        isPartPayment: !!extras.part_payment_amount && !isPendingPaymentMode,
        isPendingPayment: !!isPendingPaymentMode
      };

      const resolvedPaymentMethod = normalizedOrder.payment_method ?? extras.payment_method ?? 'upi';
      setOrder({
        ...normalizedOrder,
        payment_method: resolvedPaymentMethod,
      });

      setCustomerEmail(typeof extras.customer_email === 'string' ? extras.customer_email : null);
      setCustomerPhone(typeof extras.customer_phone === 'string' ? extras.customer_phone : null);

      const resolvedPaymentState = resolvePaymentState(
        normalizedOrder.status,
        normalizedOrder.payment_status
      );
      setPaymentStatus(resolvedPaymentState);

      const upiLink = generateUPILink(normalizedOrder);
      const qrDataUrl = await QRCode.toDataURL(upiLink, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });
      setQrCodeUrl(qrDataUrl);
    } catch (error) {
      logger.error('Error fetching order for UPI payment page', { error, orderId });
      toast({
        title: "Error",
        description: "Failed to load order details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [generateUPILink, orderId, parseOrderExtras, resolvePaymentState, supabase, toast]);

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return;
    }
    fetchOrder();
  }, [fetchOrder, orderId]);

  const copyUPIId = () => {
    navigator.clipboard.writeText(UPI_ID);
    setCopied(true);
    toast({
      title: "Copied!",
      description: "UPI ID copied to clipboard",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenUPI = useCallback(() => {
    const link = generateUPILink();
    window.open(link, '_blank', 'noopener');
  }, [generateUPILink]);

  const handlePaymentConfirmation = async () => {
    try {
      // In a real app, you would verify payment through UPI gateway
      const payload = { orderId, status: 'Payment Confirmed', additionalData: { payment_status: 'Payment Confirmed' } };
      const response = await fetch('/api/orders/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'Failed to update payment status');
      }

  setPaymentStatus('paid');
  setOrder(prev => prev ? { ...prev, status: 'Payment Confirmed', payment_status: 'Payment Confirmed' } : prev);

      toast({
        title: "Payment Confirmed!",
        description: "Your payment has been received and order confirmed.",
      });

      // Redirect to order confirmation
      router.push(`/orders/${orderId}`);
    } catch (error) {
      logger.error('Error updating payment status after UPI confirmation', { error, orderId });
      toast({
        title: "Error",
        description: "Failed to confirm payment",
        variant: "destructive",
      });
    }
  };

  const paymentStatusLabel = paymentStatus === 'paid'
    ? 'Payment Confirmed'
    : 'Payment Confirmation Pending';

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Order Not Found</CardTitle>
            <CardDescription>
              The order you're looking for doesn't exist.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <h1 className="text-3xl font-bold">UPI Payment</h1>
        <p className="text-gray-600">Order #{formatOrderNumber(order.id)}</p>
      </div>

      <div className="space-y-6">
        {/* Payment Amount */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Payment Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center">
              <span className="text-lg">
                {order.isPendingPayment
                  ? 'Remaining Balance to Pay:'
                  : order.isPartPayment
                  ? 'Payable Part Amount:'
                  : 'Amount to Pay:'}
              </span>
              <span className="text-2xl font-bold text-green-400">₹{order.total.toFixed(2)}</span>
            </div>
            {(order.isPartPayment || order.isPendingPayment) && (
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>Total CCTV Order Amount</span>
                <span>₹{order.fullTotal?.toFixed(2)}</span>
              </div>
            )}
            <div className="mt-4 grid gap-2 text-sm text-gray-600">
              {customerEmail && (
                <div className="flex justify-between">
                  <span>Email</span>
                  <span className="font-medium text-gray-900">{customerEmail}</span>
                </div>
              )}
              {customerPhone && (
                <div className="flex justify-between">
                  <span>Phone</span>
                  <span className="font-medium text-gray-900">{customerPhone}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Status</span>
                <Badge variant={paymentStatus === 'paid' ? 'default' : 'secondary'}>
                  {paymentStatusLabel}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* UPI Payment Options */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Pay with UPI
            </CardTitle>
            <CardDescription>
              Choose your preferred payment method
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Direct UPI Link */}
            <div className="space-y-2">
              <h4 className="font-medium">Option 1: Direct UPI Payment</h4>
              <Button 
                onClick={handleOpenUPI}
                className="w-full"
                size="lg"
              >
                <Smartphone className="mr-2 h-4 w-4" />
                Pay with UPI App
              </Button>
              <p className="text-sm text-slate-300">
                This will open your UPI app with pre-filled payment details
              </p>
            </div>

            <Separator />

            {/* Manual UPI Transfer */}
            <div className="space-y-2">
              <h4 className="font-medium">Option 2: Manual Transfer</h4>
              <div className="bg-white/5 border border-white/10 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-300">UPI ID:</p>
                    <p className="font-mono font-medium">{UPI_ID}</p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={copyUPIId}
                    aria-label="Copy UPI ID"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <p className="text-sm text-slate-300">
                Transfer ₹{order.total.toFixed(2)} to the above UPI ID with reference: Order {formatOrderNumber(order.id)}
              </p>
            </div>

            <Separator />

            {/* QR Code Section */}
            <div className="space-y-2">
              <h4 className="font-medium">Option 3: Scan QR Code</h4>
              <div className="flex items-center justify-center bg-white/5 border border-white/10 p-8 rounded-lg">
                <div className="text-center">
                  {qrCodeUrl ? (
                    <div className="space-y-2">
                      <img 
                        src={qrCodeUrl} 
                        alt="UPI Payment QR Code" 
                        className="mx-auto border rounded-lg shadow-sm"
                        width={200}
                        height={200}
                      />
                      <p className="text-sm text-slate-300">
                        Scan with any UPI app to pay ₹{order?.total.toFixed(2)}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <QrCode className="h-24 w-24 mx-auto text-slate-400 mb-2 animate-pulse" />
                      <p className="text-sm text-slate-300">Generating QR Code...</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Payment Instructions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>Complete the payment using any of the above methods</li>
              <li>Take a screenshot of the successful transaction</li>
              <li>Click "I have completed the payment" below</li>
              <li>Our team will verify the payment within 2-4 hours</li>
              <li>You'll receive a confirmation email once verified</li>
            </ol>
          </CardContent>
        </Card>

        {/* Payment Confirmation */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <Button 
                onClick={handlePaymentConfirmation}
                className="w-full"
                size="lg"
                disabled={paymentStatus === 'paid'}
              >
                {paymentStatus === 'paid' ? 'Payment Confirmed' : 'I have completed the payment'}
              </Button>
              <p className="text-xs text-slate-400 text-center">
                By clicking above, you confirm that you have successfully completed the payment.
                Please ensure you have a valid transaction receipt.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
