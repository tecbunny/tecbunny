'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

import { ArrowLeft, CreditCard, Smartphone, Banknote, Clock, CheckCircle } from 'lucide-react';

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
  payment_method?: string | null;
  payment_status?: string | null;
  created_at: string;
  customer_name: string;
  customer_email?: string | null;
  customer_phone?: string | null;
  items?: string | Record<string, unknown> | null;
}

type PaymentState = 'pending' | 'paid' | 'cod_pending';

interface OrderExtras {
  cart_items?: Array<Record<string, unknown>>;
  customer_email?: string;
  customer_phone?: string;
  delivery_address?: string;
  payment_method?: string;
}

export default function PaymentMethodPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const orderId = Array.isArray(params.orderId) ? params.orderId[0] : params.orderId;
  const [order, setOrder] = useState<Order | null>(null);
  const [customerEmail, setCustomerEmail] = useState<string | null>(null);
  const [customerPhone, setCustomerPhone] = useState<string | null>(null);
  const [paymentState, setPaymentState] = useState<PaymentState>('pending');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const supabase = createClient();

  const paymentMethod = params.method as string;

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
      logger.warn('payment_method.parse_items_failed', {
        error: error instanceof Error ? error.message : 'unknown',
      });
    }
    return {};
  }, []);

  const resolvePaymentState = useCallback((status?: string, method?: string | null, paymentStatus?: string | null): PaymentState => {
    const paymentStatusText = paymentStatus?.toLowerCase() ?? '';
    if (paymentStatusText === 'payment confirmed') {
      return 'paid';
    }

    if (!status) return 'pending';
    const normalized = status.toLowerCase();
    const methodKey = (method ?? '').toLowerCase();

    if (['payment confirmed', 'completed', 'delivered'].includes(normalized)) {
      return 'paid';
    }

    if (normalized === 'confirmed') {
      return methodKey === 'cod' ? 'cod_pending' : 'paid';
    }

    if (normalized === 'cod pending' || normalized === 'awaiting payment') {
      return methodKey === 'cod' ? 'cod_pending' : 'pending';
    }

    return methodKey === 'cod' ? 'cod_pending' : 'pending';
  }, []);

  const formatPaymentState = useCallback((state: PaymentState): string => {
    switch (state) {
      case 'paid':
        return 'Paid';
      case 'cod_pending':
        return 'COD Pending';
      default:
        return 'Pending';
    }
  }, []);

  const fetchOrder = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select('id, total, status, payment_method, payment_status, created_at, customer_name, items')
        .eq('id', orderId)
        .single();

      if (error) throw error;

      const row = data as Record<string, unknown>;
      const normalizedOrder: Order = {
        id: String(row.id ?? orderId),
        total: Number(row.total ?? 0),
        status: typeof row.status === 'string' ? row.status : 'Pending',
        payment_method: typeof row.payment_method === 'string' ? row.payment_method : paymentMethod,
        payment_status: typeof row.payment_status === 'string' ? row.payment_status : null,
        created_at: typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
        customer_name: typeof row.customer_name === 'string' ? row.customer_name : 'Customer',
        items: (row.items as Order['items']) ?? null,
      };

      const extras = parseOrderExtras(normalizedOrder.items ?? null);
  const emailFromExtras = typeof extras.customer_email === 'string' ? extras.customer_email : null;
  const phoneFromExtras = typeof extras.customer_phone === 'string' ? extras.customer_phone : null;
  const emailFromRow = typeof row.customer_email === 'string' ? row.customer_email : null;
  const phoneFromRow = typeof row.customer_phone === 'string' ? row.customer_phone : null;

      const resolvedPaymentMethod = normalizedOrder.payment_method ?? extras.payment_method ?? paymentMethod;
      const resolvedPaymentState = resolvePaymentState(
        normalizedOrder.status,
        resolvedPaymentMethod,
        normalizedOrder.payment_status
      );

  const customerEmailValue = emailFromExtras ?? emailFromRow;
  const customerPhoneValue = phoneFromExtras ?? phoneFromRow;

      setOrder({
        ...normalizedOrder,
        payment_method: resolvedPaymentMethod,
        payment_status: normalizedOrder.payment_status,
        customer_email: customerEmailValue,
        customer_phone: customerPhoneValue,
      });

      setCustomerEmail(customerEmailValue);
      setCustomerPhone(customerPhoneValue);
      setPaymentState(resolvedPaymentState);
    } catch (error) {
      logger.error('Error fetching order for payment method page', { error, orderId });
      toast({
        title: "Error",
        description: "Failed to load order details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [orderId, parseOrderExtras, paymentMethod, resolvePaymentState, supabase, toast]);

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return;
    }
    fetchOrder();
  }, [fetchOrder, orderId]);

  const getPaymentMethodInfo = (method: string) => {
    switch (method.toLowerCase()) {
      case 'card':
        return {
          title: 'Credit/Debit Card Payment',
          icon: CreditCard,
          description: 'Pay securely with your credit or debit card',
          instructions: [
            'Enter your card details in the secure form below',
            'Ensure your card is enabled for online transactions',
            'You may receive an OTP for verification',
            'Payment will be processed instantly'
          ]
        };
      case 'netbanking':
        return {
          title: 'Net Banking Payment',
          icon: Banknote,
          description: 'Pay using your bank account',
          instructions: [
            'Select your bank from the list',
            'You will be redirected to your bank\'s website',
            'Login with your net banking credentials',
            'Authorize the payment and return to our site'
          ]
        };
      case 'wallet':
        return {
          title: 'Digital Wallet Payment',
          icon: Smartphone,
          description: 'Pay using your digital wallet',
          instructions: [
            'Select your preferred wallet',
            'Login to your wallet account',
            'Confirm the payment amount',
            'Complete the transaction'
          ]
        };
      case 'cod':
        return {
          title: 'Cash on Delivery',
          icon: CheckCircle,
          description: 'Pay when your order is delivered',
          instructions: [
            'Your order will be confirmed',
            'Pay the delivery person when your order arrives',
            'Have exact change ready',
            'COD charges may apply'
          ]
        };
      default:
        return {
          title: 'Payment',
          icon: CreditCard,
          description: 'Complete your payment',
          instructions: [
            'Follow the payment instructions',
            'Complete the payment process',
            'Wait for confirmation',
            'Check your email for receipt'
          ]
        };
    }
  };

  const handlePaymentProcess = async () => {
    setProcessing(true);
    try {
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      const method = paymentMethod.toLowerCase();
      const nextStatus = method === 'cod' ? 'Confirmed' : 'Payment Confirmed';
      const nextPaymentStatus = method === 'cod'
        ? 'Payment Due on Delivery'
        : 'Payment Confirmed';

      const payload = { orderId, status: nextStatus, additionalData: { payment_status: nextPaymentStatus } };
      const response = await fetch('/api/orders/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'Failed to update order status');
      }

      if (method === 'cod') {
        setPaymentState('cod_pending');
        toast({
          title: "Order Confirmed!",
          description: "Your COD order has been confirmed. Pay when delivered.",
        });
      } else {
        setPaymentState('paid');
        toast({
          title: "Payment Successful!",
          description: "Your payment has been processed successfully.",
        });
      }

      setOrder(prev => prev ? { ...prev, status: nextStatus, payment_status: nextPaymentStatus } : prev);

      // Redirect to order confirmation
      router.push(`/orders/${orderId}`);
    } catch (error) {
      logger.error('Error processing payment', { error, orderId, paymentMethod });
      toast({
        title: "Payment Failed",
        description: "There was an error processing your payment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const paymentInfo = getPaymentMethodInfo(paymentMethod);
  const PaymentIcon = paymentInfo.icon;

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

  const paymentMethodLabel = (order.payment_method ?? paymentMethod ?? 'N/A').toString().toUpperCase();
  const formattedAmount = Number.isFinite(order.total) ? order.total.toFixed(2) : '0.00';

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <h1 className="text-3xl font-bold">{paymentInfo.title}</h1>
        <p className="text-gray-600">Order #{formatOrderNumber(order.id)}</p>
      </div>

    <div className="space-y-6">
        {/* Payment Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PaymentIcon className="h-5 w-5" />
              Payment Summary
            </CardTitle>
            <CardDescription>{paymentInfo.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span>Order Total:</span>
                <span className="font-medium">₹{formattedAmount}</span>
              </div>
              <div className="flex justify-between">
                <span>Payment Method:</span>
                <Badge variant="outline">{paymentMethodLabel}</Badge>
              </div>
              <div className="flex justify-between">
                <span>Payment Status:</span>
                <Badge variant={paymentState === 'paid' ? 'default' : 'secondary'}>
                  {formatPaymentState(paymentState)}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>Order Status:</span>
                <Badge variant="outline">{order.status}</Badge>
              </div>
              {customerEmail && (
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Email:</span>
                  <span className="font-medium text-gray-900">{customerEmail}</span>
                </div>
              )}
              {customerPhone && (
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Phone:</span>
                  <span className="font-medium text-gray-900">{customerPhone}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Amount to Pay:</span>
                <span className="text-green-600">₹{formattedAmount}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              How to Pay
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              {paymentInfo.instructions.map((instruction, index) => (
                <li key={index}>{instruction}</li>
              ))}
            </ol>
          </CardContent>
        </Card>

        {/* Payment Form/Button */}
        <Card>
          <CardContent className="pt-6">
            {paymentMethod.toLowerCase() === 'upi' ? (
              <div className="space-y-4">
                <Button 
                  onClick={() => router.push(`/payment/upi/${orderId}`)}
                  className="w-full"
                  size="lg"
                >
                  <Smartphone className="mr-2 h-4 w-4" />
                  Continue with UPI
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {paymentMethod.toLowerCase() === 'card' && (
                  <div className="bg-white/5 border border-white/10 p-4 rounded-lg text-center">
                    <CreditCard className="h-12 w-12 mx-auto text-slate-400 mb-2" />
                    <p className="text-sm text-slate-300">
                      Card payment gateway integration coming soon
                    </p>
                  </div>
                )}
                
                {paymentMethod.toLowerCase() === 'netbanking' && (
                  <div className="bg-white/5 border border-white/10 p-4 rounded-lg text-center">
                    <Banknote className="h-12 w-12 mx-auto text-slate-400 mb-2" />
                    <p className="text-sm text-slate-300">
                      Net banking integration coming soon
                    </p>
                  </div>
                )}
                
                {paymentMethod.toLowerCase() === 'wallet' && (
                  <div className="bg-white/5 border border-white/10 p-4 rounded-lg text-center">
                    <Smartphone className="h-12 w-12 mx-auto text-slate-400 mb-2" />
                    <p className="text-sm text-slate-300">
                      Digital wallet integration coming soon
                    </p>
                  </div>
                )}
                
                <Button 
                  onClick={handlePaymentProcess}
                  className="w-full"
                  size="lg"
                  disabled={processing || paymentState === 'paid'}
                >
                  {processing ? (
                    'Processing...'
                  ) : paymentState === 'paid' ? (
                    'Payment Completed'
                  ) : paymentMethod.toLowerCase() === 'cod' ? (
                    'Confirm COD Order'
                  ) : (
                    `Pay ₹${formattedAmount}`
                  )}
                </Button>
                
                {paymentMethod.toLowerCase() === 'cod' && (
                  <p className="text-xs text-gray-500 text-center">
                    COD charges: ₹50 (will be collected at delivery)
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Security Note */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Secure Payment</p>
                <p className="text-xs text-gray-600">
                  Your payment information is encrypted and secure. We never store your card details.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
