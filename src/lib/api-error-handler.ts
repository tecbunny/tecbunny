import { NextRequest, NextResponse } from 'next/server';

import { logger } from '@/lib/logger';

export interface APIError {
  code: string;
  message: string;
  statusCode: number;
  details?: unknown;
  timestamp: string;
  requestId?: string;
}

export class APIErrorHandler {
  static handle(error: unknown, request: NextRequest, context?: string): NextResponse {
    const requestId = request.headers.get('x-request-id') || 
                     request.headers.get('x-correlation-id') || 
                     Math.random().toString(36).substring(7);

    let apiError: APIError;

    if (error instanceof Error) {
      // Known error types
      if (error.name === 'ValidationError') {
        apiError = {
          code: 'VALIDATION_ERROR',
          message: error.message,
          statusCode: 400,
          timestamp: new Date().toISOString(),
          requestId
        };
      } else if (error.name === 'UnauthorizedError') {
        apiError = {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          statusCode: 401,
          timestamp: new Date().toISOString(),
          requestId
        };
      } else if (error.name === 'ForbiddenError') {
        apiError = {
          code: 'FORBIDDEN',
          message: 'Access denied',
          statusCode: 403,
          timestamp: new Date().toISOString(),
          requestId
        };
      } else if (error.name === 'NotFoundError') {
        apiError = {
          code: 'NOT_FOUND',
          message: 'Resource not found',
          statusCode: 404,
          timestamp: new Date().toISOString(),
          requestId
        };
      } else if (error.name === 'RateLimitError') {
        apiError = {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests',
          statusCode: 429,
          timestamp: new Date().toISOString(),
          requestId
        };
      } else {
        // Generic server error
        apiError = {
          code: 'INTERNAL_SERVER_ERROR',
          message: process.env.NODE_ENV === 'production' 
            ? 'An internal server error occurred' 
            : error.message,
          statusCode: 500,
          details: process.env.NODE_ENV === 'development' ? {
            stack: error.stack,
            name: error.name
          } : undefined,
          timestamp: new Date().toISOString(),
          requestId
        };
      }
    } else {
      // Unknown error type
      apiError = {
        code: 'UNKNOWN_ERROR',
        message: 'An unknown error occurred',
        statusCode: 500,
        details: process.env.NODE_ENV === 'development' ? { error } : undefined,
        timestamp: new Date().toISOString(),
        requestId
      };
    }

    // Log the error
    logger.error('API Error', {
      error: apiError,
      context,
      url: request.url,
      method: request.method,
      userAgent: request.headers.get('user-agent'),
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
    });

    return NextResponse.json(
      {
        error: apiError.code,
        message: apiError.message,
        timestamp: apiError.timestamp,
        requestId: apiError.requestId,
        ...(apiError.details ? { details: apiError.details } : {})
      },
      { status: apiError.statusCode }
    );
  }
}

// Custom error classes
export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends Error {
  constructor(message: string = 'Authentication required') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  constructor(message: string = 'Access denied') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class RateLimitError extends Error {
  constructor(message: string = 'Rate limit exceeded') {
    super(message);
    this.name = 'RateLimitError';
  }
}

// Utility function for async error handling
export function asyncHandler(
  fn: (req: NextRequest) => Promise<NextResponse>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      return await fn(req);
    } catch (error) {
      return APIErrorHandler.handle(error, req);
    }
  };
}

// Validation helpers
export function validateRequired(value: unknown, fieldName: string): void {
  if (value === undefined || value === null || value === '') {
    throw new ValidationError(`${fieldName} is required`);
  }
}

export function validateEmail(email: string): void {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new ValidationError('Invalid email format');
  }
}

export function validatePhone(phone: string): void {
  const phoneRegex = /^[\+]?[\d\s\-\(\)]{10,}$/;
  if (!phoneRegex.test(phone)) {
    throw new ValidationError('Invalid phone number format');
  }
}

export function validateOTP(otp: string): void {
  if (!/^\d{6}$/.test(otp)) {
    throw new ValidationError('OTP must be 6 digits');
  }
}