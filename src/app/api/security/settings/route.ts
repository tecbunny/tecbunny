import { NextRequest, NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import { AdminAuthError, requireSuperadminContext } from '@/lib/auth/admin-guard';

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
    description: 'Allow phone-based multi-factor authentication through WhatsApp.'
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

const SECURITY_SETTING_KEYS = Object.keys(DEFAULT_SECURITY_SETTINGS);

function isMissingSecuritySettingsTable(error: { code?: string; message?: string } | null | undefined) {
  return !!error && (
    error.code === 'PGRST116' ||
    (typeof error.message === 'string' && /security_settings/i.test(error.message) && /does not exist/i.test(error.message))
  );
}

function normalizeSettingsRows(
  rows: Array<{ key: string; value: unknown; description?: string | null }> | null | undefined
) {
  const settingsObject = (rows || []).reduce((acc, setting) => {
    acc[String(setting.key)] = {
      value: typeof setting.value === 'string' ? setting.value : String(setting.value ?? ''),
      description: setting.description ?? DEFAULT_SECURITY_SETTINGS[String(setting.key)]?.description ?? null,
    };
    return acc;
  }, {} as Record<string, { value: string; description: string | null }>);

  return SECURITY_SETTING_KEYS.reduce((acc, key) => {
    acc[key] = settingsObject[key] ?? DEFAULT_SECURITY_SETTINGS[key];
    return acc;
  }, {} as Record<string, { value: string; description: string | null }>);
}

async function loadSettingsTableFallback(serviceSupabase: Awaited<ReturnType<typeof requireSuperadminContext>>['serviceSupabase']) {
  const { data, error } = await serviceSupabase
    .from('settings')
    .select('key, value, description')
    .in('key', SECURITY_SETTING_KEYS)
    .order('key');

  if (error) {
    throw error;
  }

  if ((data || []).length > 0) {
    return {
      settings: normalizeSettingsRows(data as Array<{ key: string; value: unknown; description?: string | null }>),
      seeded: false,
    };
  }

  const seedRows = SECURITY_SETTING_KEYS.map((key) => ({
    key,
    value: DEFAULT_SECURITY_SETTINGS[key].value,
    description: DEFAULT_SECURITY_SETTINGS[key].description,
  }));

  const { error: seedError } = await serviceSupabase
    .from('settings')
    .upsert(seedRows, { onConflict: 'key' });

  if (seedError) {
    throw seedError;
  }

  return {
    settings: { ...DEFAULT_SECURITY_SETTINGS },
    seeded: true,
  };
}

async function persistSettingsTableFallback(
  serviceSupabase: Awaited<ReturnType<typeof requireSuperadminContext>>['serviceSupabase'],
  settingKey: string,
  settingValue: string,
  description: string | null | undefined,
) {
  const { data, error } = await serviceSupabase
    .from('settings')
    .upsert({
      key: settingKey,
      value: settingValue,
      description: description ?? DEFAULT_SECURITY_SETTINGS[settingKey]?.description ?? null,
    }, {
      onConflict: 'key'
    })
    .select('key, value, description')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function GET(_: NextRequest) {
  try {
    const { serviceSupabase } = await requireSuperadminContext();

    // Get all security settings
    const { data: settings, error } = await serviceSupabase
      .from('security_settings')
      .select('setting_key, setting_value, description')
      .eq('is_active', true)
      .order('setting_key');

    if (error) {
      if (isMissingSecuritySettingsTable(error)) {
        logger.warn('security_settings table missing; using settings table fallback');
        const fallback = await loadSettingsTableFallback(serviceSupabase);
        return NextResponse.json({
          success: true,
          settings: fallback.settings,
          fallback: false,
          storage: 'settings',
          seeded: fallback.seeded,
        });
      }

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const settingsObject = (settings || []).reduce((acc: Record<string, { value: string; description: string | null }>, setting: any) => {
      acc[String(setting.setting_key)] = {
        value: typeof setting.setting_value === 'string' ? setting.setting_value : String(setting.setting_value ?? ''),
        description: setting.description ?? null,
      };
      return acc;
    }, {} as Record<string, { value: string; description: string | null }>);

    const mergedSettings = SECURITY_SETTING_KEYS.reduce((acc, key) => {
      acc[key] = settingsObject[key] ?? DEFAULT_SECURITY_SETTINGS[key];
      return acc;
    }, {} as Record<string, { value: string; description: string | null }>);

    return NextResponse.json({
      success: true,
      settings: mergedSettings,
      fallback: false,
      storage: 'security_settings'
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
    const { user, role, serviceSupabase } = await requireSuperadminContext();

    const body = await request.json();
    const { setting_key, setting_value, description } = body;

    if (!setting_key || !setting_value) {
      return NextResponse.json(
        { error: 'setting_key and setting_value are required' },
        { status: 400 }
      );
    }

    let data: { setting_key?: string; key?: string; setting_value?: string; value?: string; description?: string | null } | null = null;

    const { data: primaryData, error } = await serviceSupabase
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
      if (isMissingSecuritySettingsTable(error)) {
        logger.warn('security_settings table missing on update attempt; writing to settings table instead');
        data = await persistSettingsTableFallback(serviceSupabase, setting_key, setting_value, description);
      } else {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else {
      data = primaryData;
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
      setting: data,
      fallback: false,
      storage: error ? 'settings' : 'security_settings'
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
