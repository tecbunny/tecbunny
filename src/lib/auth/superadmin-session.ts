import { logger } from '../logger';
import { getRedis } from '../redis';
import { createServiceClient } from '../supabase/server';

const SUPERADMIN_SESSION_TTL_SECONDS = 60 * 60 * 24;

type SuperadminSessionPayload = {
  sub: 'superadmin-root-id';
  email: string;
  iat: number;
  exp: number;
  jti: string;
};

const textEncoder = new TextEncoder();

function base64UrlEncode(bytes: Uint8Array) {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  const base64 = typeof btoa === 'function'
    ? btoa(binary)
    : Buffer.from(bytes).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  const binary = typeof atob === 'function'
    ? atob(padded)
    : Buffer.from(padded, 'base64').toString('binary');
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function getSessionSecret() {
  const secret = process.env.SUPERADMIN_SESSION_SECRET;
  if (!secret) {
    logger.error('SUPERADMIN_SESSION_SECRET is not configured. Superadmin session operations will fail.');
    return null;
  }
  return secret;
}

async function hmacSha256(data: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, textEncoder.encode(data)));
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array) {
  const maxLength = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < maxLength; i += 1) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return diff === 0;
}

export async function createSuperadminSessionToken(email: string) {
  const secret = getSessionSecret();
  if (!secret) {
    throw new Error('SUPERADMIN_SESSION_SECRET or SUPERADMIN_PASSWORD is required');
  }

  const now = Math.floor(Date.now() / 1000);
  const payload: SuperadminSessionPayload = {
    sub: 'superadmin-root-id',
    email,
    iat: now,
    exp: now + SUPERADMIN_SESSION_TTL_SECONDS,
    jti: crypto.randomUUID(),
  };

  const encodedPayload = base64UrlEncode(textEncoder.encode(JSON.stringify(payload)));
  const signature = base64UrlEncode(await hmacSha256(encodedPayload, secret));
  return `v1.${encodedPayload}.${signature}`;
}

export async function verifySuperadminSessionToken(token: string | undefined | null) {
  if (!token) {
    return null;
  }

  const secret = getSessionSecret();
  if (!secret) {
    return null;
  }

  const [version, encodedPayload, encodedSignature] = token.split('.');
  if (version !== 'v1' || !encodedPayload || !encodedSignature) {
    return null;
  }

  // Revocation check via Redis
  try {
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(encodedPayload))) as SuperadminSessionPayload;
    const redis = getRedis();
    if (redis && payload.jti) {
      const isRevoked = await redis.get(`revoked_superadmin_jti:${payload.jti}`);
      if (isRevoked) {
        logger.warn('Revoked superadmin token attempt detected', { jti: payload.jti, email: payload.email });
        return null;
      }
    }
  } catch (err) {
    return null;
  }

  const expectedSignature = await hmacSha256(encodedPayload, secret);
  let actualSignature: Uint8Array;
  try {
    actualSignature = base64UrlDecode(encodedSignature);
  } catch {
    return null;
  }

  if (!timingSafeEqual(expectedSignature, actualSignature)) {
    return null;
  }

  try {
    const payloadText = new TextDecoder().decode(base64UrlDecode(encodedPayload));
    const payload = JSON.parse(payloadText) as Partial<SuperadminSessionPayload>;
    const configuredEmail = process.env.SUPERADMIN_USER_ID || process.env.SUPERADMIN_EMAIL;
    const now = Math.floor(Date.now() / 1000);

    if (
      payload.sub !== 'superadmin-root-id' ||
      !payload.email ||
      payload.email !== configuredEmail ||
      typeof payload.exp !== 'number' ||
      payload.exp <= now
    ) {
      return null;
    }

    // Check if JTI is in blocklist (for revocation/logout)
    if (payload.jti) {
      // Primary: Redis
      const redis = getRedis();
      if (redis) {
        const isBlocked = await redis.get(`blocklist:jti:${payload.jti}`);
        if (isBlocked) {
          logger.warn('Superadmin session revocation check: JTI is blocked (Redis)', { jti: payload.jti });
          return null;
        }
      }

      // Secondary: Database (Fallback)
      try {
        const supabase = createServiceClient();
        const { data: dbBlocked } = await supabase
          .from('superadmin_token_blocklist')
          .select('jti')
          .eq('jti', payload.jti)
          .maybeSingle();
        
        if (dbBlocked) {
          logger.warn('Superadmin session revocation check: JTI is blocked (DB)', { jti: payload.jti });
          return null;
        }
      } catch (dbError) {
        logger.error('Failed to check token blocklist in DB', { error: dbError });
      }
    }

    return payload as SuperadminSessionPayload;
  } catch {
    return null;
  }
}

export async function revokeSuperadminSessionToken(token: string) {
  const [version, encodedPayload] = token.split('.');
  if (version !== 'v1' || !encodedPayload) return;

  try {
    const payloadText = new TextDecoder().decode(base64UrlDecode(encodedPayload));
    const payload = JSON.parse(payloadText) as Partial<SuperadminSessionPayload>;
    
    if (payload.jti && payload.exp) {
      const now = Math.floor(Date.now() / 1000);
      const ttl = payload.exp - now;
      if (ttl > 0) {
        // Primary: Redis
        const redis = getRedis();
        if (redis) {
          await redis.set(`blocklist:jti:${payload.jti}`, '1', 'EX', ttl);
        }

        // Secondary: Database
        try {
          const supabase = createServiceClient();
          await supabase.from('superadmin_token_blocklist').insert({
            jti: payload.jti,
            expires_at: new Date(payload.exp * 1000).toISOString()
          });
        } catch (dbError) {
          logger.error('Failed to persist token revocation to DB', { error: dbError });
        }
        
        logger.info('Superadmin session revoked (Redis + DB)', { jti: payload.jti });
      }
    }
  } catch (error) {
    logger.error('Failed to revoke superadmin session', { error });
  }
}

export { SUPERADMIN_SESSION_TTL_SECONDS };
