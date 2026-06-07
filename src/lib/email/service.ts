import nodemailer from 'nodemailer';

import { resolveSiteUrl } from '../site-url';
import { logger } from '../logger';

import type { EmailTemplateData, EmailTemplateType } from './types';
import { generateEmailTemplate } from './templates';

const formatOrderIdForDisplay = (orderData: any): string => {
  const candidate = orderData?.order_number
    || orderData?.orderNo
    || orderData?.order_no
    || orderData?.order_id
    || orderData?.orderRef
    || orderData?.orderref
    || orderData?.reference
    || orderData?.id;

  if (!candidate) {
    return 'UNKNOWN';
  }

  const idText = String(candidate).trim();
  if (!idText) {
    return 'UNKNOWN';
  }

  return idText;
};

export interface EmailServiceConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: {
    name: string;
    email: string;
  };
}

export class EmailService {
  private transporter: nodemailer.Transporter;
  private config: EmailServiceConfig;

  constructor(config: EmailServiceConfig) {
    this.config = config;
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
      tls: {
        rejectUnauthorized: process.env.NODE_ENV === 'production'
          ? true
          : process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false'
      }
    });
  }

  /**
   * Verify email service connection
   */
  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      logger.info('Email service connection verified');
      return true;
    } catch (error) {
      logger.error('Email service connection failed', { error });
      return false;
    }
  }

  /**
   * Send email using template
   */
  async sendTemplateEmail(
    to: string | string[],
    templateType: EmailTemplateType,
    templateData: EmailTemplateData,
    options?: {
      cc?: string | string[];
      bcc?: string | string[];
      replyTo?: string;
      priority?: 'high' | 'normal' | 'low';
    }
  ): Promise<boolean> {
    try {
      const template = generateEmailTemplate(templateType, templateData);
      
      const mailOptions = {
        from: { name: this.config.from.name, address: this.config.from.email },
        to: Array.isArray(to) ? to.join(', ') : to,
        cc: options?.cc ? (Array.isArray(options.cc) ? options.cc.join(', ') : options.cc) : undefined,
        bcc: options?.bcc ? (Array.isArray(options.bcc) ? options.bcc.join(', ') : options.bcc) : undefined,
        replyTo: options?.replyTo || this.config.from.email,
        subject: template.subject,
        text: template.text,
        html: template.html,
        priority: options?.priority || 'normal'
      };

      const result = await this.transporter.sendMail(mailOptions);
      logger.info('Email sent successfully', { templateType, to, messageId: result.messageId });
      
      return true;
    } catch (error) {
      logger.error('Failed to send email', { templateType, error });
      return false;
    }
  }

  /**
   * Send custom email
   */
  async sendCustomEmail(
    to: string | string[],
    subject: string,
    html: string,
    text?: string,
    options?: {
      cc?: string | string[];
      bcc?: string | string[];
      replyTo?: string;
      attachments?: Array<{
        filename: string;
        content: Buffer | string;
        contentType?: string;
      }>;
    }
  ): Promise<boolean> {
    try {
      const mailOptions = {
        from: { name: this.config.from.name, address: this.config.from.email },
        to: Array.isArray(to) ? to.join(', ') : to,
        cc: options?.cc ? (Array.isArray(options.cc) ? options.cc.join(', ') : options.cc) : undefined,
        bcc: options?.bcc ? (Array.isArray(options.bcc) ? options.bcc.join(', ') : options.bcc) : undefined,
        replyTo: options?.replyTo || this.config.from.email,
        subject,
        text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML if no text provided
        html,
        attachments: options?.attachments
      };

      const result = await this.transporter.sendMail(mailOptions);
      logger.info('Custom email sent successfully', { to, messageId: result.messageId });
      
      return true;
    } catch (error) {
      logger.error('Failed to send custom email', { error });
      return false;
    }
  }

  /**
   * Send bulk emails (with rate limiting)
   */
  async sendBulkEmails(
    emails: Array<{
      to: string;
      templateType: EmailTemplateType;
      templateData: EmailTemplateData;
    }>,
    options?: {
      batchSize?: number;
      delayBetweenBatches?: number; // milliseconds
    }
  ): Promise<{ success: number; failed: number; results: Array<{ email: string; success: boolean; error?: string }> }> {
    const batchSize = options?.batchSize || 10;
    const delay = options?.delayBetweenBatches || 1000;
    
    const results: Array<{ email: string; success: boolean; error?: string }> = [];
    let success = 0;
    let failed = 0;

    // Process emails in batches
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      
      // Process batch concurrently
      const batchPromises = batch.map(async (emailData) => {
        try {
          const sent = await this.sendTemplateEmail(
            emailData.to,
            emailData.templateType,
            emailData.templateData
          );
          
          if (sent) {
            success++;
            results.push({ email: emailData.to, success: true });
          } else {
            failed++;
            results.push({ email: emailData.to, success: false, error: 'Send failed' });
          }
        } catch (error) {
          failed++;
          results.push({ 
            email: emailData.to, 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      });

      await Promise.all(batchPromises);
      
      // Delay between batches (except for the last batch)
      if (i + batchSize < emails.length) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    logger.info('Bulk email results', { success, failed });
    
    return { success, failed, results };
  }
}

// Create email service instance
export function createEmailService(): EmailService {
  const config: EmailServiceConfig = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || ''
    },
    from: {
      name: process.env.SMTP_FROM_NAME || 'TecBunny Solutions',
      email: process.env.SMTP_FROM || 'noreply@tecbunny.com'
    }
  };

  return new EmailService(config);
}

// Convenience functions for common email types
export const emailHelpers = {
  async sendEmailVerification(to: string, userName: string, otp: string) {
    const emailService = createEmailService();
    return emailService.sendTemplateEmail(to, 'email_otp_verification', {
      userName,
      userEmail: to,
      otp,
      otpExpiryMinutes: 10
    });
  },

  async sendWelcomeEmail(to: string, userName: string) {
    // Use improved email service instead of old one
    const improvedEmailService = (await import('../improved-email-service')).default;
    
    const subject = `Welcome to TecBunny Store!`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Welcome to TecBunny Store</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #667eea; color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; background: #f9f9f9; }
          .features { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Welcome to TecBunny Store!</h1>
          </div>
          <div class="content">
            <h2>Hello ${userName}!</h2>
            <p>Thank you for joining TecBunny Store. We're excited to have you as part of our community!</p>
            
            <div class="features">
              <h3>What's Next?</h3>
              <ul>
                <li>🛍️ Browse our latest products and offers</li>
                <li>💰 Get exclusive member discounts</li>
                <li>📦 Track your orders in real-time</li>
                <li>🎁 Enjoy special promotions and deals</li>
              </ul>
            </div>
            
            <p style="text-align: center;">
              <a href="${resolveSiteUrl()}/products" class="button">Start Shopping</a>
            </p>
            
            <p>If you have any questions, feel free to contact our support team at support@tecbunny.com</p>
          </div>
          <div class="footer">
            <p>Welcome aboard!</p>
            <p>The TecBunny Store Team</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const result = await improvedEmailService.sendEmail({
      to,
      subject,
      html,
  text: `Welcome to TecBunny Store!\n\nHello ${userName}!\n\nThank you for joining TecBunny Store. We're excited to have you as part of our community!\n\nStart shopping: ${resolveSiteUrl()}/products\n\nContact us: support@tecbunny.com\n\nWelcome aboard!\nThe TecBunny Store Team`
    });
    
    return result.success;
  },

  async sendOrderConfirmation(to: string, orderData: any) {
    // Use improved email service instead of old one
    const improvedEmailService = (await import('../improved-email-service')).default;
    const displayOrderId = formatOrderIdForDisplay(orderData);
    const subject = `Order Confirmation #${displayOrderId} - TecBunny Store`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Order Confirmation</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #667eea; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .order-details { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .footer { text-align: center; padding: 20px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Order Confirmed!</h1>
          </div>
          <div class="content">
            <h2>Thank you, ${orderData.customer_name || 'Valued Customer'}!</h2>
            <p>Your order has been successfully placed and confirmed.</p>
            
            <div class="order-details">
              <h3>Order Details:</h3>
              <p><strong>Order ID:</strong> #${displayOrderId}</p>
              <p><strong>Order Date:</strong> ${new Date(orderData.created_at).toLocaleDateString()}</p>
              <p><strong>Total Amount:</strong> ₹${orderData.total}</p>
              ${orderData.delivery_address ? `<p><strong>Delivery Address:</strong><br>${orderData.delivery_address}</p>` : ''}
            </div>
            
            <p>You will receive updates about your order status via email.</p>
            <p>Track your order: <a href="${resolveSiteUrl()}/orders/${orderData.id}">View Order Status</a></p>
          </div>
          <div class="footer">
            <p>Thank you for choosing TecBunny Store!</p>
            <p>Contact us: support@tecbunny.com</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const result = await improvedEmailService.sendEmail({
      to,
      subject,
      html,
      text: `Order Confirmation #${displayOrderId}\n\nThank you ${orderData.customer_name || 'Valued Customer'}!\n\nYour order has been successfully placed.\nOrder ID: #${displayOrderId}\nTotal: ₹${orderData.total}\n\nThank you for choosing TecBunny Store!`
    });
    
    return result.success;
  },

  async sendAdminOrderNotification(recipients: string | string[], orderData: any) {
    const improvedEmailService = (await import('../improved-email-service')).default;
    const emails = (Array.isArray(recipients) ? recipients : [recipients])
      .map(email => email?.trim())
      .filter(email => email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) as string[];

    if (emails.length === 0) {
      logger.warn('sendAdminOrderNotification.skip_no_recipients');
      return false;
    }

    const toAmount = (value: unknown) => {
      const numeric = typeof value === 'number' ? value : Number(value ?? 0);
      return Number.isFinite(numeric) ? numeric : 0;
    };

    const orderItems: Array<{ name?: string; quantity?: number; price?: number }> = Array.isArray(orderData.items)
      ? orderData.items
      : [];

    const itemsHtml = orderItems.map(item => {
      const quantity = item.quantity ?? 1;
      const price = toAmount(item.price);
      const total = price * quantity;
      return `<tr><td style="padding:8px;border:1px solid #e5e7eb;">${item.name || 'Item'}</td><td style="padding:8px;border:1px solid #e5e7eb;text-align:center;">${quantity}</td><td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">₹${price.toFixed(2)}</td><td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">₹${total.toFixed(2)}</td></tr>`;
    }).join('');

    const totalsHtml = `
      <tr><td colspan="3" style="padding:8px;border:1px solid #e5e7eb;text-align:right;font-weight:600;">Subtotal</td><td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">₹${toAmount(orderData.subtotal ?? orderData.total).toFixed(2)}</td></tr>
      <tr><td colspan="3" style="padding:8px;border:1px solid #e5e7eb;text-align:right;font-weight:600;">GST</td><td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">₹${toAmount(orderData.gst_amount).toFixed(2)}</td></tr>
      ${orderData.discount_amount ? `<tr><td colspan="3" style="padding:8px;border:1px solid #e5e7eb;text-align:right;font-weight:600;">Discount</td><td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">-₹${toAmount(orderData.discount_amount).toFixed(2)}</td></tr>` : ''}
      ${orderData.shipping_amount ? `<tr><td colspan="3" style="padding:8px;border:1px solid #e5e7eb;text-align:right;font-weight:600;">Shipping</td><td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">₹${toAmount(orderData.shipping_amount).toFixed(2)}</td></tr>` : ''}
      <tr><td colspan="3" style="padding:8px;border:1px solid #e5e7eb;text-align:right;font-weight:700;">Total</td><td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">₹${toAmount(orderData.total).toFixed(2)}</td></tr>
    `;

    const subject = `New Order Received #${orderData.id}`;
    const orderPlacedAt = orderData.created_at ? new Date(orderData.created_at) : new Date();
    const orderTime = orderPlacedAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const orderLink = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.tecbunny.com'}/orders/${orderData.id}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>New Order Notification</title>
        <style>body{font-family:Arial,sans-serif;color:#111827;background:#f9fafb;padding:16px;}h1{color:#1f2937;}table{width:100%;border-collapse:collapse;margin-top:16px;background:white;}a.button{display:inline-block;padding:10px 18px;background:#2563eb;color:white;text-decoration:none;border-radius:6px;margin-top:16px;}p.meta{color:#4b5563;font-size:14px;margin:4px 0;}</style>
      </head>
      <body>
        <h1>New Order Received</h1>
        <p class="meta"><strong>Order ID:</strong> ${orderData.id}</p>
        <p class="meta"><strong>Placed At:</strong> ${orderTime}</p>
        <p class="meta"><strong>Customer:</strong> ${orderData.customer_name || 'Unknown'} (${orderData.customer_email || 'N/A'} • ${orderData.customer_phone || 'N/A'})</p>
        <p class="meta"><strong>Type:</strong> ${orderData.type || 'Delivery'}</p>
        ${orderData.delivery_address ? `<p class="meta"><strong>Delivery Address:</strong> ${orderData.delivery_address}</p>` : ''}
        <table>
          <thead>
            <tr><th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">Item</th><th style="padding:8px;border:1px solid #e5e7eb;text-align:center;">Qty</th><th style="padding:8px;border:1px solid #e5e7eb;text-align:right;">Price</th><th style="padding:8px;border:1px solid #e5e7eb;text-align:right;">Total</th></tr>
          </thead>
          <tbody>
            ${itemsHtml || '<tr><td colspan="4" style="padding:12px;border:1px solid #e5e7eb;text-align:center;color:#6b7280;">No items included</td></tr>'}
            ${totalsHtml}
          </tbody>
        </table>
        <p><a class="button" href="${orderLink}">View Order</a></p>
      </body>
      </html>
    `;

    const textItems = orderItems.map(item => {
      const quantity = item.quantity ?? 1;
      const price = toAmount(item.price);
      return `- ${item.name || 'Item'} x${quantity} @ ₹${price.toFixed(2)}`;
    }).join('\n');

    const text = [
      `New order received`,
      `Order ID: ${orderData.id}`,
      `Placed At: ${orderTime}`,
      `Customer: ${orderData.customer_name || 'Unknown'} (${orderData.customer_email || 'N/A'}, ${orderData.customer_phone || 'N/A'})`,
      `Type: ${orderData.type || 'Delivery'}`,
      orderData.delivery_address ? `Address: ${orderData.delivery_address}` : null,
      '',
      'Items:',
      textItems || 'No items provided',
      '',
      `Subtotal: ₹${toAmount(orderData.subtotal ?? orderData.total).toFixed(2)}`,
      `GST: ₹${toAmount(orderData.gst_amount).toFixed(2)}`,
      orderData.discount_amount ? `Discount: -₹${toAmount(orderData.discount_amount).toFixed(2)}` : null,
      orderData.shipping_amount ? `Shipping: ₹${toAmount(orderData.shipping_amount).toFixed(2)}` : null,
      `Total: ₹${toAmount(orderData.total).toFixed(2)}`,
      '',
      `View order: ${orderLink}`
    ].filter(Boolean).join('\n');

    const results = await Promise.all(emails.map(email => improvedEmailService.sendEmail({
      to: email,
      subject,
      html,
      text
    })));

    const success = results.some(result => result.success);
    if (!success) {
      logger.warn('sendAdminOrderNotification.failed', { emails });
    }
    return success;
  },

  async sendPaymentConfirmation(to: string, orderData: any, paymentData: any) {
    // Use improved email service instead of old one
    const improvedEmailService = (await import('../improved-email-service')).default;
    const displayOrderId = formatOrderIdForDisplay(orderData);
    const subject = `Payment Confirmed - Order #${displayOrderId} - TecBunny Store`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Payment Confirmation</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #28a745; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .payment-details { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .footer { text-align: center; padding: 20px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Payment Confirmed!</h1>
          </div>
          <div class="content">
            <h2>Thank you, ${orderData.customer_name || 'Valued Customer'}!</h2>
            <p>We have successfully received your payment for order #${displayOrderId}.</p>
            
            <div class="payment-details">
              <h3>Payment Details:</h3>
              <p><strong>Order ID:</strong> #${displayOrderId}</p>
              <p><strong>Amount Paid:</strong> ₹${orderData.total}</p>
              <p><strong>Payment Method:</strong> ${paymentData.method || 'Online'}</p>
              ${paymentData.transactionId ? `<p><strong>Transaction ID:</strong> ${paymentData.transactionId}</p>` : ''}
              <p><strong>Payment Date:</strong> ${new Date().toLocaleDateString()}</p>
            </div>
            
            <p>Your order is now being processed and you will receive shipping updates soon.</p>
            <p>Track your order: <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://tecbunny.com'}/orders/${orderData.id}">View Order Status</a></p>
          </div>
          <div class="footer">
            <p>Thank you for your business!</p>
            <p>Contact us: support@tecbunny.com</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const result = await improvedEmailService.sendEmail({
      to,
      subject,
      html,
      text: `Payment Confirmed - Order #${displayOrderId}\n\nThank you ${orderData.customer_name || 'Valued Customer'}!\n\nWe have received your payment of ₹${orderData.total}.\nPayment Method: ${paymentData.method || 'Online'}\n${paymentData.transactionId ? `Transaction ID: ${paymentData.transactionId}\n` : ''}\nThank you for your business!`
    });
    
    return result.success;
  },

  async sendShippingNotification(to: string, orderData: any, shippingData: any) {
    const emailService = createEmailService();
    return emailService.sendTemplateEmail(to, 'shipping_notification', {
      userName: orderData.customer_name,
      userEmail: to,
      orderId: orderData.id,
      trackingNumber: shippingData.trackingNumber,
      estimatedDelivery: shippingData.estimatedDelivery,
      deliveryAddress: orderData.delivery_address
    });
  },

  async sendPaymentFailed(to: string, orderData: any, paymentData: any) {
    const emailService = createEmailService();
    return emailService.sendTemplateEmail(to, 'payment_failed', {
      userName: orderData.customer_name,
      userEmail: to,
      orderId: orderData.id,
      orderTotal: orderData.total,
      paymentMethod: paymentData?.method,
      transactionId: paymentData?.transactionId
    });
  },

  async sendPaymentPending(to: string, orderData: any, paymentData: any) {
    const emailService = createEmailService();
    return emailService.sendTemplateEmail(to, 'payment_pending', {
      userName: orderData.customer_name,
      userEmail: to,
      orderId: orderData.id,
      orderTotal: orderData.total,
      paymentMethod: paymentData?.method,
      transactionId: paymentData?.transactionId
    });
  },

  async sendPickupNotification(to: string, orderData: any, pickupCode: string) {
    const emailService = createEmailService();
    return emailService.sendTemplateEmail(to, 'ready_for_pickup', {
      userName: orderData.customer_name,
      userEmail: to,
      orderId: orderData.id,
      pickupCode
    });
  },

  async sendOrderCompletion(to: string, orderData: any) {
    const emailService = createEmailService();
    return emailService.sendTemplateEmail(to, 'order_completed', {
      userName: orderData.customer_name,
      userEmail: to,
      orderId: orderData.id
    });
  },

  async sendOrderDelivered(to: string, orderData: any) {
    const emailService = createEmailService();
    return emailService.sendTemplateEmail(to, 'order_delivered', {
      userName: orderData.customer_name,
      userEmail: to,
      orderId: orderData.id
    });
  },

  async sendPasswordResetOTP(to: string, userName: string, otp: string) {
    const emailService = createEmailService();
    return emailService.sendTemplateEmail(to, 'password_reset_otp', {
      userName,
      userEmail: to,
      otp,
      otpExpiryMinutes: 10
    });
  },

  async sendEmailChangeOTP(to: string, userName: string, otp: string) {
    const emailService = createEmailService();
    return emailService.sendTemplateEmail(to, 'email_change_otp', {
      userName,
      userEmail: to,
      otp,
      otpExpiryMinutes: 10
    });
  }
  ,
  async sendMarketingCampaign(to: string | string[], data: EmailTemplateData) {
    const emailService = createEmailService();
    return emailService.sendTemplateEmail(to, 'marketing_campaign', data);
  },
  async sendAbandonedCartReminder(to: string, data: EmailTemplateData) {
    const emailService = createEmailService();
    return emailService.sendTemplateEmail(to, 'abandoned_cart', data);
  },
  async notifyManagerNewOrder(to: string | string[], data: EmailTemplateData) {
    const emailService = createEmailService();
    return emailService.sendTemplateEmail(to, 'order_notification_manager', data);
  },
  async notifySalesPickupOrder(to: string | string[], data: EmailTemplateData) {
    const emailService = createEmailService();
    return emailService.sendTemplateEmail(to, 'order_notification_sales_pickup', data);
  },
  async notifyAdminOrderApproved(to: string | string[], data: EmailTemplateData) {
    const emailService = createEmailService();
    return emailService.sendTemplateEmail(to, 'order_approved_admin', data);
  }
};
