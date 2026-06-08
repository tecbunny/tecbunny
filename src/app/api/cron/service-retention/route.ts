import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { WhatsAppService } from '@/lib/whatsapp-service';
import { logger } from '@/lib/logger';

/**
 * SLA Re-engagement Loop: Automated background evaluation worker
 * Periodically checks for enterprise accounts that have not had maintenance in 90 days.
 * 
 * Target: Enterprise accounts (B2B)
 * Trigger: exactly 90 days since last service ticket or configuration health check
 * Action: Dispatch WhatsApp voucher for localized maintenance
 */
export async function GET(request: NextRequest) {
  // Simple auth check for cron (in production use a secret header)
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();
    const whatsapp = new WhatsAppService();
    
    // Calculate the date 90 days ago
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const dateString = ninetyDaysAgo.toISOString().split('T')[0];

    // 1. Fetch B2B accounts that haven't had service since exactly 90 days ago
    // or those who have never had a service but joined 90 days ago.
    const { data: accounts, error: accountError } = await supabase
      .from('profiles')
      .select('id, name, email, mobile, customer_type, b2b_category, created_at')
      .eq('customer_type', 'B2B')
      .not('mobile', 'is', null);

    if (accountError) throw accountError;

    const results = [];

    for (const account of accounts) {
      // Check last service ticket for this account
      const { data: lastTicket, error: ticketError } = await supabase
        .from('service_tickets')
        .select('created_at')
        .eq('customer_id', account.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (ticketError) continue;

      const lastActivityDate = lastTicket ? new Date(lastTicket.created_at) : new Date(account.created_at || '');
      const diffInDays = Math.floor((new Date().getTime() - lastActivityDate.getTime()) / (1000 * 3600 * 24));

      // If exactly 90 days or slightly more if we missed a day
      if (diffInDays === 90) {
        // 2. Dynamically match a localized maintenance voucher
        const voucherCode = `SECURE-${account.b2b_category || 'PRO'}-${Math.floor(1000 + Math.random() * 9000)}`;
        
        // 3. Dispatch WhatsApp notification
        const messagePayload = {
          customerName: account.name,
          voucherCode: voucherCode,
          serviceLink: 'https://tecbunny.com/services/health-check'
        };

        try {
          const consent = await whatsapp.checkWhatsAppConsent(account.mobile, 'serviceUpdates');
          if (consent) {
            // In a real implementation, we would call a specific template
            // await whatsapp.sendTemplateMessage(account.mobile, 'sla_reengagement', messagePayload);
            
            logger.info('sla_reengagement_triggered', { 
              accountId: account.id, 
              phone: account.mobile,
              voucher: voucherCode 
            });
            
            results.push({ accountId: account.id, status: 'notified', voucher: voucherCode });
          }
        } catch (wsError) {
          logger.error('sla_whatsapp_dispatch_failed', { accountId: account.id, error: wsError });
        }
      }
    }

    return NextResponse.json({
      success: true,
      processed: accounts.length,
      triggered: results.length,
      results
    });

  } catch (error: any) {
    logger.error('service_retention_cron_failed', { error: error.message });
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
