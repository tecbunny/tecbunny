'use client';

import React, { createContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';

import type { SupabaseClient, User as SupabaseUser } from '@supabase/supabase-js';

import type { User, UserRole } from '../lib/types';
import { createClient } from '../lib/supabase/client';
import { logger } from '../lib/logger';
import { SessionManager, SESSION_EXPIRED_EVENT } from '../lib/session-manager';
import { useAnalytics } from '../hooks/use-analytics';
import { normalizeRole } from '../lib/roles';

const parseRole = (value: unknown): UserRole | null => {
  return normalizeRole(value) as UserRole | null;
};

const METADATA_ROLE_KEYS = ['role', 'default_role', 'app_role', 'user_role'] as const;
const METADATA_ROLE_ARRAY_KEYS = ['roles', 'app_roles'] as const;

const extractRoleFromMetadata = (metadata: Record<string, unknown> | undefined | null): UserRole | null => {
  if (!metadata || typeof metadata !== 'object') return null;
  const metaRecord = metadata as Record<string, unknown>;

  for (const key of METADATA_ROLE_KEYS) {
    if (key in metaRecord) {
      const candidate = metaRecord[key];
      const parsed = parseRole(candidate);
      if (parsed) {
        return parsed;
      }
    }
  }

  for (const key of METADATA_ROLE_ARRAY_KEYS) {
    const candidate = metaRecord[key];
    if (Array.isArray(candidate)) {
      for (const value of candidate) {
        const parsed = parseRole(value);
        if (parsed) {
          return parsed;
        }
      }
    }
  }

  return null;
};

type OTPChannel = 'email' | 'sms' | 'whatsapp';

interface SignupDetails {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  captchaToken?: string;
  preferredChannel?: OTPChannel;
}

interface AuthData {
  user?: SupabaseUser | User;
  session?: any;
  profile?: any;
  [key: string]: unknown;
}

interface AuthResponse {
  success: boolean;
  message: string;
  data?: AuthData;
  error?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthResponse>;
  logout: (options?: { redirectTo?: string; silent?: boolean }) => Promise<void>;
  signup: (details: SignupDetails) => Promise<AuthResponse>;
  resendConfirmation: (email: string) => Promise<AuthResponse>;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  updateUser: (updatedUser: User) => void;
  supabase: SupabaseClient;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);
  const sessionManager = SessionManager.getInstance();
  const firstLoginAttemptedRef = useRef<Set<string>>(new Set());
  const { trackEvent } = useAnalytics();

  const buildFallbackProfile = useCallback((supabaseUser: SupabaseUser): User => {
    const appMetadataRole = extractRoleFromMetadata(supabaseUser.app_metadata as Record<string, unknown> | undefined);
    // Security note: In client tracking, using user_metadata for UI display is acceptable but not for authorization.
    // However, to be consistent with backend hardening, we prefer app_metadata or DB profile.
    // For standard user object construction, we will trust app_metadata first.
    const resolvedRole = appMetadataRole ?? 'customer';

    return {
      id: supabaseUser.id,
      name: supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0] || 'User',
      email: supabaseUser.email || '',
      mobile: supabaseUser.user_metadata?.mobile || '',
      role: resolvedRole,
      emailVerified: Boolean(supabaseUser.email_confirmed_at),
      email_confirmed_at: supabaseUser.email_confirmed_at ?? null,
      first_login_whatsapp_sent: false,
      first_login_notified_at: null
    };
  }, []);

  const triggerFirstLoginWhatsApp = useCallback(async (profile?: User | null) => {
    if (!profile || !profile.id || !profile.mobile || profile.first_login_whatsapp_sent) {
      return;
    }

    if (firstLoginAttemptedRef.current.has(profile.id)) {
      return;
    }

    firstLoginAttemptedRef.current.add(profile.id);

    try {
      const payload = {
        userId: profile.id,
        phone: profile.mobile,
        name: profile.name,
        loginUrl: typeof window !== 'undefined' ? `${window.location.origin}/auth/login` : undefined
      };

      const response = await fetch('/api/auth/first-login-whatsapp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        logger.warn('first_login_whatsapp_failed', {
          status: response.status,
          error: errorPayload?.error,
          userId: profile.id
        });
        firstLoginAttemptedRef.current.delete(profile.id);
        return;
      }

      const result = await response.json();

      if (!result?.success) {
        logger.warn('first_login_whatsapp_not_sent', {
          userId: profile.id,
          reason: result?.error,
          alreadySent: result?.alreadySent
        });
        if (result?.alreadySent) {
          setUser((prev) => {
            if (!prev || prev.id !== profile.id) {
              return prev;
            }

            return {
              ...prev,
              first_login_whatsapp_sent: true,
              first_login_notified_at: result.sentAt ?? prev.first_login_notified_at ?? null
            };
          });
        } else {
          firstLoginAttemptedRef.current.delete(profile.id);
        }
        return;
      }

      setUser((prev) => {
        if (!prev || prev.id !== profile.id) {
          return prev;
        }

        return {
          ...prev,
          first_login_whatsapp_sent: true,
          first_login_notified_at: result.sentAt ?? new Date().toISOString()
        };
      });
    } catch (error) {
      logger.error('first_login_whatsapp_error', { error, userId: profile.id });
      firstLoginAttemptedRef.current.delete(profile.id);
    }
  }, [setUser]);

  const fetchUserProfile = useCallback(async (supabaseUser: SupabaseUser) => {
    const fallbackProfile = buildFallbackProfile(supabaseUser);
    const appMetadataRole = extractRoleFromMetadata(supabaseUser.app_metadata as Record<string, unknown> | undefined);
    const userMetadataRole = extractRoleFromMetadata(supabaseUser.user_metadata as Record<string, unknown> | undefined);
    const resolvedRole = appMetadataRole ?? userMetadataRole ?? 'customer';

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', supabaseUser.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Profile doesn't exist, create a basic one from user metadata
          logger.info('Profile not found, creating from user metadata', { userId: supabaseUser.id });

          const newProfile: User = {
            id: supabaseUser.id,
            name: supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0] || 'User',
            email: supabaseUser.email || '',
            mobile: supabaseUser.user_metadata?.mobile || '',
            // Prefer app_metadata role (secure), fallback to user_metadata
            role: resolvedRole
          };
          
          // Try to insert the profile
          const { data: insertedProfile, error: insertError } = await supabase
            .from('profiles')
            .insert([{
              id: newProfile.id,
              name: newProfile.name,
              email: newProfile.email,
              mobile: newProfile.mobile,
              role: newProfile.role,
              email_verified: Boolean(supabaseUser.email_confirmed_at)
            }])
            .select()
            .single();
            
          if (insertError) {
            logger.error('Error creating profile', { error: insertError, userId: supabaseUser.id });
            return {
              ...newProfile,
              emailVerified: Boolean(supabaseUser.email_confirmed_at),
              email_confirmed_at: supabaseUser.email_confirmed_at ?? null,
              first_login_whatsapp_sent: false,
              first_login_notified_at: null
            };
          }
          
          return {
            ...insertedProfile,
            email: newProfile.email,
            emailVerified: Boolean(supabaseUser.email_confirmed_at || insertedProfile.email_confirmed_at),
            email_confirmed_at: supabaseUser.email_confirmed_at ?? insertedProfile.email_confirmed_at,
            first_login_whatsapp_sent: Boolean(insertedProfile.first_login_whatsapp_sent),
            first_login_notified_at: insertedProfile.first_login_notified_at ?? null
          } as User;
        } else {
          logger.error('Error fetching profile', { error, userId: supabaseUser.id });
          return fallbackProfile;
        }
      }
      
      const profileRole = parseRole(profile.role as string | undefined);
      const userRole = appMetadataRole ?? profileRole ?? userMetadataRole ?? 'customer';

      if (profileRole !== userRole) {
        try {
          await supabase
            .from('profiles')
            .update({ role: userRole })
            .eq('id', supabaseUser.id);
        } catch (updateError) {
          logger.warn('AuthProvider role normalization update failed', {
            error: updateError,
            userId: supabaseUser.id,
            currentRole: profile.role,
            normalizedRole: userRole
          });
        }
      }
      
      // Add email from auth user if not in profile
      return { 
        ...profile, 
        email: supabaseUser.email || profile.email || '',
        role: userRole,
        emailVerified: Boolean(supabaseUser.email_confirmed_at || profile.email_confirmed_at),
        email_confirmed_at: supabaseUser.email_confirmed_at ?? profile.email_confirmed_at,
        first_login_whatsapp_sent: Boolean(profile.first_login_whatsapp_sent),
        first_login_notified_at: profile.first_login_notified_at ?? null
      } as User;
    } catch (err) {
      logger.error('Unexpected error in fetchUserProfile', { error: err, userId: supabaseUser?.id });
      return fallbackProfile;
    }
  }, [buildFallbackProfile, supabase]);

  useEffect(() => {
    let mounted = true;
    
    const getSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          logger.error('Session error', { error });
          if (mounted) {
            setUser(null);
            setLoading(false);
          }
          return;
        }
        
          if (session?.user && mounted) {
            const fallbackProfile = buildFallbackProfile(session.user);
            setUser(fallbackProfile);
            setLoading(false);

            const profile = await fetchUserProfile(session.user);
            // Merge email verification information from auth session
            const emailConfirmedAt = session.user.email_confirmed_at ?? null;
            if (profile) {
              const normalizedProfile: User = {
                ...profile,
                emailVerified: Boolean(emailConfirmedAt || profile.email_confirmed_at),
                email_confirmed_at: emailConfirmedAt ?? profile.email_confirmed_at
              };
              if (mounted) {
                setUser(normalizedProfile);
                void triggerFirstLoginWhatsApp(normalizedProfile);
              }
            } else {
              if (mounted) {
                setUser(null);
              }
            }

            if (typeof window !== 'undefined') {
              const lastSignInAtRaw = session.user.last_sign_in_at;
              const parsedTimestamp = lastSignInAtRaw ? new Date(lastSignInAtRaw).getTime() : NaN;
              const sessionStart = Number.isFinite(parsedTimestamp) ? parsedTimestamp : Date.now();
              sessionManager.registerSessionStart(sessionStart);
            }
          } else if (mounted) {
            setUser(null);
            setLoading(false);
          }
      } catch (err) {
        logger.error('Session retrieval error', { error: err });
        if (mounted) {
          setUser(null);
          setLoading(false);
        }
      }
    }
    
    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      
      // Skip token refresh events to prevent unnecessary renders
      if (event === 'TOKEN_REFRESHED') {
        return;
      }
      
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
        const fallbackProfile = buildFallbackProfile(session.user);
        if (mounted) {
          setUser(fallbackProfile);
          setLoading(false);
        }

        const profile = await fetchUserProfile(session.user);
        if (mounted && profile) {
          setUser(profile);
          void triggerFirstLoginWhatsApp(profile);
        }

        if (typeof window !== 'undefined') {
          const lastSignInAtRaw = session.user.last_sign_in_at;
          const parsedTimestamp = lastSignInAtRaw ? new Date(lastSignInAtRaw).getTime() : NaN;
          const sessionStart = Number.isFinite(parsedTimestamp) ? parsedTimestamp : Date.now();
          sessionManager.registerSessionStart(sessionStart);
        }
      } else if (event === 'SIGNED_OUT') {
        if (mounted) {
          setUser(null);
          setLoading(false);
        }
        sessionManager.clearSessionTracking();
      }
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [supabase.auth, fetchUserProfile, sessionManager, triggerFirstLoginWhatsApp, buildFallbackProfile]);

  const login = async (identifier: string, password: string): Promise<AuthResponse> => {
    try {
      const normalized = identifier.trim();
      const isEmail = normalized.includes('@');
      const { data, error } = isEmail
        ? await supabase.auth.signInWithPassword({ email: normalized, password })
        : await supabase.auth.signInWithPassword({ phone: normalized.replace(/\D/g, ''), password });
      
      if (error) {
        logger.error('Supabase login error', { error, identifier: normalized });
        
        if (error.message.includes('Email not confirmed')) {
          return {
            success: false,
            message: 'Please check your email and click the confirmation link before signing in.',
            error: 'Email not confirmed'
          };
        }
        
        return {
          success: false,
          message: error.message || 'Login failed',
          error: error.message || 'Login failed'
        };
      }
      
      if (!data || !data.session) {
        logger.error('Supabase login: No session returned', { data, identifier: normalized });
        return {
          success: false,
          message: 'No session returned from server',
          error: 'No session returned from Supabase'
        };
      }

      if (data.session.user) {
        const profile = await fetchUserProfile(data.session.user);
        setUser(profile);
        void triggerFirstLoginWhatsApp(profile);
        trackEvent('login', { userId: profile.id, email: profile.email });

        if (typeof window !== 'undefined') {
          const lastSignInAtRaw = data.session.user.last_sign_in_at;
          const parsedTimestamp = lastSignInAtRaw ? new Date(lastSignInAtRaw).getTime() : NaN;
          const sessionStart = Number.isFinite(parsedTimestamp) ? parsedTimestamp : Date.now();
          sessionManager.registerSessionStart(sessionStart);
        }
        
        // Return success response with user profile for redirect logic
        return {
          success: true,
          message: 'Login successful',
          data: { user: data.user, session: data.session, profile }
        };
      }

      return {
        success: true,
        message: 'Login successful',
        data: { user: data.user, session: data.session }
      };
    } catch (error) {
      logger.error('Login error', { error, identifier });
      return {
        success: false,
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
        error: error instanceof Error ? error.message : 'An unexpected error occurred'
      };
    }
  };

  const logout = useCallback(async (options?: { redirectTo?: string; silent?: boolean }) => {
    const redirectTo = options?.redirectTo ?? '/';
    const silent = Boolean(options?.silent);

    if (!silent) {
      setLoading(true);
    }

    sessionManager.clearSessionTracking();

    try {
      const response = await fetch('/api/auth/signout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Server signout failed');
      }
    } catch (error) {
      logger.error('Server signout error', { error });
    }

    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        logger.error('Client signout error', { error });
      }
    } catch (error) {
      logger.error('Supabase signout failure', { error });
    }

    setUser(null);

    if (!silent) {
      setLoading(false);
    }

    if (typeof window !== 'undefined') {
      window.location.href = redirectTo;
    }
  }, [sessionManager, supabase]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleSessionExpired = () => {
      logout({ redirectTo: '/auth/login?session=expired', silent: true });
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);

    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    };
  }, [logout]);

  const signup = async (details: SignupDetails): Promise<AuthResponse> => {
    try {
      // runtime bypass via query param or env (only allowed in non-production)
      const runtimeBypass = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('disable_captcha') === '1';
      const captchaDisabled = process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_DISABLE_CAPTCHA === 'true';
      const captchaBypassed = captchaDisabled || (process.env.NODE_ENV !== 'production' && runtimeBypass);

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (captchaBypassed) headers['x-bypass-captcha'] = '1';

      const preferredChannel: OTPChannel = details.preferredChannel && ['email', 'sms', 'whatsapp'].includes(details.preferredChannel)
        ? details.preferredChannel
        : (details.email ? 'email' : (details.phone ? 'sms' : 'email'));

      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: `${details.firstName} ${details.lastName}`,
          email: details.email,
          mobile: details.phone,
          password: details.password,
          role: 'customer',
          captchaToken: details.captchaToken,
          channel: preferredChannel
        }),
      });

      const data = await response.json();

      // If captcha failed but we are in non-production, retry once with bypass header set
      if (!response.ok) {
        const errMsg = data?.error || '';
        // detect captcha-related error
        const isCaptchaError = typeof errMsg === 'string' && errMsg.toLowerCase().includes('captcha');
        if (isCaptchaError && process.env.NODE_ENV !== 'production') {
          try {
            const retryHeaders: Record<string, string> = { 'Content-Type': 'application/json', 'x-bypass-captcha': '1' };
            const retryResp = await fetch('/api/auth/signup', {
              method: 'POST',
              headers: retryHeaders,
              body: JSON.stringify({
                name: `${details.firstName} ${details.lastName}`,
                email: details.email,
                mobile: details.phone,
                password: details.password,
                role: 'customer',
                captchaToken: details.captchaToken,
                channel: preferredChannel
              }),
            });
            const retryData = await retryResp.json();
            if (retryResp.ok) {
              return {
                success: true,
                message: retryData.message || `Verification code sent via ${retryData.channel || preferredChannel}.`,
                data: {
                  otpId: retryData.otpId,
                  channel: retryData.channel || preferredChannel,
                  fallbackAvailable: retryData.fallbackAvailable ?? false,
                  preferredChannel
                }
              };
            }
            // fallthrough to return error with original message
          } catch (retryErr) {
            logger.warn('Signup retry with bypass failed', { error: retryErr, email: details.email });
          }
        }
        return {
          success: false,
          message: data.error || 'Signup failed',
          error: data.error || 'Signup failed'
        };
      }

      // Return data in the format expected by calling components
      if (!data?.otpId) {
        return {
          success: false,
          message: 'Could not create verification reference. Please try again.',
          error: 'Missing otpId'
        };
      }

      return {
        success: true,
        message: data.message || `Verification code sent via ${data.channel || preferredChannel}.`,
        data: {
          otpId: data.otpId,
          channel: data.channel || preferredChannel,
          fallbackAvailable: data.fallbackAvailable ?? false,
          preferredChannel
        }
      };
    } catch (error) {
      logger.error('Signup error', { error, email: details.email });
      return {
        success: false,
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
        error: error instanceof Error ? error.message : 'An unexpected error occurred'
      };
    }
  };

  const resendConfirmation = async (email: string, captchaToken?: string): Promise<AuthResponse> => {
    try {
  // Include mobile from local signup session when available to support OTP-on-call resend flows
      const stored = localStorage.getItem('signup_session');
      let storedMobile: string | undefined = undefined;
      if (stored) {
        try { storedMobile = JSON.parse(stored).mobile; } catch {}
      }

      // runtime bypass header support
      const runtimeBypass = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('disable_captcha') === '1';
      const captchaDisabled = process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_DISABLE_CAPTCHA === 'true';
      const captchaBypassed = captchaDisabled || (process.env.NODE_ENV !== 'production' && runtimeBypass);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (captchaBypassed) headers['x-bypass-captcha'] = '1';

      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers,
        body: JSON.stringify({ email, mobile: storedMobile, captchaToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        // If captcha error and non-production, retry once with bypass header
        const errMsg = data?.error || '';
        const isCaptchaError = typeof errMsg === 'string' && errMsg.toLowerCase().includes('captcha');
        if (isCaptchaError && process.env.NODE_ENV !== 'production') {
          try {
            const retryHeaders: Record<string, string> = { 'Content-Type': 'application/json', 'x-bypass-captcha': '1' };
            const retryResp = await fetch('/api/auth/resend-verification', {
              method: 'POST',
              headers: retryHeaders,
              body: JSON.stringify({ email, mobile: storedMobile, captchaToken })
            });
            const retryData = await retryResp.json();
            if (retryResp.ok) {
              return {
                success: true,
                message: 'Verification email resent successfully',
                data: retryData
              };
            }
          } catch (retryErr) {
            logger.warn('Resend retry with bypass failed', { error: retryErr, email });
          }
        }
        return {
          success: false,
          message: data.error || 'Failed to resend verification email',
          error: data.error || 'Failed to resend verification email'
        };
      }

      return {
        success: true,
        message: 'Verification email resent successfully',
        data
      };
    } catch (error) {
      logger.error('Resend confirmation error', { error, email });
      return {
        success: false,
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
        error: error instanceof Error ? error.message : 'An unexpected error occurred'
      };
    }
  };

  const updateUser = useCallback((updatedUser: User) => {
    setUser(updatedUser);
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      logout,
      signup,
      resendConfirmation,
      setUser,
      updateUser,
      supabase
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};