import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { environmentValidator } from '@/lib/environment-validator';
import { logger } from '@/lib/logger';

interface HealthCheck {
  service: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  message: string;
  responseTime?: number;
  details?: any;
}

export async function GET(_request: NextRequest) {
  const checks: HealthCheck[] = [];
  const startTime = Date.now();

  try {
    // 1. Environment Variables Check
    const envStart = Date.now();
    const envStatus = environmentValidator.isValid();
    const featureStatus = environmentValidator.getFeatureStatus();
    
    checks.push({
      service: 'Environment Variables',
      status: envStatus ? 'healthy' : 'unhealthy',
      message: envStatus ? 'All required environment variables present' : 'Missing required environment variables',
      responseTime: Date.now() - envStart,
      details: {
        features: featureStatus,
        errors: environmentValidator.getErrors(),
        warnings: environmentValidator.getWarnings()
      }
    });

    // 2. Database Connection Check
    const dbStart = Date.now();
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from('products')
        .select('id')
        .limit(1);
      
      checks.push({
        service: 'Database (Supabase)',
        status: error ? 'unhealthy' : 'healthy',
        message: error ? `Database error: ${error.message}` : 'Database connection successful',
        responseTime: Date.now() - dbStart,
        details: { 
          hasData: data && data.length > 0,
          error: error?.message 
        }
      });
    } catch (dbError) {
      checks.push({
        service: 'Database (Supabase)',
        status: 'unhealthy',
        message: `Database connection failed: ${dbError instanceof Error ? dbError.message : 'Unknown error'}`,
        responseTime: Date.now() - dbStart
      });
    }

    // 3. OTP Tables Check
    const otpStart = Date.now();
    try {
      const supabase = await createClient();
      const { error } = await supabase
        .from('otp_codes')
        .select('id')
        .limit(1);
      
      checks.push({
        service: 'OTP Codes Table',
        status: error ? 'unhealthy' : 'healthy',
        message: error ? `OTP table error: ${error.message}` : 'OTP table accessible',
        responseTime: Date.now() - otpStart,
        details: { error: error?.message }
      });
    } catch (otpError) {
      checks.push({
        service: 'OTP Codes Table',
        status: 'unhealthy',
        message: `OTP table check failed: ${otpError instanceof Error ? otpError.message : 'Unknown error'}`,
        responseTime: Date.now() - otpStart
      });
    }

    // 4. Communication Preferences Table Check
    const prefStart = Date.now();
    try {
      const supabase = await createClient();
      const { error } = await supabase
        .from('user_communication_preferences')
        .select('id')
        .limit(1);
      
      checks.push({
        service: 'Communication Preferences Table',
        status: error ? 'unhealthy' : 'healthy',
        message: error ? `Preferences table error: ${error.message}` : 'Preferences table accessible',
        responseTime: Date.now() - prefStart,
        details: { error: error?.message }
      });
    } catch (prefError) {
      checks.push({
        service: 'Communication Preferences Table',
        status: 'unhealthy',
        message: `Preferences table check failed: ${prefError instanceof Error ? prefError.message : 'Unknown error'}`,
        responseTime: Date.now() - prefStart
      });
    }

    // 5. External Services Check

    // Email Service Check
    if (featureStatus.email) {
      checks.push({
        service: 'SMTP Email Service',
        status: 'healthy',
        message: 'Email service configured',
        details: { configured: true }
      });
    } else {
      checks.push({
        service: 'SMTP Email Service',
        status: 'degraded',
        message: 'Email service not configured (missing SMTP credentials)',
        details: { configured: false }
      });
    }

    // WhatsApp Service Check
    if (featureStatus.whatsapp) {
      checks.push({
        service: 'WhatsApp Business API',
        status: 'healthy',
        message: 'WhatsApp service configured',
        details: { configured: true }
      });
    } else {
      checks.push({
        service: 'WhatsApp Business API',
        status: 'degraded',
        message: 'WhatsApp service not configured (missing API credentials)',
        details: { configured: false }
      });
    }

    // Overall system status
    const overallStatus = checks.every(check => check.status === 'healthy') 
      ? 'healthy' 
      : checks.some(check => check.status === 'unhealthy') 
        ? 'unhealthy' 
        : 'degraded';

    const totalResponseTime = Date.now() - startTime;

    const healthResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      totalResponseTime,
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      features: featureStatus,
      checks
    };

    logger.info('Health check completed', {
      status: overallStatus,
      totalResponseTime,
      checksCount: checks.length
    });

    // Return appropriate HTTP status based on health
    const httpStatus = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;

    return NextResponse.json(healthResponse, { status: httpStatus });

  } catch (error) {
    logger.error('Health check failed', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      totalResponseTime: Date.now() - startTime,
      error: 'Health check system failure',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 503 });
  }
}
