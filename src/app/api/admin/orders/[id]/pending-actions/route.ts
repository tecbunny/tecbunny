import { NextRequest, NextResponse } from 'next/server';

import { createClient as createServerClient } from '@/lib/supabase/server';
import { uploadToSupabase } from '@/lib/supabase-storage';
import { logger } from '@/lib/logger';
import { sendPaymentActionRequired, sendPaymentConfirmationNotification, sendWhatsAppNotification } from '@/lib/whatsapp-service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Auth & role check
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const role = profile?.role ?? 'customer';
    if (role !== 'admin' && role !== 'superadmin' && role !== 'manager') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get content type to know if we parse JSON or form-data
    const contentType = request.headers.get('content-type') || '';
    let action = '';
    let invoiceUrl = '';
    let fileToUpload: File | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      action = (formData.get('action') as string) || 'upload_invoice';
      const file = formData.get('file');
      if (file && (file instanceof File)) {
        fileToUpload = file;
      }
    } else {
      const body = await request.json().catch(() => ({}));
      action = body.action || '';
      invoiceUrl = body.invoiceUrl || '';
    }

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    // Fetch the order
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const itemsPayload = typeof order.items === 'string'
      ? JSON.parse(order.items || '{}')
      : (order.items || {});

    // Action 1: request pending payment
    if (action === 'request_pending') {
      itemsPayload.pending_amount_requested = true;

      const { error: updateError } = await supabase
        .from('orders')
        .update({
          items: itemsPayload,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (updateError) {
        return NextResponse.json({ error: 'Failed to update order status' }, { status: 500 });
      }

      const remainingAmount = Number(order.total) - Number(itemsPayload.part_payment_amount || 0);
      const customerPhone = itemsPayload.customer_phone || order.customer_phone;
      if (customerPhone) {
        const cleanPhone = customerPhone.replace(/[^\d+]/g, '');
        const formattedPhone = cleanPhone.startsWith('+') ? cleanPhone : `+91${cleanPhone}`;
        
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://tecbunny.com';
        const paymentLink = `${siteUrl}/payment/upi/${id}`;

        try {
          await sendPaymentActionRequired(formattedPhone, {
            customerName: order.customer_name || 'Customer',
            amount: `INR ${remainingAmount.toFixed(2)}`,
            orderNumber: id,
            paymentLink
          });
        } catch (waErr: any) {
          logger.error('Failed to send WhatsApp pending request', { error: waErr.message, orderId: id });
        }
      }

      const customerEmail = itemsPayload.customer_email || order.customer_email;
      if (customerEmail) {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://tecbunny.com';
        const paymentLink = `${siteUrl}/payment/upi/${id}`;
        
        try {
          const improvedEmailService = (await import('@/lib/improved-email-service')).default;
          await improvedEmailService.sendEmail({
            to: customerEmail,
            subject: `Pending Balance Payment Request for Order #${id}`,
            html: `
              <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2>Pending Balance Payment Request</h2>
                <p>Dear ${order.customer_name || 'Customer'},</p>
                <p>This is a request to pay the remaining balance amount for your CCTV system installation order <strong>#${id}</strong>.</p>
                <div style="background: #f8f9fa; border: 1px solid #ddd; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <p style="margin: 5px 0;"><strong>Total Amount:</strong> ₹${Number(order.total).toFixed(2)}</p>
                  <p style="margin: 5px 0;"><strong>Part Amount Paid:</strong> ₹${Number(itemsPayload.part_payment_amount || 0).toFixed(2)}</p>
                  <p style="margin: 5px 0; color: #d9534f; font-size: 18px;"><strong>Remaining Balance:</strong> ₹${remainingAmount.toFixed(2)}</p>
                </div>
                <p>Please click the button below to pay the remaining balance amount online:</p>
                <p style="text-align: center; margin: 30px 0;">
                  <a href="${paymentLink}" style="background: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Pay Pending Balance Online</a>
                </p>
                <p>If you have any questions or have already paid via cash, please contact our support team.</p>
                <p>Best regards,<br/><strong>TecBunny Store Team</strong></p>
              </div>
            `
          });
        } catch (emailErr: any) {
          logger.error('Failed to send Email pending request', { error: emailErr.message, orderId: id });
        }
      }

      return NextResponse.json({ success: true, message: 'Payment request sent' });
    }

    // Action 2: accept cash payment
    if (action === 'accept_cash') {
      itemsPayload.pending_payment_status = 'paid';
      itemsPayload.pending_payment_method = 'cash';

      const { error: updateError } = await supabase
        .from('orders')
        .update({
          items: itemsPayload,
          payment_status: 'Fully Paid',
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (updateError) {
        return NextResponse.json({ error: 'Failed to update order to fully paid' }, { status: 500 });
      }

      const remainingAmount = Number(order.total) - Number(itemsPayload.part_payment_amount || 0);
      const customerPhone = itemsPayload.customer_phone || order.customer_phone;
      if (customerPhone) {
        const cleanPhone = customerPhone.replace(/[^\d+]/g, '');
        const formattedPhone = cleanPhone.startsWith('+') ? cleanPhone : `+91${cleanPhone}`;

        try {
          await sendPaymentConfirmationNotification(formattedPhone, {
            customerName: order.customer_name || 'Customer',
            amount: `INR ${remainingAmount.toFixed(2)} (Paid in Cash)`,
            orderNumber: id
          });
        } catch (waErr: any) {
          logger.error('Failed to send cash payment confirmation WhatsApp', { error: waErr.message, orderId: id });
        }
      }

      const customerEmail = itemsPayload.customer_email || order.customer_email;
      if (customerEmail) {
        try {
          const improvedEmailService = (await import('@/lib/improved-email-service')).default;
          await improvedEmailService.sendEmail({
            to: customerEmail,
            subject: `Payment Confirmed - Order #${id}`,
            html: `
              <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #28a745;">✅ Cash Payment Confirmed</h2>
                <p>Dear ${order.customer_name || 'Customer'},</p>
                <p>This is to confirm that we have received the remaining balance amount of <strong>₹${remainingAmount.toFixed(2)}</strong> by cash for your order <strong>#${id}</strong>.</p>
                <p>Your order is now fully paid! We will upload the final invoice and send it to you shortly.</p>
                <p>Thank you for choosing TecBunny!</p>
                <p>Best regards,<br/><strong>TecBunny Store Team</strong></p>
              </div>
            `
          });
        } catch (emailErr: any) {
          logger.error('Failed to send cash payment confirmation Email', { error: emailErr.message, orderId: id });
        }
      }

      return NextResponse.json({ success: true, message: 'Cash payment confirmed' });
    }

    // Action 3: upload invoice pdf
    if (action === 'upload_invoice') {
      if (fileToUpload) {
        const extension = fileToUpload.name.split('.').pop() || 'pdf';
        const fileName = `invoice-${id}-${Date.now()}.${extension}`;
        const uploadResult = await uploadToSupabase(fileToUpload, 'invoices', {
          publicAccess: true,
          fileName
        });
        invoiceUrl = uploadResult.url;
      }

      if (!invoiceUrl) {
        return NextResponse.json({ error: 'Invoice file or URL is required' }, { status: 400 });
      }

      itemsPayload.invoice_pdf_url = invoiceUrl;
      itemsPayload.pending_payment_status = 'paid';

      const { error: updateError } = await supabase
        .from('orders')
        .update({
          items: itemsPayload,
          payment_status: 'Fully Paid',
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (updateError) {
        return NextResponse.json({ error: 'Failed to save invoice URL' }, { status: 500 });
      }

      const customerEmail = itemsPayload.customer_email || order.customer_email;
      if (customerEmail) {
        try {
          const improvedEmailService = (await import('@/lib/improved-email-service')).default;
          await improvedEmailService.sendEmail({
            to: customerEmail,
            subject: `Invoice for your Order #${id} - TecBunny Store`,
            html: `
              <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2>Your Final Invoice is Ready!</h2>
                <p>Dear ${order.customer_name || 'Customer'},</p>
                <p>Thank you for completing the payment for your order <strong>#${id}</strong>.</p>
                <p>Your final invoice has been uploaded. You can view or download it by clicking the button below:</p>
                <p style="text-align: center; margin: 30px 0;">
                  <a href="${invoiceUrl}" style="background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;" target="_blank">View / Download Invoice PDF</a>
                </p>
                <p>If the button doesn't work, you can copy and paste the following link into your browser:</p>
                <p><a href="${invoiceUrl}">${invoiceUrl}</a></p>
                <p>We appreciate your business! Feel free to reach out to us for any warranty support or future requirements.</p>
                <p>Best regards,<br/><strong>TecBunny Store Team</strong></p>
              </div>
            `
          });
        } catch (emailErr: any) {
          logger.error('Failed to send invoice link Email', { error: emailErr.message, orderId: id });
        }
      }

      const customerPhone = itemsPayload.customer_phone || order.customer_phone;
      if (customerPhone) {
        const cleanPhone = customerPhone.replace(/[^\d+]/g, '');
        const formattedPhone = cleanPhone.startsWith('+') ? cleanPhone : `+91${cleanPhone}`;

        try {
          const messageText = `📄 Hello ${order.customer_name || 'Customer'}!\n\nYour final invoice for Order #${id} is now available. You can view or download it using the link below:\n\n🔗 Invoice Link: ${invoiceUrl}\n\nThank you for choosing TecBunny! 🚀`;
          await sendWhatsAppNotification(formattedPhone, messageText);
        } catch (waErr: any) {
          logger.error('Failed to send invoice WhatsApp', { error: waErr.message, orderId: id });
        }
      }

      return NextResponse.json({ success: true, invoiceUrl, message: 'Invoice uploaded and sent successfully' });
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });

  } catch (error: any) {
    logger.error('pending_actions_unhandled', { error: error.message });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
