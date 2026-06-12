import { Suspense } from 'react';

import { OTPVerificationContent } from './OTPVerificationContent';

// Force dynamic rendering for auth page
// export const dynamic = 'force-dynamic';

export default function VerifyOTPPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <OTPVerificationContent />
    </Suspense>
  );
}
