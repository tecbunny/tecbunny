import { NextRequest } from 'next/server';

import { emailHelpers } from '@/lib/email';
import { handleEmailPost } from '@/lib/api-email-route';

interface WelcomePayload { to: string; userName: string }

export async function POST(request: NextRequest) {
  return handleEmailPost<WelcomePayload>(request, {
    rate: { bucket: 'email_welcome', limit: 5, windowMs: 60 * 60 * 1000 },
    validate(body: any) {
      const { to, userName } = body || {};
      if (typeof to !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return { ok: false, error: 'Invalid recipient email' } as const;
      if (!userName || typeof userName !== 'string') return { ok: false, error: 'Missing userName' } as const;
      return { ok: true, data: { to, userName } } as const;
    },
    async action(data) {
      return emailHelpers.sendWelcomeEmail(data.to, data.userName);
    }
  });
}
