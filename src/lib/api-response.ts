import { NextResponse } from 'next/server';

import { logger } from '@/lib/logger';

export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    timestamp: string;
    requestId?: string;
    version?: string;
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  total?: number;
}

export class APIResponseBuilder {
  private static generateRequestId(): string {
    try {
      return crypto.randomUUID();
    } catch {
      return Math.random().toString(36).substring(2, 15) + 
             Math.random().toString(36).substring(2, 15);
    }
  }

  static success<T>(
    data: T,
    statusCode: number = 200,
    meta?: Partial<APIResponse['meta']>
  ): NextResponse {
    const response: APIResponse<T> = {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: this.generateRequestId(),
        version: '1.0.0',
        ...meta
      }
    };

    return NextResponse.json(response, { status: statusCode });
  }

  static error(
    code: string,
    message: string,
    statusCode: number = 400,
    details?: Record<string, unknown>,
    requestId?: string
  ): NextResponse {
    const response: APIResponse = {
      success: false,
      error: {
        code,
        message,
        ...(details && { details })
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: requestId || this.generateRequestId(),
        version: '1.0.0'
      }
    };

    // Log error responses
    logger.error('API Error Response', {
      code,
      message,
      statusCode,
      details,
      requestId: response.meta?.requestId
    });

    return NextResponse.json(response, { status: statusCode });
  }

  static paginated<T>(
    data: T[],
    pagination: PaginationOptions,
    statusCode: number = 200
  ): NextResponse {
    const { page = 1, limit = 10, total = 0 } = pagination;
    const totalPages = Math.ceil(total / limit);

    const response: APIResponse<T[]> = {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: this.generateRequestId(),
        version: '1.0.0',
        pagination: {
          page,
          limit,
          total,
          totalPages
        }
      }
    };

    return NextResponse.json(response, { status: statusCode });
  }

  static created<T>(data: T): NextResponse {
    return this.success(data, 201);
  }

  static noContent(): NextResponse {
    const response: APIResponse = {
      success: true,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: this.generateRequestId(),
        version: '1.0.0'
      }
    };

    return NextResponse.json(response, { status: 204 });
  }

  static badRequest(message: string, details?: Record<string, unknown>): NextResponse {
    return this.error('BAD_REQUEST', message, 400, details);
  }

  static unauthorized(message: string = 'Authentication required'): NextResponse {
    return this.error('UNAUTHORIZED', message, 401);
  }

  static forbidden(message: string = 'Access denied'): NextResponse {
    return this.error('FORBIDDEN', message, 403);
  }

  static notFound(message: string = 'Resource not found'): NextResponse {
    return this.error('NOT_FOUND', message, 404);
  }

  static conflict(message: string, details?: Record<string, unknown>): NextResponse {
    return this.error('CONFLICT', message, 409, details);
  }

  static unprocessableEntity(message: string, details?: Record<string, unknown>): NextResponse {
    return this.error('UNPROCESSABLE_ENTITY', message, 422, details);
  }

  static tooManyRequests(message: string = 'Rate limit exceeded', retryAfter?: number): NextResponse {
    const headers: Record<string, string> = {};
    if (retryAfter) {
      headers['Retry-After'] = retryAfter.toString();
    }

    const response = this.error('RATE_LIMIT_EXCEEDED', message, 429);
    
    // Add headers to the response
    if (retryAfter) {
      response.headers.set('Retry-After', retryAfter.toString());
    }

    return response;
  }

  static internalServerError(
    message: string = 'Internal server error',
    details?: Record<string, unknown>
  ): NextResponse {
    // Don't expose details in production
    const exposedDetails = process.env.NODE_ENV === 'development' ? details : undefined;
    return this.error('INTERNAL_SERVER_ERROR', message, 500, exposedDetails);
  }

  static serviceUnavailable(message: string = 'Service temporarily unavailable'): NextResponse {
    return this.error('SERVICE_UNAVAILABLE', message, 503);
  }
}

// Auth user interface
interface AuthUser {
  id: string;
  email: string;
  name?: string;
  role?: string;
}

// Common response helpers
export const APIResponses = {
  // Auth responses
  loginSuccess: (user: AuthUser, token: string) => 
    APIResponseBuilder.success({ user, token, message: 'Login successful' }),
  
  loginFailed: () => 
    APIResponseBuilder.unauthorized('Invalid credentials'),
  
  tokenExpired: () => 
    APIResponseBuilder.unauthorized('Token expired'),
  
  accountNotVerified: () => 
    APIResponseBuilder.forbidden('Account not verified'),

  // OTP responses
  otpSent: (channel: string, maskedContact: string) => 
    APIResponseBuilder.success({ 
      message: `OTP sent via ${channel}`,
      channel,
      maskedContact 
    }),
  
  otpVerified: () => 
    APIResponseBuilder.success({ message: 'OTP verified successfully' }),
  
  otpInvalid: () => 
    APIResponseBuilder.badRequest('Invalid or expired OTP'),
  
  otpExpired: () => 
    APIResponseBuilder.badRequest('OTP has expired'),

  // Communication preferences responses
  preferencesUpdated: () => 
    APIResponseBuilder.success({ message: 'Communication preferences updated' }),
  
  preferencesRetrieved: (preferences: Record<string, unknown>) => 
    APIResponseBuilder.success(preferences),

  // Validation responses
  validationError: (field: string, message: string) => 
    APIResponseBuilder.badRequest(`Validation error: ${message}`, { field }),
  
  missingField: (field: string) => 
    APIResponseBuilder.badRequest(`Missing required field: ${field}`, { field }),

  // Generic responses
  operationSuccess: (message: string, data?: Record<string, unknown>) => 
    APIResponseBuilder.success({ message, ...data }),
  
  operationFailed: (message: string, details?: Record<string, unknown>) => 
    APIResponseBuilder.badRequest(message, details),

  // WhatsApp responses
  whatsappSent: (messageId: string) => 
    APIResponseBuilder.success({ 
      message: 'WhatsApp message sent successfully',
      messageId 
    }),
  
  whatsappFailed: (error: string) => 
    APIResponseBuilder.internalServerError('Failed to send WhatsApp message', { error }),

  // Health check responses
  healthCheck: (status: Record<string, unknown>) => 
    APIResponseBuilder.success(status),
  
  serviceDown: (service: string) => 
    APIResponseBuilder.serviceUnavailable(`${service} service is currently unavailable`)
};

// Type guards for response validation
export function isAPIResponse(obj: unknown): obj is APIResponse {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof (obj as APIResponse).success === 'boolean' &&
    ((obj as APIResponse).data !== undefined || (obj as APIResponse).error !== undefined)
  );
}

export function isSuccessResponse<T>(response: APIResponse): response is APIResponse<T> & { success: true } {
  return response.success === true && response.data !== undefined;
}

export function isErrorResponse(response: APIResponse): response is APIResponse & { success: false } {
  return response.success === false && response.error !== undefined;
}