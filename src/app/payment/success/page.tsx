/**
 * Payment Success Page
 * Displays payment confirmation for successful transactions
 */

'use client';

import * as React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const orderId = searchParams.get('orderId');
  const txnId = searchParams.get('txnId');

  return (
    <div className="container max-w-2xl mx-auto py-10">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <CheckCircle2 className="h-16 w-16 text-green-500" />
          </div>
          <CardTitle className="text-2xl">Payment Successful!</CardTitle>
          <CardDescription>
            Your payment has been processed successfully
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3 bg-muted p-4 rounded-lg">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Order ID:</span>
              <span className="font-medium">{orderId}</span>
            </div>
            {txnId && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Transaction ID:</span>
                <span className="font-medium">{txnId}</span>
              </div>
            )}
          </div>

          <div className="text-sm text-muted-foreground text-center">
            <p>A confirmation email has been sent to your registered email address.</p>
            <p className="mt-2">You can track your order in the Orders section.</p>
          </div>

          <div className="flex gap-3">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => router.push('/orders')}
            >
              View Orders
            </Button>
            <Button 
              className="flex-1"
              onClick={() => router.push('/products')}
            >
              Continue Shopping
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <PaymentSuccessContent />
    </React.Suspense>
  );
}
