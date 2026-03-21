import { NextRequest, NextResponse } from 'next/server';

import { logger } from '../../../../lib/logger';
import { AdminAuthError, requireAdminContext } from '../../../../lib/auth/admin-guard';

const DEFAULT_SECURITY_SETTINGS: Record<string, { value: string; description: string | null }> = {
  password_min_length: {
    value: '8',
    description: 'Minimum number of characters required for user passwords.'
  },
  password_hibp_check: {
    value: 'false',
    description: 'Check passwords against Have I Been Pwned breach database.'
  },
  password_require_uppercase: {
    value: 'true',
    description: 'Require at least one uppercase character in passwords.'
  },
  password_require_symbols: {
    value: 'true',
    description: 'Require at least one symbol character in passwords.'
  },
  mfa_totp_enabled: {
    value: 'true',
    description: 'Allow users to enroll in TOTP-based multi-factor authentication.'
  },
  mfa_phone_enabled: {
    value: 'false',
    description: 'Allow SMS/phone-based multi-factor authentication.'
  },
  mfa_webauthn_enabled: {
    value: 'false',
    description: 'Allow WebAuthn (security keys or biometrics) for multi-factor authentication.'
  },
  mfa_required_for_admins: {
    value: 'true',
    description: 'Require multi-factor authentication for admin and manager accounts.'
  },
  session_timeout_minutes: {
    value: '60',
    description: 'Number of minutes before inactive sessions are automatically signed out.'
  },
  max_login_attempts: {
    value: '5',
    description: 'Maximum login attempts before temporarily locking the account.'
  },
  login_rate_limit_per_minute: {
    value: '20',
    description: 'Rate limit for login attempts per minute from a single IP address.'
  },
  audit_log_retention_days: {
    value: '90',
    description: 'Number of days to retain security audit log entries.'
  }
};

export async function GET(_: NextRequest) {
  try {
    const { serviceSupabase } = await requireAdminContext();

    // Get all security settings
    const { data: settings, error } = await serviceSupabase
      .from('security_settings')
      .select('setting_key, setting_value, description')
      .eq('is_active', true)
      .order('setting_key');

    if (error) {
      const missingTable =
        error.code === 'PGRST116' ||
        (typeof error.message === 'string' && /security_settings/i.test(error.message) && /does not exist/i.test(error.message));

      if (missingTable) {
        logger.warn('security_settings table missing; returning defaults');
        return NextResponse.json({
          success: true,
          settings: DEFAULT_SECURITY_SETTINGS,
          fallback: true
        });
      }

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform array to object for easier access
    const settingsObject = (settings || []).reduce((acc: Record<string, { value: any; description: string | null }>, setting: any) => {
      acc[String(setting.setting_key)] = {
        value: setting.setting_value,
        description: setting.description ?? null,
      };
      return acc;
    }, {} as Record<string, { value: any; description: string | null }>);

    return NextResponse.json({
      success: true,
      settings: Object.keys(settingsObject).length > 0 ? settingsObject : DEFAULT_SECURITY_SETTINGS,
      fallback: Object.keys(settingsObject).length === 0
    });

  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logger.error('Error fetching security settings:', { error });
    return NextResponse.json(
      { error: 'Failed to fetch security settings' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, role, serviceSupabase } = await requireAdminContext();

    const body = await request.json();
    const { setting_key, setting_value, description } = body;

    if (!setting_key || !setting_value) {
      return NextResponse.json(
        { error: 'setting_key and setting_value are required' },
        { status: 400 }
      );
    }

    // Update or insert security setting
    const { data, error } = await serviceSupabase
      .from('security_settings')
      .upsert({
        setting_key,
        setting_value,
        description,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'setting_key'
      })
      .select()
      .single();

    if (error) {
      const missingTable =
        error.code === 'PGRST116' ||
        (typeof error.message === 'string' && /security_settings/i.test(error.message) && /does not exist/i.test(error.message));

      if (missingTable) {
        logger.warn('security_settings table missing on update attempt');
        return NextResponse.json({
          error: 'Security settings storage is not configured. Please run the security schema migration.',
          fallback: true
        }, { status: 501 });
      }

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log the security setting change
    await serviceSupabase
      .from('security_audit_log')
      .insert({
        event_type: 'security_setting_updated',
        user_id: user.id,
        event_data: {
          setting_key,
          new_value: setting_value,
          description,
          updated_by_role: role,
        },
        severity: 'medium'
      });

    return NextResponse.json({
      success: true,
      setting: data
    });

  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logger.error('Error updating security setting:', { error });
    return NextResponse.json(
      { error: 'Failed to update security setting' },
      { status: 500 }
    );
  }
}
