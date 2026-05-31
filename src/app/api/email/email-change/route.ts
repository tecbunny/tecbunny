import { NextRequest } from 'next/server';

import { emailHelpers } from '@/lib/email';
import { handleEmailPost } from '@/lib/api-email-route';

interface EmailChangePayload { to: string; userName: string; otp: string }

export async function POST(request: NextRequest) {
  return handleEmailPost<EmailChangePayload>(request, {
    rate: { bucket: 'email_change_otp', limit: 5, windowMs: 30 * 60 * 1000 },
    validate(body: any) {
      const { to, userName, otp } = body || {};
      if (typeof to !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return { ok: false, error: 'Invalid recipient email' } as const;
      if (!userName || typeof userName !== 'string' || !otp || typeof otp !== 'string') return { ok: false, error: 'Missing required fields' } as const;
      return { ok: true, data: { to, userName, otp } } as const;
    },
    async action(data) {
      return emailHelpers.sendEmailChangeOTP(data.to, data.userName, data.otp);
    }
  });
}
