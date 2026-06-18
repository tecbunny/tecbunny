type PublicSupabaseEnv = {
  url: string;
  publicKey: string;
  keySource: 'publishable' | 'anon';
  runtimeEnv: 'production' | 'development';
};

type ServiceSupabaseEnv = {
  url: string;
  serviceKey: string;
};

const SUPABASE_URL_ENV = 'NEXT_PUBLIC_SUPABASE_URL';
const PUBLISHABLE_KEY_ENV = 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY';
const LEGACY_ANON_KEY_ENV = 'NEXT_PUBLIC_SUPABASE_ANON_KEY';
const LEGACY_SERVICE_KEY_ENV = 'SUPABASE_SERVICE_ROLE_KEY';
const SECRET_KEY_ENV = 'SUPABASE_SECRET_KEY';

const trimEnv = (name: string): string => (process.env[name] || '').trim();

const isPlaceholder = (value: string): boolean =>
  !value ||
  value.toLowerCase().includes('placeholder') ||
  value === 'undefined' ||
  value === 'null';

const decodeBase64Url = (value: string): string | null => {
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');

    if (typeof globalThis.atob === 'function') {
      return globalThis.atob(padded);
    }

    return Buffer.from(padded, 'base64').toString('utf8');
  } catch {
    return null;
  }
};

const getJwtRole = (key: string): string | null => {
  const [, payload] = key.split('.');
  if (!payload) {
    return null;
  }

  const decoded = decodeBase64Url(payload);
  if (!decoded) {
    return null;
  }

  try {
    const parsed = JSON.parse(decoded) as { role?: unknown };
    return typeof parsed.role === 'string' ? parsed.role : null;
  } catch {
    return null;
  }
};

const isPublishableKey = (key: string): boolean => key.startsWith('sb_publishable_');
const isSecretKey = (key: string): boolean => key.startsWith('sb_secret_');
const isLegacyAnonKey = (key: string): boolean => getJwtRole(key) === 'anon';
const isLegacyServiceRoleKey = (key: string): boolean => getJwtRole(key) === 'service_role';

const assertValidSupabaseUrl = (url: string): void => {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Unsupported protocol');
    }
  } catch {
    throw new Error(`[supabase] ${SUPABASE_URL_ENV} must be a valid http(s) URL.`);
  }
};

export function getSupabaseRuntimeEnv(): 'production' | 'development' {
  if (process.env.VERCEL_ENV) {
    return process.env.VERCEL_ENV === 'production' ? 'production' : 'development';
  }

  return process.env.NODE_ENV === 'production' ? 'production' : 'development';
}

export function resolveSupabasePublicEnv(): PublicSupabaseEnv {
  const runtimeEnv = getSupabaseRuntimeEnv();
  const url = trimEnv(SUPABASE_URL_ENV);
  const publishableKey = trimEnv(PUBLISHABLE_KEY_ENV);
  const anonKey = trimEnv(LEGACY_ANON_KEY_ENV);
  const publicKey = runtimeEnv === 'production' ? publishableKey : publishableKey || anonKey;
  const keySource = isPublishableKey(publicKey) ? 'publishable' : 'anon';

  if (isPlaceholder(url)) {
    throw new Error(`[supabase] ${SUPABASE_URL_ENV} is required.`);
  }

  assertValidSupabaseUrl(url);

  if (isPlaceholder(publicKey)) {
    const required = runtimeEnv === 'production'
      ? PUBLISHABLE_KEY_ENV
      : `${PUBLISHABLE_KEY_ENV} or ${LEGACY_ANON_KEY_ENV}`;
    throw new Error(`[supabase] Missing public Supabase key. Expected ${required}.`);
  }

  if (isSecretKey(publicKey) || isLegacyServiceRoleKey(publicKey)) {
    throw new Error(
      `[supabase] Refusing to expose a secret/service-role key through public client env. Check ${PUBLISHABLE_KEY_ENV} and ${LEGACY_ANON_KEY_ENV}.`
    );
  }

  if (runtimeEnv === 'production' && !isPublishableKey(publicKey)) {
    throw new Error(`[supabase] Production must use ${PUBLISHABLE_KEY_ENV} with an sb_publishable_ key.`);
  }

  if (runtimeEnv !== 'production' && !isPublishableKey(publicKey) && !isLegacyAnonKey(publicKey)) {
    console.warn(
      `[supabase] Development public key is not an sb_publishable_ key or a legacy anon JWT. Verify ${PUBLISHABLE_KEY_ENV}/${LEGACY_ANON_KEY_ENV}.`
    );
  }

  return { url, publicKey, keySource, runtimeEnv };
}

export const isSupabasePublicConfigured = (() => {
  try {
    resolveSupabasePublicEnv();
    return true;
  } catch {
    return false;
  }
})();

export function requireSupabasePublicEnv() {
  return resolveSupabasePublicEnv();
}

export function resolveSupabaseServiceEnv(): ServiceSupabaseEnv {
  const url = trimEnv(SUPABASE_URL_ENV);
  const serviceKey = trimEnv(SECRET_KEY_ENV) || trimEnv(LEGACY_SERVICE_KEY_ENV);

  if (isPlaceholder(url)) {
    throw new Error(`[supabase] ${SUPABASE_URL_ENV} is required for service clients.`);
  }

  assertValidSupabaseUrl(url);

  if (isPlaceholder(serviceKey)) {
    throw new Error(`[supabase] Missing Supabase backend key. Expected ${SECRET_KEY_ENV} or ${LEGACY_SERVICE_KEY_ENV}.`);
  }

  if (isPublishableKey(serviceKey) || isLegacyAnonKey(serviceKey)) {
    throw new Error('[supabase] Backend service client cannot use a publishable or anon key.');
  }

  return { url, serviceKey };
}

export const isSupabaseServiceConfigured = (() => {
  try {
    resolveSupabaseServiceEnv();
    return true;
  } catch {
    return false;
  }
})();

export function requireSupabaseServiceEnv() {
  return resolveSupabaseServiceEnv();
}
