/**
 * Payment Failed Page
 * Displays error message for failed payment transactions
 */

'use client';

import * as React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { XCircle } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

function PaymentFailedContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const orderId = searchParams.get('orderId');
  const reason = searchParams.get('reason');

  return (
    <div className="container max-w-2xl mx-auto py-10">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <XCircle className="h-16 w-16 text-red-500" />
          </div>
          <CardTitle className="text-2xl">Payment Failed</CardTitle>
          <CardDescription>
            We couldn't process your payment
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {reason && (
            <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
              <p className="text-sm text-red-800">
                <strong>Reason:</strong> {decodeURIComponent(reason)}
              </p>
            </div>
          )}

          <div className="space-y-3 bg-muted p-4 rounded-lg">
            {orderId && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Order ID:</span>
                <span className="font-medium">{orderId}</span>
              </div>
            )}
          </div>

          <div className="text-sm text-muted-foreground text-center">
            <p>Your payment was not successful. Please try again.</p>
            <p className="mt-2">If you continue to face issues, please contact our support team.</p>
          </div>

          <div className="flex gap-3">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => router.push('/contact')}
            >
              Contact Support
            </Button>
            <Button 
              className="flex-1"
              onClick={() => router.push(`/checkout`)}
            >
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PaymentFailedPage() {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <PaymentFailedContent />
    </React.Suspense>
  );
}
