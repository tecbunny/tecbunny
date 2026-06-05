import { WhatsAppService } from '../whatsapp-service';
import { logger } from '../logger';

export interface WhatsAppOTPConfig {
  baseUrl?: string;
  accessToken?: string;
  phoneNumberId?: string;
  businessName?: string;
}

export interface WhatsAppResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: string;
}

/**
 * WhatsApp OTP Service
 * Handles WhatsApp delivery for OTP verification as fallback option
 */
export class WhatsAppOTPService extends WhatsAppService {
  private businessName: string;

  constructor(config?: WhatsAppOTPConfig) {
    super();
    this.businessName = config?.businessName || 'Tecbunny Solutions';
  }

  /**
   * Send OTP via WhatsApp with formatted message
   */
  async sendOTP(phone: string, code: string, purpose: string = 'verification', userName?: string): Promise<WhatsAppResponse> {
    try {
      const purposeText = this.getPurposeText(purpose);
      const greeting = userName || 'Customer';
      
      const templateName = process.env.WHATSAPP_OTP_TEMPLATE_NAME || 'otp2';
      const language = process.env.WHATSAPP_OTP_TEMPLATE_LANGUAGE || 'en_US';
      const isInfobip = process.env.WHATSAPP_PROVIDER !== 'meta'; // Default to true (Infobip)

      logger.info('Sending WhatsApp OTP template:', { phone, purpose, templateName });

      let content: any;
      if (isInfobip) {
        content = {
          templateName,
          templateData: {
            body: {
              placeholders: [code]
            }
          },
          language
        };
        // Support custom placeholders if configured in env
        const rawPlaceholders = process.env.WHATSAPP_OTP_TEMPLATE_PLACEHOLDERS || process.env.INFOBIP_OTP_TEMPLATE_PLACEHOLDERS;
        if (rawPlaceholders) {
          content.templateData.body.placeholders = rawPlaceholders
            .split(',')
            .map((v: string) => v.trim())
            .filter(Boolean)
            .map((v: string) => v.replace(/\{code\}/g, code).replace(/\{name\}/g, greeting).replace(/\{purpose\}/g, purposeText));
        }
      } else {
        // Meta Cloud API template structure
        content = {
          name: templateName,
          language: {
            code: language
          },
          components: [
            {
              type: 'body',
              parameters: [
                {
                  type: 'text',
                  text: code
                }
              ]
            }
          ]
        };
        // Support custom placeholders for Meta
        const rawPlaceholders = process.env.WHATSAPP_OTP_TEMPLATE_PLACEHOLDERS;
        if (rawPlaceholders) {
          const params = rawPlaceholders
            .split(',')
            .map((v: string) => v.trim())
            .filter(Boolean)
            .map((v: string) => ({
              type: 'text',
              text: v.replace(/\{code\}/g, code).replace(/\{name\}/g, greeting).replace(/\{purpose\}/g, purposeText)
            }));
          if (params.length > 0) {
            content.components[0].parameters = params;
          }
        }
      }

      const result = await this.sendMessage(phone, content, 'template', isInfobip);
      
      return {
        success: true,
        messageId: result.messages?.[0]?.id,
        provider: isInfobip ? 'infobip-whatsapp' : 'meta-whatsapp'
      };

    } catch (error: any) {
      logger.error('WhatsApp OTP sending failed:', { error: error.message });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'WhatsApp sending failed',
        provider: 'whatsapp'
      };
    }
  }

  /**
   * Send OTP verification success message
   */
  async sendVerificationSuccess(phone: string, purpose: string, userName?: string): Promise<WhatsAppResponse> {
    try {
      const greeting = userName ? `Hi ${userName}! 👋` : 'Hello! 👋';
      const purposeText = this.getPurposeText(purpose);
      
      const message = `
${greeting}

✅ *Verification Successful*

Your ${purposeText} has been completed successfully.

${this.getSuccessFooter(purpose)}

_${this.businessName} Team_
      `.trim();

      const result = await this.sendMessage(phone, message);
      
      return {
        success: true,
        messageId: result.messages?.[0]?.id,
        provider: 'whatsapp'
      };

    } catch (error: any) {
      logger.error('WhatsApp success message failed:', { error: error.message });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'WhatsApp sending failed',
        provider: 'whatsapp'
      };
    }
  }

  /**
   * Send account locked notification (after too many failed attempts)
   */
  async sendAccountLockedNotification(phone: string, userName?: string): Promise<WhatsAppResponse> {
    try {
      const greeting = userName ? `Hi ${userName}` : 'Hello';
      
      const message = `
🔒 *Security Alert* - ${this.businessName}

${greeting},

Your account has been temporarily locked due to multiple failed verification attempts.

🔐 *What happened?*
Too many incorrect OTP codes were entered.

⏰ *Account Status:*
Locked for 30 minutes for security.

🆘 *Need Help?*
If this wasn't you, please contact our support team immediately:

📧 support@tecbunny.com
📞 +91 96041 36010

🛡️ *Security Tip:*
Never share your OTP codes with anyone.

_${this.businessName} Security Team_
      `.trim();

      const result = await this.sendMessage(phone, message);
      
      return {
        success: true,
        messageId: result.messages?.[0]?.id,
        provider: 'whatsapp'
      };

    } catch (error: any) {
      logger.error('WhatsApp account locked notification failed:', { error: error.message });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'WhatsApp sending failed',
        provider: 'whatsapp'
      };
    }
  }

  /**
   * Send suspicious activity alert
   */
  async sendSuspiciousActivityAlert(phone: string, activity: string, userName?: string): Promise<WhatsAppResponse> {
    try {
      const greeting = userName ? `Hi ${userName}` : 'Hello';
      
      const message = `
🚨 *Security Alert* - ${this.businessName}

${greeting},

We detected unusual activity on your account:
📍 ${activity}

🔐 *Immediate Actions Taken:*
• Account temporarily secured
• Additional verification required

✅ *If this was you:*
Please verify using the OTP sent to your registered email/phone.

❌ *If this wasn't you:*
1. Contact support immediately
2. Change your password
3. Review account activity

📞 *Emergency Support:*
+91 96041 36010 (24/7)

🛡️ Your security is our priority.

_${this.businessName} Security Team_
      `.trim();

      const result = await this.sendMessage(phone, message);
      
      return {
        success: true,
        messageId: result.messages?.[0]?.id,
        provider: 'whatsapp'
      };

    } catch (error: any) {
      logger.error('WhatsApp suspicious activity alert failed:', { error: error.message });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'WhatsApp sending failed',
        provider: 'whatsapp'
      };
    }
  }

  /**
   * Send welcome message with OTP for new registrations
   */
  async sendWelcomeOTP(phone: string, code: string, userName: string): Promise<WhatsAppResponse> {
    try {
      const message = `
🎉 *Welcome to ${this.businessName}!*

Hi ${userName}! 👋

Thank you for joining our family! To complete your registration, please verify your phone number with the code below:

🔐 *Verification Code:*
*${code}*

⏰ Valid for 5 minutes
🔒 Never share this code

🎯 *What's Next?*
• Complete verification
• Explore our products & services
• Enjoy member exclusive benefits
• Get personalized support

🆘 *Need Help?*
Our team is here to assist you!
📧 support@tecbunny.com
📞 +91 96041 36010

Welcome aboard! 🚀

_${this.businessName} Team_
      `.trim();

      const result = await this.sendMessage(phone, message);
      
      return {
        success: true,
        messageId: result.messages?.[0]?.id,
        provider: 'whatsapp'
      };

    } catch (error: any) {
      logger.error('WhatsApp welcome OTP failed:', { error: error.message });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'WhatsApp sending failed',
        provider: 'whatsapp'
      };
    }
  }

  /**
   * Send password reset OTP with security warnings
   */
  async sendPasswordResetOTP(phone: string, code: string, userName?: string): Promise<WhatsAppResponse> {
    try {
      const greeting = userName ? `Hi ${userName}` : 'Hello';
      
      const message = `
🔐 *Password Reset Request* - ${this.businessName}

${greeting},

We received a request to reset your password.

🔑 *Reset Code:*
*${code}*

⏰ Valid for 5 minutes only
🔒 Keep this code private

⚠️ *Security Notice:*
If you didn't request this reset, please:
1. Ignore this message
2. Secure your account
3. Contact support if concerned

📞 *Support:* +91 96041 36010
📧 *Email:* support@tecbunny.com

🛡️ *Security Tip:*
Never share your reset codes with anyone, including our staff.

_${this.businessName} Security Team_
      `.trim();

      const result = await this.sendMessage(phone, message);
      
      return {
        success: true,
        messageId: result.messages?.[0]?.id,
        provider: 'whatsapp'
      };

    } catch (error: any) {
      logger.error('WhatsApp password reset OTP failed:', { error: error.message });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'WhatsApp sending failed',
        provider: 'whatsapp'
      };
    }
  }

  /**
   * Send transaction OTP for order verification
   */
  async sendTransactionOTP(phone: string, code: string, orderDetails: {
    orderId?: string;
    amount?: number;
    items?: string[];
  }, userName?: string): Promise<WhatsAppResponse> {
    try {
      const greeting = userName ? `Hi ${userName}` : 'Hello';
      let orderInfo = '';
      
      if (orderDetails.orderId) {
        orderInfo += `\n📦 *Order:* ${orderDetails.orderId}`;
      }
      if (orderDetails.amount) {
        orderInfo += `\n💰 *Amount:* ₹${orderDetails.amount.toLocaleString('en-IN')}`;
      }
      if (orderDetails.items && orderDetails.items.length > 0) {
        orderInfo += `\n📋 *Items:* ${orderDetails.items.slice(0, 2).join(', ')}${orderDetails.items.length > 2 ? '...' : ''}`;
      }
      
      const message = `
💳 *Transaction Verification* - ${this.businessName}

${greeting},

Please verify your transaction with the code below:
${orderInfo}

🔐 *Verification Code:*
*${code}*

⏰ Valid for 5 minutes
🔒 Required to complete transaction

❌ *Didn't make this transaction?*
Contact us immediately:
📞 +91 96041 36010

🛡️ Your security is our priority.

_${this.businessName} Team_
      `.trim();

      const result = await this.sendMessage(phone, message);
      
      return {
        success: true,
        messageId: result.messages?.[0]?.id,
        provider: 'whatsapp'
      };

    } catch (error: any) {
      logger.error('WhatsApp transaction OTP failed:', { error: error.message });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'WhatsApp sending failed',
        provider: 'whatsapp'
      };
    }
  }

  /**
   * Create formatted OTP message
   */
  private createOTPMessage(code: string, purpose: string, userName?: string): string {
    const greeting = userName ? `Hi ${userName}! 👋` : 'Hello! 👋';
    const currentTime = new Date().toLocaleTimeString('en-IN', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
    
    return `
🔐 *${this.businessName}*

${greeting}

Your ${purpose} code is:

*${code}*

⏰ Valid for 5 minutes (sent at ${currentTime})
🔒 Keep this code private
❌ Never share with anyone

🆘 *Need Help?*
📞 +91 96041 36010
📧 support@tecbunny.com

_This is an automated security message_
    `.trim();
  }

  /**
   * Get user-friendly purpose text
   */
  private getPurposeText(purpose: string): string {
    const purposeMap: Record<string, string> = {
      'login': 'login verification',
      'registration': 'account verification',
      'password_reset': 'password reset',
      'transaction': 'transaction verification',
      'agent_order': 'order verification'
    };

    return purposeMap[purpose] || 'verification';
  }

  /**
   * Get success message footer based on purpose
   */
  private getSuccessFooter(purpose: string): string {
    const footerMap: Record<string, string> = {
      'login': '🎯 You can now access your account safely.',
      'registration': '🎉 Your account is now active! Start exploring our services.',
      'password_reset': '🔑 Your password has been updated successfully.',
      'transaction': '✅ Your transaction has been confirmed.',
      'agent_order': '📦 Your order has been verified and will be processed.'
    };

    return footerMap[purpose] || '✅ Verification completed successfully.';
  }

  /**
   * Send bulk OTP notifications (for agent teams, etc.)
   */
  async sendBulkOTP(recipients: Array<{phone: string; code: string; userName?: string}>, purpose: string): Promise<{
    success: boolean;
    results: Array<{ phone: string; success: boolean; messageId?: string; error?: string }>;
  }> {
    const results = [];

    for (const recipient of recipients) {
      try {
        const result = await this.sendOTP(recipient.phone, recipient.code, purpose, recipient.userName);
        results.push({
          phone: recipient.phone,
          success: result.success,
          messageId: result.messageId,
          error: result.error
        });
      } catch (error) {
        results.push({
          phone: recipient.phone,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    
    return {
      success: successCount > 0,
      results
    };
  }

  /**
   * Check if WhatsApp service is properly configured
   */
  async isConfigured(): Promise<boolean> {
    return !!(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
  }

  /**
   * Test WhatsApp configuration with a test message
   */
  async testConfiguration(testPhone: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!await this.isConfigured()) {
        return { success: false, error: 'WhatsApp API not configured' };
      }

      const testMessage = `🧪 *Test Message* - ${this.businessName}\n\nThis is a configuration test. Your WhatsApp OTP service is working correctly! ✅`;
      
      const result = await this.sendMessage(testPhone, testMessage);
      
      return {
        success: !!result.messages?.[0]?.id,
        error: !result.messages?.[0]?.id ? 'No message ID returned' : undefined
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Configuration test failed'
      };
    }
  }
}

// Export singleton instance
export const whatsappOTPService = new WhatsAppOTPService();

// Export the existing sendWhatsAppMessage function for backward compatibility
export async function sendWhatsAppMessage(phone: string, message: string): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  const cleanNumber = phone.replace(/[^\d]/g, '');
  const normalizedNumber = cleanNumber
    ? (cleanNumber.startsWith('91') ? cleanNumber : `91${cleanNumber}`)
    : '';

  if (!normalizedNumber) {
    return {
      success: false,
      error: 'Invalid recipient number'
    };
  }

  try {
    const result = await whatsappOTPService.sendMessage(normalizedNumber, message);
    return {
      success: true,
      messageId: result.messages?.[0]?.id
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'WhatsApp sending failed'
    };
  }
}