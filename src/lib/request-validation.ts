import { NextRequest, NextResponse } from 'next/server';

import { rateLimit } from '@/lib/rate-limit';
import { ValidationError, APIErrorHandler } from '@/lib/api-error-handler';

export interface RequestValidationOptions {
  requireAuth?: boolean;
  requireVerification?: boolean;
  allowedMethods?: string[];
  rateLimit?: {
    maxRequests: number;
    windowMs: number;
  };
  validation?: {
    body?: (body: any) => void;
    query?: (query: URLSearchParams) => void;
    headers?: (headers: Headers) => void;
  };
}

export function withRequestValidation(
  handler: (req: NextRequest) => Promise<NextResponse>,
  options: RequestValidationOptions = {}
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      // Method validation
      if (options.allowedMethods && !options.allowedMethods.includes(req.method)) {
        return NextResponse.json(
          { error: 'METHOD_NOT_ALLOWED', message: `Method ${req.method} not allowed` },
          { status: 405 }
        );
      }

      // Rate limiting
      if (options.rateLimit) {
        // Generate a unique key for rate limiting
        const clientIP = req.headers.get('x-forwarded-for') || 
                        req.headers.get('x-real-ip') || 
                        req.headers.get('x-client-ip') || 
                        'unknown';
        const rateLimitKey = `${clientIP}:${req.nextUrl.pathname}`;
        
        const rateLimitResult = await rateLimit(
          rateLimitKey,
          options.rateLimit.maxRequests,
          options.rateLimit.windowMs
        );
        
        if (!rateLimitResult.allowed) {
          return NextResponse.json(
            { 
              error: 'RATE_LIMIT_EXCEEDED', 
              message: 'Too many requests',
              retryAfter: Math.ceil((rateLimitResult.reset || Date.now() + 60000 - Date.now()) / 1000)
            },
            { 
              status: 429,
              headers: {
                'Retry-After': Math.ceil((rateLimitResult.reset || Date.now() + 60000 - Date.now()) / 1000).toString()
              }
            }
          );
        }
      }

      // Authentication validation
      if (options.requireAuth) {
        const authHeader = req.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return NextResponse.json(
            { error: 'UNAUTHORIZED', message: 'Authentication required' },
            { status: 401 }
          );
        }
      }

      // Request validation
      if (options.validation) {
        // Body validation
        if (options.validation.body && req.method !== 'GET') {
          try {
            const body = await req.json();
            options.validation.body(body);
          } catch (error) {
            if (error instanceof ValidationError) {
              return NextResponse.json(
                { error: 'VALIDATION_ERROR', message: error.message },
                { status: 400 }
              );
            }
            throw error;
          }
        }

        // Query validation
        if (options.validation.query) {
          const url = new URL(req.url);
          options.validation.query(url.searchParams);
        }

        // Headers validation
        if (options.validation.headers) {
          options.validation.headers(req.headers);
        }
      }

      // Call the actual handler
      return await handler(req);
    } catch (error) {
      return APIErrorHandler.handle(error, req, 'RequestValidation');
    }
  };
}

// Common validation schemas
export const otpValidation = {
  body: (body: any) => {
    if (!body.otp || !/^\d{6}$/.test(body.otp)) {
      throw new ValidationError('Invalid OTP format');
    }
    if (!body.channel || !['sms', 'email'].includes(body.channel)) {
      throw new ValidationError('Invalid channel');
    }
  }
};

export const phoneValidation = {
  body: (body: any) => {
    if (!body.phone || !/^[\+]?[\d\s\-\(\)]{10,}$/.test(body.phone)) {
      throw new ValidationError('Invalid phone number');
    }
  }
};

export const emailValidation = {
  body: (body: any) => {
    if (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      throw new ValidationError('Invalid email format');
    }
  }
};

export const communicationPreferencesValidation = {
  body: (body: any) => {
    const allowedChannels = ['email', 'sms', 'whatsapp'];
    const allowedTypes = ['marketing', 'transactional', 'security'];

    if (body.preferred_channels) {
      if (!Array.isArray(body.preferred_channels)) {
        throw new ValidationError('preferred_channels must be an array');
      }
      if (!body.preferred_channels.every((ch: string) => allowedChannels.includes(ch))) {
        throw new ValidationError('Invalid preferred channel');
      }
    }

    if (body.notification_types) {
      if (typeof body.notification_types !== 'object') {
        throw new ValidationError('notification_types must be an object');
      }
      for (const [type, enabled] of Object.entries(body.notification_types)) {
        if (!allowedTypes.includes(type)) {
          throw new ValidationError(`Invalid notification type: ${type}`);
        }
        if (typeof enabled !== 'boolean') {
          throw new ValidationError(`notification_types.${type} must be boolean`);
        }
      }
    }
  }
};

// Common rate limits
export const authRateLimit = {
  maxRequests: 5,
  windowMs: 15 * 60 * 1000 // 15 minutes
};

export const otpRateLimit = {
  maxRequests: 3,
  windowMs: 5 * 60 * 1000 // 5 minutes
};

export const generalAPIRateLimit = {
  maxRequests: 100,
  windowMs: 15 * 60 * 1000 // 15 minutes
};

// Pre-configured middleware
export const authMiddleware = (handler: (req: NextRequest) => Promise<NextResponse>) =>
  withRequestValidation(handler, {
    requireAuth: true,
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE'],
    rateLimit: generalAPIRateLimit
  });

export const publicMiddleware = (handler: (req: NextRequest) => Promise<NextResponse>) =>
  withRequestValidation(handler, {
    allowedMethods: ['GET', 'POST'],
    rateLimit: generalAPIRateLimit
  });

export const otpMiddleware = (handler: (req: NextRequest) => Promise<NextResponse>) =>
  withRequestValidation(handler, {
    allowedMethods: ['POST'],
    rateLimit: otpRateLimit,
    validation: otpValidation
  });