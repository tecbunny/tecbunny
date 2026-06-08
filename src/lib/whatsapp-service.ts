import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

import { logger } from './logger';
import { formatCurrency } from './utils';

const getSupabaseAdmin = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase admin environment variables are not configured');
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
};

const orderSchema = z.object({
  orderNumber: z.string().min(1),
  customerName: z.string().optional(),
});

const accountWelcomeSchema = z.object({
  customerName: z.string().min(1),
});

const paymentActionSchema = z.object({
  customerName: z.string().optional(),
  amount: z.string().min(1),
  orderNumber: z.string().min(1),
  paymentLink: z.string().url(),
});

const shipmentShippedSchema = z.object({
  customerName: z.string().optional(),
  orderNumber: z.string().min(1),
  carrier: z.string().min(1),
  trackingNumber: z.string().min(1),
  trackingLink: z.string().url().optional(),
});

const deliverySchema = z.object({
  orderNumber: z.string().min(1),
  customerName: z.string().optional(),
});

const paymentConfirmationSchema = z.object({
  customerName: z.string().optional(),
  amount: z.string().min(1),
  orderNumber: z.string().min(1),
});

const orderDelayedSchema = z.object({
  customerName: z.string().optional(),
  orderNumber: z.string().min(1),
});

const deliveryFailedSchema = z.object({
  customerName: z.string().optional(),
  orderNumber: z.string().min(1),
});

const deliveryConfirmationSchema = z.object({
  customerName: z.string().optional(),
  orderNumber: z.string().min(1),
});

const orderPickupSchema = z.object({
  customerName: z.string().optional(),
  orderNumber: z.string().min(1),
  pickupCode: z.string().min(1),
});

const paymentFailedSchema = z.object({
  customerName: z.string().optional(),
  amount: z.string().min(1),
  orderNumber: z.string().min(1),
});

const actionNeededSchema = z.object({
  customerName: z.string().optional(),
  orderNumber: z.string().min(1),
  actionLink: z.string().url(),
});

const accountStatementSchema = z.object({
  customerName: z.string().min(1),
  period: z.string().min(1),
});

const orderCancelledSchema = z.object({
  customerName: z.string().optional(),
  orderNumber: z.string().min(1),
  reason: z.string().min(1),
});

const orderUpdateSchema = z.object({
  orderNumber: z.string().min(1),
  status: z.string().min(1),
  trackingNumber: z.string().min(1).optional(),
  estimatedDelivery: z.string().min(1).optional(),
});

const shipmentSchema = z.object({
  orderNumber: z.string().min(1),
  customerName: z.string().optional(),
  trackingNumber: z.string().min(1),
  estimatedDelivery: z.string().optional(),
  orderUrl: z.string().url().optional(), // Dynamic part of URL button suffix? No, usually button URL is base + dynamic.
});

const paymentReminderSchema = z.object({
  orderNumber: z.string().min(1),
  amount: z.number().nonnegative(),
  paymentLink: z.string().url(),
});

const supportSchema = z.object({
  ticketNumber: z.string().min(1),
  issue: z.string().min(1),
  response: z.string().min(1),
});

const promoSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  discountCode: z.string().min(1).optional(),
  validUntil: z.string().min(1).optional(),
  link: z.string().url(),
});

const agentCommissionSchema = z.object({
  agentName: z.string().min(1),
  orderNumber: z.string().min(1),
  amount: z.string().min(1),
  nextTier: z.string().min(1).optional(),
  differenceToNextTier: z.string().min(1).optional(),
});

const cartReminderSchema = z.object({
  items: z.array(z.string()).min(1),
  total: z.number().nonnegative(),
  cartLink: z.string().url(),
});

// WhatsApp Business API service for TecBunny
export class WhatsAppService {
  private baseUrl: string;
  private accessToken: string;
  private phoneNumberId: string;

  constructor() {
    this.baseUrl = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v18.0';
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN || '';
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
  }

  async checkWhatsAppConsent(to: string, category: 'orderUpdates' | 'serviceUpdates' | 'securityAlerts' = 'orderUpdates'): Promise<boolean> {
    try {
      const cleanNumber = to.replace(/[^\d]/g, '');
      if (!cleanNumber) return false;

      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !key) {
        return true; // Default to true if not configured
      }
      
      const supabase = getSupabaseAdmin();
      
      const { data, error } = await supabase
        .from('user_communication_preferences')
        .select('*')
        .or(`phone.eq.${cleanNumber},phone.eq.+${cleanNumber},phone.eq.91${cleanNumber}`)
        .maybeSingle();

      if (error) {
        logger.error('Failed to query WhatsApp preferences for consent check:', { error: error.message, phone: cleanNumber });
        return true; 
      }

      if (!data) {
        return category === 'orderUpdates' || category === 'securityAlerts';
      }

      if (data.whatsappNotifications === false) {
        return false;
      }

      if (category === 'orderUpdates') return data.orderUpdates !== false;
      if (category === 'serviceUpdates') return data.serviceUpdates !== false;
      if (category === 'securityAlerts') return data.securityAlerts !== false;

      return false;
    } catch (err) {
      logger.error('Exception checking WhatsApp preferences:', { error: err });
      return true; 
    }
  }

  // Send WhatsApp notification
  async sendMessage(
    to: string, 
    message: any, 
    messageType: 'text' | 'template' = 'text', 
    isInfobip: boolean = true,
    category: 'orderUpdates' | 'serviceUpdates' | 'securityAlerts' = 'orderUpdates'
  ) {
    try {
      // Check user consent first before dispatching
      const consented = await this.checkWhatsAppConsent(to, category);
      if (!consented) {
        logger.info('WhatsApp message dispatch blocked by communication consent preferences', { to, category });
        return { success: false, reason: 'Consent denied by user preferences' };
      }

      // Clean phone number (remove +, spaces, etc.)
      const cleanNumber = to.replace(/[^\d]/g, '');
      const formattedNumber = cleanNumber.startsWith('91') ? cleanNumber : `91${cleanNumber}`;

      let url = `${this.baseUrl}/${this.phoneNumberId}/messages`;
      let payload: any;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (isInfobip) {
        // Infobip Configuration
        // Ensure baseUrl is set to Infobip base URL (e.g. https://xyz.api.infobip.com)
        // Ensure phoneNumberId is the 'from' number
        url = `${this.baseUrl}/whatsapp/1/message/template`;
        headers['Authorization'] = `App ${this.accessToken}`;
        
        payload = {
          messages: [
            {
              from: this.phoneNumberId,
              to: formattedNumber,
              content: messageType === 'text' ? { text: message } : message
            }
          ]
        };
      } else {
        // Meta/Cloud API Configuration
        headers['Authorization'] = `Bearer ${this.accessToken}`;
        payload = {
          messaging_product: 'whatsapp',
          to: formattedNumber,
          type: messageType,
          [messageType]: messageType === 'text' ? { body: message } : message
        };
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(`WhatsApp API error: ${result.error?.message || 'Unknown error'}`);
      }

      logger.info('WhatsApp message sent successfully:', {
        to: formattedNumber,
        messageId: result.messages?.[0]?.id
      });

      return result;
    } catch (error: any) {
      logger.error('Failed to send WhatsApp message:', { error: error.message });
      throw error;
    }
  }

  // Send welcome message template
  async sendWelcomeTemplate(to: string, data: z.infer<typeof accountWelcomeSchema>) {
    const { customerName } = data;
    const content = {
      templateName: 'account_welcome_1',
      templateData: {
        body: {
          placeholders: [customerName]
        }
      },
      language: 'en_US'
    };
    return this.sendMessage(to, content, 'template', true);
  }

  // Send agent commission notification
  async sendAgentCommissionNotification(to: string, data: z.infer<typeof agentCommissionSchema>) {
    const { agentName, orderNumber, amount, nextTier, differenceToNextTier } = data;
    
    let message = `🚀 Milestone Unlocked! \n\nHi ${agentName}, your referral order #${orderNumber} has cleared payment. A commission of ₹${amount} has been credited to your account.`;
    
    if (nextTier && differenceToNextTier) {
      message += `\n\nYou're just ₹${differenceToNextTier} away from the ${nextTier} tier! Keep going! 🐰`;
    }

    // For now, using text message if no specific template is approved yet
    return this.sendMessage(to, message, 'text', true, 'serviceUpdates');
  }

  // Send order confirmation (remains order_confirmation)
  async sendOrderConfirmation(to: string, orderData: z.infer<typeof orderSchema>) {
    const parsed = orderSchema.safeParse(orderData);
    if (!parsed.success) {
      logger.error('Invalid order data for WhatsApp confirmation', { issues: parsed.error.issues });
      throw new Error('Invalid order data');
    }

    const { orderNumber, customerName } = parsed.data;
    
    // Infobip Template Structure
    const content = {
      templateName: 'order_confirmation',
      templateData: {
        body: {
          placeholders: [
            customerName || 'Customer',
            orderNumber
          ]
        }
      },
      language: 'en_US'
    };

    return this.sendMessage(to, content, 'template', true);
  }

  // Send shipment confirmation (updated to shipment_shipped)
  async sendShipmentConfirmation(to: string, shipmentData: z.infer<typeof shipmentShippedSchema>) {
    const parsed = shipmentShippedSchema.safeParse(shipmentData);
    if (!parsed.success) {
      logger.error('Invalid shipment data for WhatsApp', { issues: parsed.error.issues });
      throw new Error('Invalid shipment data');
    }

    const { customerName, orderNumber, carrier, trackingNumber } = parsed.data;

    const content = {
      templateName: 'shipment_shipped',
      templateData: {
        body: {
          placeholders: [
            customerName || 'Customer',
            orderNumber,
            carrier,
            trackingNumber
          ]
        },
        buttons: [
          {
            type: 'URL',
            parameter: orderNumber
          }
        ]
      },
      language: 'en_US'
    };

    return this.sendMessage(to, content, 'template', true);
  }

  // Send out for delivery notification (shipment_out_for_delivery)
  async sendOutForDelivery(to: string, deliveryData: z.infer<typeof deliverySchema>) {
    const parsed = deliverySchema.safeParse(deliveryData);
    if (!parsed.success) {
      logger.error('Invalid delivery data for WhatsApp', { issues: parsed.error.issues });
      throw new Error('Invalid delivery data');
    }

    const { orderNumber, customerName } = parsed.data;

    const content = {
      templateName: 'shipment_out_for_delivery',
      templateData: {
        body: {
          placeholders: [
            customerName || 'Customer',
            orderNumber
          ]
        },
        buttons: [
          {
            type: 'URL',
            parameter: orderNumber
          }
        ]
      },
      language: 'en_US'
    };

    return this.sendMessage(to, content, 'template', true);
  }

  // Send payment confirmation (updated to payment_confirmed with params)
  async sendPaymentConfirmation(to: string, paymentData: z.infer<typeof paymentConfirmationSchema>) {
    const parsed = paymentConfirmationSchema.safeParse(paymentData);
    if (!parsed.success) {
      logger.error('Invalid payment data for WhatsApp', { issues: parsed.error.issues });
      throw new Error('Invalid payment data');
    }

    const { customerName, amount, orderNumber } = parsed.data;

    const content = {
      templateName: 'payment_confirmed',
      templateData: {
        body: {
          placeholders: [
            customerName || 'Customer',
            amount,
            orderNumber
          ]
        },
        buttons: [
          {
            type: 'URL',
            parameter: orderNumber
          }
        ]
      },
      language: 'en_US'
    };

    return this.sendMessage(to, content, 'template', true);
  }

  // Send payment action required (payment_action_pending)
  async sendPaymentActionRequired(to: string, data: z.infer<typeof paymentActionSchema>) {
    const parsed = paymentActionSchema.safeParse(data);
    if (!parsed.success) throw new Error('Invalid payment action data');
    const { customerName, amount, orderNumber, paymentLink } = parsed.data;
    
    const content = {
      templateName: 'payment_action_pending_1',
      templateData: {
        body: { placeholders: [customerName || 'Customer', amount, orderNumber, paymentLink] },
        buttons: [{ type: 'URL', parameter: orderNumber }]
      },
      language: 'en_US'
    };
    return this.sendMessage(to, content, 'template', true);
  }

  // Send order delayed (order_delayed)
  async sendOrderDelayed(to: string, data: z.infer<typeof orderDelayedSchema>) {
    const parsed = orderDelayedSchema.safeParse(data);
    if (!parsed.success) throw new Error('Invalid delayed data');
    const { customerName, orderNumber } = parsed.data;

    const content = {
      templateName: 'order_delayed',
      templateData: {
        body: { placeholders: [customerName || 'Customer', orderNumber] },
        buttons: [{ type: 'URL', parameter: orderNumber }]
      },
      language: 'en_US'
    };
    return this.sendMessage(to, content, 'template', true);
  }

  // Send delivery failed (delivery_failed)
  async sendDeliveryFailed(to: string, data: z.infer<typeof deliveryFailedSchema>) {
    const parsed = deliveryFailedSchema.safeParse(data);
    if (!parsed.success) throw new Error('Invalid delivery failed data');
    const { customerName, orderNumber } = parsed.data;

    const content = {
      templateName: 'delivery_failed',
      templateData: {
        body: { placeholders: [customerName || 'Customer', orderNumber] },
        buttons: [{ type: 'URL', parameter: orderNumber }]
      },
      language: 'en_US'
    };
    return this.sendMessage(to, content, 'template', true);
  }

  // Send delivery confirmation (shipment_delivered)
  async sendDeliveryConfirmation(to: string, data: z.infer<typeof deliveryConfirmationSchema>) {
    const parsed = deliveryConfirmationSchema.safeParse(data);
    if (!parsed.success) throw new Error('Invalid delivery confirmation data');
    const { customerName, orderNumber } = parsed.data;

    const content = {
      templateName: 'shipment_delivered',
      templateData: {
        body: { placeholders: [customerName || 'Customer', orderNumber] },
        buttons: [{ type: 'URL', parameter: orderNumber }]
      },
      language: 'en_US'
    };
    return this.sendMessage(to, content, 'template', true);
  }

  // Send order pickup ready (order_ready_pickup + pickup_authorization)
  async sendOrderPickupReady(to: string, data: z.infer<typeof orderPickupSchema>) {
    const parsed = orderPickupSchema.safeParse(data);
    if (!parsed.success) throw new Error('Invalid pickup data');
    const { customerName, orderNumber, pickupCode } = parsed.data;

    // 1. Send generic "Ready for Pickup" message
    const readyContent = {
      templateName: 'order_ready_pickup',
      templateData: {
        body: { placeholders: [customerName || 'Customer', orderNumber] },
        buttons: [{ type: 'URL', parameter: orderNumber }]
      },
      language: 'en_US'
    };
    
    // Send first message
    await this.sendMessage(to, readyContent, 'template', true);

    // 2. Skip sending Code via WhatsApp (Show on website only)
    logger.info('Order pickup ready sent, skipping WhatsApp OTP code (available on website only):', { to, orderNumber });
    return { success: true };
  }

  // Send payment failed (payment_failed)
  async sendPaymentFailed(to: string, data: z.infer<typeof paymentFailedSchema>) {
    const parsed = paymentFailedSchema.safeParse(data);
    if (!parsed.success) throw new Error('Invalid payment failed data');
    const { customerName, amount, orderNumber } = parsed.data;

    const content = {
      templateName: 'payment_failed',
      templateData: {
        body: { placeholders: [customerName || 'Customer', amount, orderNumber] },
         buttons: [{ type: 'URL', parameter: orderNumber }]
      },
      language: 'en_US'
    };
    return this.sendMessage(to, content, 'template', true);
  }

  // Send order action needed (order_action_needed)
  async sendOrderActionNeeded(to: string, data: z.infer<typeof actionNeededSchema>) {
    const parsed = actionNeededSchema.safeParse(data);
    if (!parsed.success) throw new Error('Invalid action needed data');
    const { customerName, orderNumber, actionLink } = parsed.data;

    const content = {
      templateName: 'order_action_needed',
      templateData: {
        body: { placeholders: [customerName || 'Customer', orderNumber, actionLink] },
        buttons: [{ type: 'URL', parameter: orderNumber }]
      },
      language: 'en_US'
    };
    return this.sendMessage(to, content, 'template', true);
  }

  // Send order cancelled (order_cancelled)
  async sendOrderCancelled(to: string, data: z.infer<typeof orderCancelledSchema>) {
    const parsed = orderCancelledSchema.safeParse(data);
    if (!parsed.success) throw new Error('Invalid cancellation data');
    const { customerName, orderNumber, reason } = parsed.data;

    const content = {
      templateName: 'order_cancelled',
      templateData: {
        body: { placeholders: [customerName || 'Customer', orderNumber, reason] },
        buttons: [{ type: 'URL', parameter: orderNumber }]
      },
      language: 'en_US'
    };
    return this.sendMessage(to, content, 'template', true);
  }

  // Send order status update
  async sendOrderUpdate(to: string, orderData: z.infer<typeof orderUpdateSchema>) {
    const parsed = orderUpdateSchema.safeParse(orderData);
    if (!parsed.success) {
      logger.error('Invalid order data for WhatsApp update', { issues: parsed.error.issues });
      throw new Error('Invalid order update data');
    }

    const { orderNumber, status } = parsed.data;
    const message = `
🔔 Order Update

Order #${orderNumber} is now: ${status}

Track: https://tecbunny.com/orders/${orderNumber}
    `.trim();

    return this.sendMessage(to, message);
  }

  // Send payment reminder
  async sendPaymentReminder(to: string, orderData: z.infer<typeof paymentReminderSchema>) {
    const parsed = paymentReminderSchema.safeParse(orderData);
    if (!parsed.success) {
      logger.error('Invalid order data for WhatsApp payment reminder', { issues: parsed.error.issues });
      throw new Error('Invalid payment reminder data');
    }

    const { orderNumber, amount, paymentLink } = parsed.data;
    const message = `
💳 Payment Reminder - TecBunny Store

Order #: ${orderNumber}
Amount Due: ${formatCurrency(amount)}

Please complete your payment to process the order:
${paymentLink}

Questions? Reply to this message.
    `.trim();

    return this.sendMessage(to, message);
  }

  // Send support message
  async sendSupportMessage(to: string, supportData: z.infer<typeof supportSchema>) {
    const parsed = supportSchema.safeParse(supportData);
    if (!parsed.success) {
      logger.error('Invalid support data for WhatsApp message', { issues: parsed.error.issues });
      throw new Error('Invalid support data');
    }

    const { ticketNumber, issue, response } = parsed.data;
    const message = `
🛠️ Support Update - TecBunny Store

Ticket #: ${ticketNumber}
Issue: ${issue}

Response:
${response}

Need more help? Reply to this message.
    `.trim();

    return this.sendMessage(to, message);
  }

  // Send promotional message
  async sendPromotion(to: string, promoData: z.infer<typeof promoSchema>) {
    const parsed = promoSchema.safeParse(promoData);
    if (!parsed.success) {
      logger.error('Invalid promotion data for WhatsApp message', { issues: parsed.error.issues });
      throw new Error('Invalid promotion data');
    }

    const { title, description, discountCode, validUntil, link } = parsed.data;
    let message = `
🎉 ${title}

${description}
    `;

    if (discountCode) {
      message += `\n\n🎫 Code: ${discountCode}`;
    }

    if (validUntil) {
      message += `\n⏰ Valid until: ${validUntil}`;
    }

    message += `\n\n🛍️ Shop now: ${link}`;

    return this.sendMessage(to, message, 'text', true, 'serviceUpdates');
  }

  // Send cart abandonment reminder
  async sendCartReminder(to: string, cartData: z.infer<typeof cartReminderSchema>) {
    const parsed = cartReminderSchema.safeParse(cartData);
    if (!parsed.success) {
      logger.error('Invalid cart data for WhatsApp reminder', { issues: parsed.error.issues });
      throw new Error('Invalid cart data');
    }

    const { items, total, cartLink } = parsed.data;
    const message = `
🛒 Don't forget your TecBunny cart!

Items waiting for you:
${items.map((item) => `• ${item}`).join('\n')}

Total: ${formatCurrency(total)}

Complete your purchase:
${cartLink}

Need help? Just reply to this message! 💬
    `.trim();

    return this.sendMessage(to, message, 'text', true, 'serviceUpdates');
  }
}

// Export singleton instance
const whatsappService = new WhatsAppService();

// Convenience function for quick notifications
export async function sendWhatsAppNotification(to: string, message: string) {
  return whatsappService.sendMessage(to, message);
}

// Specific notification functions
export async function sendOrderNotification(to: string, orderData: z.infer<typeof orderSchema>) {
  return whatsappService.sendOrderConfirmation(to, orderData);
}

export async function sendWelcomeNotification(to: string, data: z.infer<typeof accountWelcomeSchema>) {
  return whatsappService.sendWelcomeTemplate(to, data);
}

export async function sendShipmentNotification(to: string, shipmentData: z.infer<typeof shipmentShippedSchema>) {
  return whatsappService.sendShipmentConfirmation(to, shipmentData);
}

export async function sendOutForDeliveryNotification(to: string, deliveryData: z.infer<typeof deliverySchema>) {
  return whatsappService.sendOutForDelivery(to, deliveryData);
}

export async function sendOrderStatusUpdate(to: string, orderData: z.infer<typeof orderUpdateSchema>) {
  return whatsappService.sendOrderUpdate(to, orderData);
}

export async function sendPaymentReminder(to: string, orderData: z.infer<typeof paymentReminderSchema>) {
  return whatsappService.sendPaymentReminder(to, orderData);
}

export async function sendSupportNotification(to: string, supportData: z.infer<typeof supportSchema>) {
  return whatsappService.sendSupportMessage(to, supportData);
}

export async function sendPromotionalMessage(to: string, promoData: z.infer<typeof promoSchema>) {
  return whatsappService.sendPromotion(to, promoData);
}

export async function sendCartAbandonmentReminder(to: string, cartData: z.infer<typeof cartReminderSchema>) {
  return whatsappService.sendCartReminder(to, cartData);
}

export async function sendPaymentConfirmationNotification(to: string, paymentData: z.infer<typeof paymentConfirmationSchema>) {
  return whatsappService.sendPaymentConfirmation(to, paymentData);
}

export async function sendOrderCancelled(to: string, data: z.infer<typeof orderCancelledSchema>) {
  return whatsappService.sendOrderCancelled(to, data);
}

export async function sendOrderDelayed(to: string, data: z.infer<typeof orderDelayedSchema>) {
  return whatsappService.sendOrderDelayed(to, data);
}

export async function sendOrderActionNeeded(to: string, data: z.infer<typeof actionNeededSchema>) {
  return whatsappService.sendOrderActionNeeded(to, data);
}

export async function sendOrderPickupReady(to: string, data: z.infer<typeof orderPickupSchema>) {
  return whatsappService.sendOrderPickupReady(to, data);
}

export async function sendPaymentActionRequired(to: string, data: z.infer<typeof paymentActionSchema>) {
  return whatsappService.sendPaymentActionRequired(to, data);
}

export async function sendDeliveryConfirmation(to: string, data: z.infer<typeof deliveryConfirmationSchema>) {
  return whatsappService.sendDeliveryConfirmation(to, data);
}

export default whatsappService;
