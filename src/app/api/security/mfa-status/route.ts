import { NextRequest, NextResponse } from 'next/server';

import { AdminAuthError, requireAdminContext } from '@/lib/auth/admin-guard';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const { serviceSupabase } = await requireAdminContext();

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId parameter is required' },
        { status: 400 }
      );
    }

    // Get MFA status for user
    const { data: mfaStatus, error } = await serviceSupabase
      .from('user_mfa_status')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // Not found error
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If no record exists, create one
    if (!mfaStatus) {
      const { data: newStatus, error: createError } = await serviceSupabase
        .from('user_mfa_status')
        .insert({ user_id: userId })
        .select()
        .single();

      if (createError) {
        return NextResponse.json({ error: createError.message }, { status: 500 });
      }

      const { error: auditError } = await serviceSupabase
        .from('security_audit_log')
        .insert({
          event_type: 'mfa_status_bootstrap',
          user_id: userId,
          event_data: {
            target_user_id: userId,
            created_by: 'system',
          },
          severity: 'low',
        });

      if (auditError) {
        logger.warn('Failed to record MFA bootstrap audit event', {
          error: auditError.message,
        });
      }

      return NextResponse.json({
        success: true,
        mfaStatus: newStatus
      });
    }

    return NextResponse.json({
      success: true,
      mfaStatus
    });

  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logger.error('Error fetching MFA status:', { error });
    return NextResponse.json(
      { error: 'Failed to fetch MFA status' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, role, serviceSupabase } = await requireAdminContext();

    const body = await request.json();
    const { 
      userId, 
      totpEnabled, 
      phoneEnabled, 
      webauthnEnabled, 
      backupCodesGenerated 
    } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // Update MFA status
    const updateFields: Record<string, unknown> = {};

    if (totpEnabled !== undefined) updateFields.totp_enabled = !!totpEnabled;
    if (phoneEnabled !== undefined) updateFields.phone_enabled = !!phoneEnabled;
    if (webauthnEnabled !== undefined) updateFields.webauthn_enabled = !!webauthnEnabled;
    if (backupCodesGenerated !== undefined) {
      updateFields.backup_codes_generated = !!backupCodesGenerated;
    }

    const upsertPayload = {
      user_id: userId,
      updated_at: new Date().toISOString(),
      ...updateFields,
    };

    const { data, error } = await serviceSupabase
      .from('user_mfa_status')
      .upsert(upsertPayload, {
        onConflict: 'user_id'
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log the MFA status change
    const { error: auditError } = await serviceSupabase
      .from('security_audit_log')
      .insert({
        event_type: 'mfa_status_updated',
        user_id: userId,
        event_data: {
          target_user_id: userId,
          updated_by: user.id,
          updated_by_role: role,
          changes: updateFields,
        },
        severity: 'medium'
      });

    if (auditError) {
      logger.warn('Failed to record MFA status audit event', {
        error: auditError.message,
      });
    }

    return NextResponse.json({
      success: true,
      mfaStatus: data
    });

  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logger.error('Error updating MFA status:', { error });
    return NextResponse.json(
      { error: 'Failed to update MFA status' },
      { status: 500 }
    );
  }
}
