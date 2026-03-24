import https from 'https';

import { logger, LogMeta } from './logger';

// Superfone WhatsApp API Configuration
const SUPERFONE_BASE_HOST = process.env.SUPERFONE_BASE_HOST || 'prod-api.superfone.co.in';
const SUPERFONE_BASE_PATH = process.env.SUPERFONE_WHATSAPP_BASE_PATH || '/superfone/api/dragonfly/whatsapp';
const SUPERFONE_TIMEOUT = Number(process.env.SUPERFONE_TIMEOUT || 30000);

function getSuperfoneCredentials() {
  const apiKey = process.env.SUPERFONE_API_KEY;
  const cookie = process.env.SUPERFONE_COOKIE;

  if (!apiKey || !cookie) {
    logger.error('Superfone credentials missing', {
      function: 'getSuperfoneCredentials',
      hasApiKey: !!apiKey,
      hasCookie: !!cookie
    });
    return null;
  }

  const cookieHeader = cookie.includes('connect.sid=') ? cookie : `connect.sid=${cookie}`;

  return { apiKey, cookie: cookieHeader };
}

function normalizeRecipient(recipient: string) {
  const digits = recipient.replace(/\D+/g, '');
  if (!digits) return '';
  if (digits.startsWith('91')) return digits;
  return `91${digits}`;
}

// WhatsApp Message Types
export interface WhatsAppTemplateMessage {
  templateName: string;
  language: string;
  recipient: string;
  components?: Array<{
    type: string;
    sub_type?: string;
    index?: number;
    parameters?: Array<{
      type: string;
      text: string;
    }>;
  }>;
}

export interface WhatsAppTextMessage {
  recipient: string;
  message: string;
}

export interface WhatsAppResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  data?: any;
}

/**
 * Send WhatsApp template message via Superfone Dragonfly API
 */
export async function sendWhatsAppTemplate(
  templateData: WhatsAppTemplateMessage
): Promise<WhatsAppResponse> {
  return new Promise((resolve) => {
    const logMeta: LogMeta = {
      function: 'sendWhatsAppTemplate',
      templateName: templateData.templateName,
      recipient: templateData.recipient
    };

    const creds = getSuperfoneCredentials();
    const normalizedRecipient = normalizeRecipient(templateData.recipient);

    if (!creds || !normalizedRecipient) {
      resolve({
        success: false,
        error: !creds ? 'Superfone credentials not configured' : 'Invalid recipient number'
      });
      return;
    }

    const options = {
      method: 'POST',
      hostname: SUPERFONE_BASE_HOST,
      path: `${SUPERFONE_BASE_PATH}/messages`,
      headers: {
        'x-api-key': creds.apiKey,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
  'Cookie': creds.cookie
      },
      timeout: SUPERFONE_TIMEOUT
    };

    const postData = JSON.stringify({
      ...templateData,
      recipient: normalizedRecipient,
      type: 'template'
    });

    logger.info('Sending WhatsApp template message', { ...logMeta, templateData });

    const req = https.request(options, (res) => {
      const chunks: Buffer[] = [];

      res.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      res.on('end', () => {
        try {
          const body = Buffer.concat(chunks);
          const response = JSON.parse(body.toString());
          
          if (res.statusCode === 200 || res.statusCode === 201) {
            logger.info('WhatsApp template sent successfully', { 
              ...logMeta, 
              statusCode: res.statusCode,
              response 
            });
            
            resolve({
              success: true,
              messageId: response.messageId || response.id,
              data: response
            });
          } else {
            logger.error('WhatsApp template send failed', { 
              ...logMeta, 
              statusCode: res.statusCode,
              response 
            });
            
            resolve({
              success: false,
              error: response.message || `HTTP ${res.statusCode}`,
              data: response
            });
          }
        } catch (parseError: any) {
          logger.error('Failed to parse WhatsApp API response', { 
            ...logMeta, 
            error: parseError.message 
          });
          
          resolve({
            success: false,
            error: 'Invalid API response format'
          });
        }
      });
    });

    req.on('error', (error: any) => {
      logger.error('WhatsApp API request failed', { ...logMeta, error: error.message });
      resolve({
        success: false,
        error: error.message
      });
    });

    req.on('timeout', () => {
      logger.error('WhatsApp API request timeout', logMeta);
      req.destroy();
      resolve({
        success: false,
        error: 'Request timeout'
      });
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Send text message via WhatsApp (if supported by Superfone)
 */
export async function sendWhatsAppText(
  messageData: WhatsAppTextMessage
): Promise<WhatsAppResponse> {
  return new Promise((resolve) => {
    const logMeta: LogMeta = {
      function: 'sendWhatsAppText',
      recipient: messageData.recipient
    };

    const creds = getSuperfoneCredentials();
    const normalizedRecipient = normalizeRecipient(messageData.recipient);

    if (!creds || !normalizedRecipient) {
      resolve({
        success: false,
        error: !creds ? 'Superfone credentials not configured' : 'Invalid recipient number'
      });
      return;
    }

    const options = {
      method: 'POST',
      hostname: SUPERFONE_BASE_HOST,
      path: `${SUPERFONE_BASE_PATH}/messages`,
      headers: {
        'x-api-key': creds.apiKey,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
  'Cookie': creds.cookie
      },
      timeout: SUPERFONE_TIMEOUT
    };

const postData = JSON.stringify({
  recipient: normalizedRecipient,
  text: {
    body: messageData.message
  },
  type: 'text'
});    logger.info('Sending WhatsApp text message', logMeta);

    const req = https.request(options, (res) => {
      const chunks: Buffer[] = [];

      res.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      res.on('end', () => {
        try {
          const body = Buffer.concat(chunks);
          const response = JSON.parse(body.toString());
          
          if (res.statusCode === 200 || res.statusCode === 201) {
            logger.info('WhatsApp text sent successfully', { 
              ...logMeta, 
              statusCode: res.statusCode,
              response 
            });
            
            resolve({
              success: true,
              messageId: response.messageId || response.id,
              data: response
            });
          } else {
            logger.error('WhatsApp text send failed', { 
              ...logMeta, 
              statusCode: res.statusCode,
              response 
            });
            
            resolve({
              success: false,
              error: response.message || `HTTP ${res.statusCode}`,
              data: response
            });
          }
        } catch (parseError: any) {
          logger.error('Failed to parse WhatsApp API response', { 
            ...logMeta, 
            error: parseError.message 
          });
          
          resolve({
            success: false,
            error: 'Invalid API response format'
          });
        }
      });
    });

    req.on('error', (error: any) => {
      logger.error('WhatsApp API request failed', { ...logMeta, error: error.message });
      resolve({
        success: false,
        error: error.message
      });
    });

    req.on('timeout', () => {
      logger.error('WhatsApp API request timeout', logMeta);
      req.destroy();
      resolve({
        success: false,
        error: 'Request timeout'
      });
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Send welcome message to new customers
 */
export async function sendWelcomeTemplate(
  phoneNumber: string, 
  customerName?: string
): Promise<WhatsAppResponse> {
  return sendWhatsAppTemplate({
    templateName: 'welcome_customer',
    language: 'en',
    recipient: phoneNumber,
    components: customerName ? [
      {
        type: 'text',
        parameters: [
          {
            type: 'text',
            text: customerName
          }
        ]
      }
    ] : undefined
  });
}

/**
 * Send account creation confirmation template after first login
 */
export async function sendAccountCreationConfirmationTemplate(
  phoneNumber: string,
  customerName?: string,
  loginUrl?: string
): Promise<WhatsAppResponse> {
  const parameters = [customerName, loginUrl]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean)
    .map((text) => ({
      type: 'text',
      text,
    }));

  return sendWhatsAppTemplate({
    templateName: 'account_creation_confirmation_3',
    language: 'en',
    recipient: phoneNumber,
    components: parameters.length > 0
      ? [
          {
            type: 'text',
            parameters,
          }
        ]
      : undefined
  });
}

/**
 * Send order confirmation template
 */
export async function sendOrderConfirmationTemplate(
  phoneNumber: string,
  orderId: string,
  customerName?: string
): Promise<WhatsAppResponse> {
  return sendWhatsAppTemplate({
    templateName: 'order_confirmation',
    language: 'en',
    recipient: phoneNumber,
    components: [
      {
        type: 'text',
        parameters: [
          {
            type: 'text',
            text: customerName || 'Customer'
          },
          {
            type: 'text',
            text: orderId
          }
        ]
      }
    ]
  });
}

/**
 * Send in-store order confirmation template
 */
export async function sendInstoreOrderConfirmationTemplate(
  phoneNumber: string,
  customerName: string,
  orderType: string
): Promise<WhatsAppResponse> {
  return sendWhatsAppTemplate({
    templateName: 'instore_order_conf',
    language: 'en',
    recipient: phoneNumber,
    components: [
      {
        type: 'text',
        parameters: [
          {
            type: 'text',
            text: customerName
          },
          {
            type: 'text',
            text: orderType
          }
        ]
      }
    ]
  });
}

/**
 * Send dynamic URL template (from your example)
 */
export async function sendDynamicUrlTemplate(
  phoneNumber: string,
  customerFirstName: string
): Promise<WhatsAppResponse> {
  return sendWhatsAppTemplate({
    templateName: 'dynamic_urll',
    language: 'en',
    recipient: phoneNumber,
    components: [
      {
        type: 'button',
        sub_type: 'url',
        index: 0,
        parameters: [
          {
            type: 'text',
            text: customerFirstName
          }
        ]
      }
    ]
  });
}

/**
 * Send payment reminder template
 */
export async function sendPaymentReminderTemplate(
  phoneNumber: string,
  orderId: string,
  amount: string,
  customerName?: string
): Promise<WhatsAppResponse> {
  return sendWhatsAppTemplate({
    templateName: 'payment_reminder',
    language: 'en',
    recipient: phoneNumber,
    components: [
      {
        type: 'text',
        parameters: [
          {
            type: 'text',
            text: customerName || 'Customer'
          },
          {
            type: 'text',
            text: orderId
          },
          {
            type: 'text',
            text: amount
          }
        ]
      }
    ]
  });
}

/**
 * Send payment success template
 */
export async function sendPaymentSuccessTemplate(
  phoneNumber: string,
  amount: string,
  purpose: string
): Promise<WhatsAppResponse> {
  return sendWhatsAppTemplate({
    templateName: 'payment_success',
    language: 'en',
    recipient: phoneNumber,
    components: [
      {
        type: 'text',
        parameters: [
          {
            type: 'text',
            text: amount
          },
          {
            type: 'text',
            text: purpose
          }
        ]
      }
    ]
  });
}

/**
 * Send shipping notification template
 */
export async function sendShippingNotificationTemplate(
  phoneNumber: string,
  orderId: string,
  trackingId: string,
  customerName?: string
): Promise<WhatsAppResponse> {
  return sendWhatsAppTemplate({
    templateName: 'shipping_notification',
    language: 'en',
    recipient: phoneNumber,
    components: [
      {
        type: 'text',
        parameters: [
          {
            type: 'text',
            text: customerName || 'Customer'
          },
          {
            type: 'text',
            text: orderId
          },
          {
            type: 'text',
            text: trackingId
          }
        ]
      }
    ]
  });
}

/**
 * Test WhatsApp connectivity
 */
export async function testWhatsAppConnection(): Promise<WhatsAppResponse> {
  // Use a test template or simple message
  return sendWhatsAppTemplate({
    templateName: 'test_connection',
    language: 'en',
    recipient: '917545991999' // Test number from your example
  });
}

const superfoneWhatsappService = {
  sendWhatsAppTemplate,
  sendWhatsAppText,
  sendWelcomeTemplate,
  sendAccountCreationConfirmationTemplate,
  sendOrderConfirmationTemplate,
  sendInstoreOrderConfirmationTemplate,
  sendDynamicUrlTemplate,
  sendPaymentReminderTemplate,
  sendPaymentSuccessTemplate,
  sendShippingNotificationTemplate,
  testWhatsAppConnection
};

export default superfoneWhatsappService;
