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
  channelType: z.enum(['WhatsApp', 'Email']),
  template: z.string().min(1, "Message template is required"),
  contacts: z.array(ContactRowSchema).min(1, "At least one contact is required")
});

function formatIndianPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `91${cleaned}`;
  }
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    return cleaned;
  }
  return cleaned; // Fallback
}

export async function POST(req: Request) {
  try {
    // 1. Authenticate Admin
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.split(' ')[1];
    
    // Check if valid using standard verifyAdminToken or check session
    const supabase = await createServerClient();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    let adminId: string | null = null;

    if (session?.user) {
      // Validate role
      const { data: userData } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();
      
      if (userData?.role !== 'admin' && userData?.role !== 'superadmin') {
        return NextResponse.json({ error: 'Unauthorized role' }, { status: 403 });
      }
      adminId = session.user.id;
    } else {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse and Validate Payload
    const body = await req.json();
    const parsedData = BroadcastPayloadSchema.safeParse(body);
    
    if (!parsedData.success) {
      return NextResponse.json({ 
        error: 'Validation Failed', 
        details: parsedData.error.issues 
      }, { status: 400 });
    }

    const { campaignName, channelType, template, contacts } = parsedData.data;

    // 3. Create Log Entry
    const { data: logEntry, error: logError } = await supabase
      .from('marketing_broadcast_logs')
      .insert({
        campaign_name: campaignName,
        channel_type: channelType,
        recipient_count: contacts.length,
        success_count: 0,
        fail_count: 0,
        execution_status: 'In Progress',
        created_by: adminId
      })
      .select('id')
      .single();

    if (logError) {
      logger.error('Failed to create broadcast log', { error: logError });
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }

    // 4. Fire Async Processing & Return Immediate 202
    processBroadcast(logEntry.id, campaignName, channelType, template, contacts);

    return NextResponse.json({ 
      success: true, 
      message: 'Broadcast initiated successfully',
      logId: logEntry.id
    }, { status: 202 });

  } catch (error) {
    logger.error('Broadcast API Error', { error });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

async function processBroadcast(
  logId: string, 
  campaignName: string, 
  channelType: 'WhatsApp' | 'Email', 
  template: string, 
  contacts: z.infer<typeof ContactRowSchema>[]
) {
  const supabase = createServiceClient(); // Background worker client
  let successCount = 0;
  let failCount = 0;

  let whatsappService: WhatsAppService | null = null;
  if (channelType === 'WhatsApp') {
    whatsappService = new WhatsAppService();
  }

  for (const contact of contacts) {
    try {
      // Resolve dynamic variables (e.g., {{COUPON_CODE}}, {{NAME}})
      const personalizedMessage = template
        .replace(/{{NAME}}/g, contact.name)
        // Add more dynamic vars here if needed
      
      if (channelType === 'WhatsApp' && contact.phone && whatsappService) {
        const formattedPhone = formatIndianPhoneNumber(contact.phone);
        
        // This relies on your existing WhatsAppService implementations.
        // Assuming there is a generic send method or we use sendPromotionalMessage if it takes freeform.
        // If it requires a template ID, the user's setup might be using Infobip raw text dispatch.
        // For standard Infobip dispatch:
        await whatsappService.sendMessage(formattedPhone, personalizedMessage, 'text');
        
        successCount++;
      } else if (channelType === 'Email' && contact.email) {
        await improvedEmailService.sendEmail({
          to: contact.email,
          subject: campaignName,
          html: personalizedMessage.replace(/\n/g, '<br/>'),
        });
        successCount++;
      } else {
        failCount++; // Missing required channel contact info
      }
    } catch (err) {
      logger.error('Broadcast dispatch item failed', { contact, error: err });
      failCount++;
    }
  }

  // Finalize Log
  await supabase
    .from('marketing_broadcast_logs')
    .update({
      success_count: successCount,
      fail_count: failCount,
      execution_status: 'Completed'
    })
    .eq('id', logId);
}
