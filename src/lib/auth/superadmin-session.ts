import { logger } from '../logger';

const SUPERADMIN_SESSION_TTL_SECONDS = 60 * 60 * 24;

type SuperadminSessionPayload = {
  sub: 'superadmin-root-id';
  email: string;
  iat: number;
  exp: number;
  jti: string;
};

const textEncoder = new TextEncoder();

// Cache variables for cryptographic keys to prevent GC thrashing and CPU overhead
let cachedKeySecret: string | null = null;
let cachedCryptoKey: CryptoKey | null = null;

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
  // Lazily import and cache the key using standard Web Crypto API
  if (!cachedCryptoKey || cachedKeySecret !== secret) {
    cachedCryptoKey = await crypto.subtle.importKey(
      'raw',
      textEncoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    cachedKeySecret = secret;
  }
  return new Uint8Array(await crypto.subtle.sign('HMAC', cachedCryptoKey, textEncoder.encode(data)));
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

    return payload as SuperadminSessionPayload;
  } catch {
    return null;
  }
}

export async function revokeSuperadminSessionToken(token: string) {
  // Purely env-based sessions do not support persistent blocklists in this version.
  // Session revocation is managed by expiring the client-side cookie.
  logger.info('Superadmin session marked for revocation via client cookie deletion.');
}

export { SUPERADMIN_SESSION_TTL_SECONDS };
