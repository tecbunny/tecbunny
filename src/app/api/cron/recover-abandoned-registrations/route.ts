import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { WhatsAppService } from '@/lib/whatsapp-service';
import { logger } from '@/lib/logger';

/**
 * Cron route to recover users who dropped off after OTP generation
 * Checks for records exactly ~2 hours old that haven't been verified
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const supabase = createServiceClient();
    const whatsapp = new WhatsAppService();

    // 1. Fetch unverified registration OTPs created between 2h and 2h 15m ago
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const twoHoursFifteenAgo = new Date(Date.now() - 2.25 * 60 * 60 * 1000);

    const { data: abandonedSessions, error } = await supabase
      .from('otp_verifications')
      .select('*')
      .eq('purpose', 'registration')
      .eq('verified', false)
      .gte('created_at', twoHoursFifteenAgo.toISOString())
      .lte('created_at', twoHoursAgo.toISOString());

    if (error) {
      logger.error('cron_otp_recovery_fetch_failed', { error });
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!abandonedSessions || abandonedSessions.length === 0) {
      return NextResponse.json({ success: true, processed: 0 });
    }

    const results = [];

    for (const session of abandonedSessions) {
      if (!session.phone) continue;

      // 2. Double check if this user eventually registered with another session
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('mobile', session.phone)
        .maybeSingle();

      if (existingUser) {
        // Mark session as stale/ignored since they managed to register
        continue;
      }

      // 3. Format WhatsApp Recovery Template (Infobip)
      const recoveryPayload = {
        templateName: 'registration_recovery_guest_1',
        templateData: {
          body: {
            placeholders: ['Friend', 'guest checkout']
          },
          buttons: [
            {
              type: 'URL',
              parameter: 'shop?mode=guest&ref=recovery'
            }
          ]
        },
        language: 'en_US'
      };

      try {
        await whatsapp.sendMessage(session.phone, recoveryPayload, 'template', true, 'securityAlerts');
        
        // 4. Update session to avoid double recovery
        await supabase
          .from('otp_verifications')
          .update({ 
            recovery_sent_at: new Date().toISOString(),
            metadata: { ...(session.metadata || {}), recovery: 'sent' }
          })
          .eq('id', session.id);

        results.push({ id: session.id, phone: session.phone });
      } catch (sendError: any) {
        logger.error('recovery_whatsapp_send_failed', { phone: session.phone, error: sendError.message });
      }
    }

    return NextResponse.json({ 
      success: true, 
      processed: results.length,
      recovered_ids: results.map(r => r.id)
    });

  } catch (error: any) {
    logger.error('cron_otp_recovery_unhandled_error', { error: error.message });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
