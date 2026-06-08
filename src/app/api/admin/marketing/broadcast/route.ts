import { NextResponse } from 'next/server';
import { z } from 'zod';
import { WhatsAppService } from '@/lib/whatsapp-service';
import improvedEmailService from '@/lib/improved-email-service';
import { createServerClient, createServiceClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

const ContactRowSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().optional(),
  email: z.string().email("Invalid email").optional()
});

const BroadcastPayloadSchema = z.object({
  campaignName: z.string().min(1, "Campaign Name is required"),
  channelType: z.enum(['whatsapp', 'email']),
  template: z.string().min(1, "Message template is required"),
  contacts: z.array(ContactRowSchema).min(1, "At least one contact is required")
});

function enforceIndianFormatting(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) return "91" + cleaned;
  if (cleaned.length === 12 && cleaned.startsWith('91')) return cleaned;
  throw new Error("Invalid phone length constraint: " + cleaned);
}

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Execution Context Unauthorized. Missing session token.' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();
      
    if (userData?.role !== 'admin' && userData?.role !== 'superadmin') {
      return NextResponse.json({ error: 'Execution Context Unauthorized. Insufficient privilege escalation.' }, { status: 403 });
    }

    const adminId = session.user.id;
    const body = await req.json();
    const parsedData = BroadcastPayloadSchema.safeParse(body);
    
    if (!parsedData.success) {
      return NextResponse.json({ error: 'Payload Validation Failed', details: parsedData.error.issues }, { status: 400 });
    }

    const { campaignName, channelType, template, contacts } = parsedData.data;

    const { data: logEntry, error: logError } = await supabase
      .from('marketing_broadcast_logs')
      .insert({
        campaign_name: campaignName,
        channel_type: channelType,
        recipient_count: contacts.length,
        success_count: 0,
        fail_count: 0,
        execution_status: 'PROCESSING',
        created_by: adminId
      })
      .select('id')
      .single();

    if (logError) {
      logger.error('Failed to create broadcast row', { error: logError });
      return NextResponse.json({ error: 'Database Retention Failure' }, { status: 500 });
    }

    processBatchDelivery(logEntry.id, campaignName, channelType, template, contacts);

    return NextResponse.json({ 
      success: true, 
      message: 'Batch pipeline initialized',
      logId: logEntry.id
    }, { status: 202 });

  } catch (error) {
    logger.error('Broadcast Execution Route Error', { error });
    return NextResponse.json({ error: 'Internal Server Fault' }, { status: 500 });
  }
}

async function processBatchDelivery(
  logId: string, 
  campaignName: string, 
  channelType: 'whatsapp' | 'email', 
  template: string, 
  contacts: z.infer<typeof ContactRowSchema>[]
) {
  const supabase = createServiceClient();
  let successCount = 0;
  let failCount = 0;
  const failureObjects: { id: string, reason: string }[] = [];

  let whatsappService: WhatsAppService | null = null;
  if (channelType === 'whatsapp') {
    whatsappService = new WhatsAppService();
  }

  for (const contact of contacts) {
    try {
      const resolvedMessage = template.replace(/{{NAME}}/g, contact.name);
      
      if (channelType === 'whatsapp' && contact.phone && whatsappService) {
        const formattedPhone = enforceIndianFormatting(contact.phone);
        await whatsappService.sendMessage(formattedPhone, resolvedMessage, 'text');
        successCount++;
      } else if (channelType === 'email' && contact.email) {
        await improvedEmailService.sendEmail({
          to: contact.email,
          subject: campaignName,
          html: resolvedMessage.replace(/\n/g, '<br/>'),
        });
        successCount++;
      } else {
        failCount++;
        failureObjects.push({ id: contact.name, reason: "Missing channel configuration requirements" });
      }
    } catch (e: any) {
      failCount++;
      failureObjects.push({ id: contact.name, reason: e.message || "Pipeline Transmission Failed" });
    }
  }

  await supabase
    .from('marketing_broadcast_logs')
    .update({
      success_count: successCount,
      fail_count: failCount,
      execution_status: 'COMPLETED',
      failure_summary: failureObjects.length ? JSON.stringify(failureObjects) : null
    })
    .eq('id', logId);
}
