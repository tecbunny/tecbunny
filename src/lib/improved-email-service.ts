import nodemailer from 'nodemailer';

import { logger } from './logger';
import { rateLimit } from './rate-limit';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  waitTime?: number;
}

class ImprovedEmailService {
  private transporter!: nodemailer.Transporter;
  private backupTransporter?: nodemailer.Transporter;
  private config: {
    from: string;
    fromName: string;
  };
  private lastSendTime: number = 0;
  private isMainServiceDown: boolean = false;
  private isBackupServiceDown: boolean = false;
  private lastMainServiceCheck: number = 0;
  private lastBackupServiceCheck: number = 0;

  constructor() {
    this.config = {
      from: process.env.SMTP_FROM || 'noreply@tecbunny.com',
      fromName: process.env.SMTP_FROM_NAME || 'TecBunny Store'
    };

    // Primary transporter (Gmail - verified working)
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      this.transporter = nodemailer.createTransport({
        host: (process.env.SMTP_HOST || 'smtp.gmail.com').trim().replace(/[\r\n]/g, ''),
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        tls: {
          // Hardened: Always reject unauthorized certificates to prevent MitM attacks
          rejectUnauthorized: true
        },
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
        rateLimit: 10,
      });
    } else {
  logger.warn('SMTP credentials missing; email sending disabled');
    }

    // Backup transporter (Outlook/Hotmail)
    if (process.env.BACKUP_SMTP_USER && process.env.BACKUP_SMTP_PASS) {
      this.backupTransporter = nodemailer.createTransport({
        host: (process.env.BACKUP_SMTP_HOST || 'smtp-mail.outlook.com').trim().replace(/[\r\n]/g, ''),
        port: parseInt(process.env.BACKUP_SMTP_PORT || '587'),
        secure: false,
        auth: {
          user: process.env.BACKUP_SMTP_USER,
          pass: process.env.BACKUP_SMTP_PASS,
        },
        tls: {
          // Hardened: Always reject unauthorized certificates to prevent MitM attacks
          rejectUnauthorized: true
        },
      });
    }

    this.verifyConnections();
  }

  private async verifyConnections() {
    try {
      if (!this.transporter) throw new Error('Primary transporter not configured');
  await this.transporter.verify();
  logger.info('Primary SMTP connection verified');
      this.isMainServiceDown = false;
    } catch (error) {
  logger.error('Primary SMTP connection failed', { error });
      this.isMainServiceDown = true;
    }

    // Test backup connection if available
    if (this.backupTransporter) {
      try {
  await this.backupTransporter.verify();
  logger.info('Backup SMTP connection verified');
        this.isBackupServiceDown = false;
      } catch (error) {
  logger.warn('Backup SMTP connection failed', { error });
        this.isBackupServiceDown = true;
      }
    }
  }

  public async getConnectionStatus() {
    await this.verifyConnections();
    
    return {
      primary: {
        status: this.isMainServiceDown ? 'down' : 'up',
        host: (process.env.SMTP_HOST || 'smtp.gmail.com').trim().replace(/[\r\n]/g, '')
      },
      backup: this.backupTransporter ? {
        status: this.isBackupServiceDown ? 'down' : 'up',
        host: (process.env.BACKUP_SMTP_HOST || 'smtp-mail.outlook.com').trim().replace(/[\r\n]/g, '')
      } : { status: 'not_configured' }
    };
  }

  private async checkRateLimit(email: string): Promise<{ 
    allowed: boolean; 
    message?: string; 
    waitTime?: number;
    resetCooldown?: boolean;
  }> {
    // In local development, skip rate limiting to avoid blocking iterative testing
    if (process.env.NODE_ENV !== 'production') {
      return { allowed: true };
    }

    // Unified rate limit: 10 emails per 1 hour per recipient
    const result = await rateLimit(`email_rl:${email}`, 10, 3600000);
    if (!result.allowed) {
      const waitMinutes = Math.ceil(((result.reset || 0) - Date.now()) / 60000);
      return {
        allowed: false,
        message: `Too many email requests. Please wait ${waitMinutes} minutes.`,
        waitTime: Math.ceil(((result.reset || 0) - Date.now()) / 1000)
      };
    }

    // Secondary burst limit: 2 emails per 1 minute
    const burstResult = await rateLimit(`email_burst:${email}`, 2, 60000);
    if (!burstResult.allowed) {
      return {
        allowed: false,
        message: 'Please wait a minute before requesting another email.',
        waitTime: 60
      };
    }

    return { allowed: true };
  }

  private async sendWithTransporter(
    transporter: nodemailer.Transporter, 
    options: EmailOptions,
    transporterName: string
  ): Promise<EmailResult> {
    try {
      // Ensure DMARC/SPF alignment: use SMTP_USER domain for From if different from desired business address
      const smtpUser = process.env.SMTP_USER || '';
      const desiredFrom = this.config.from;
      const getDomain = (addr: string) => (addr.split('@')[1] || '').toLowerCase();
      const fromDomain = getDomain(desiredFrom);
      const smtpDomain = getDomain(smtpUser);

      // If domains differ, send From as SMTP user (aligned) and set Reply-To to business address
      const useAlignedFrom = !!smtpUser && smtpDomain && fromDomain && smtpDomain !== fromDomain;
      const alignedFromAddress = useAlignedFrom ? smtpUser : desiredFrom;
      const replyToAddress = useAlignedFrom ? desiredFrom : undefined;

      const mailOptions: nodemailer.SendMailOptions = {
        from: `${this.config.fromName} <${alignedFromAddress}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || options.html.replace(/<[^>]*>/g, ''),
        replyTo: replyToAddress,
        headers: useAlignedFrom && smtpUser ? { Sender: smtpUser } : undefined,
      };

      logger.info('Sending email', {
        transporter: transporterName,
        to: options.to,
        subject: options.subject,
        replyTo: replyToAddress ?? null,
      });
      
      if (!transporter) {
        // Dev fallback: when SMTP isn't configured, allow local testing by logging the email
        if (process.env.NODE_ENV !== 'production') {
          logger.warn('Email transporter not configured; using development fallback');
          logger.debug('Dev email preview', {
            to: options.to,
            subject: options.subject,
            html: options.html,
            text: options.text ?? null,
          });
          return { success: true, messageId: 'dev-logged' };
        }
        throw new Error('Email transporter not configured');
      }
      const result = await transporter.sendMail(mailOptions);

      logger.info('Email sent successfully', {
        transporter: transporterName,
        messageId: result.messageId,
        accepted: result.accepted,
        rejected: result.rejected,
        pending: (result as any).pending,
        response: result.response,
      });

      return { success: true, messageId: result.messageId };
    } catch (error) {
      logger.error('Failed to send email', { transporter: transporterName, error });
      
      // Parse specific error messages
      let errorMessage = 'Failed to send email';
      if (error instanceof Error) {
        if (error.message.includes('rate limit') || error.message.includes('quota')) {
          errorMessage = 'Email service rate limit reached. Please try again later.';
        } else if (error.message.includes('authentication') || error.message.includes('auth')) {
          errorMessage = 'Email service authentication failed. Please contact support.';
        } else if (error.message.includes('network') || error.message.includes('connection')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        } else {
          errorMessage = error.message;
        }
      }
      
      return { success: false, error: errorMessage };
    }
  }

  async sendEmail(options: EmailOptions): Promise<EmailResult> {
    try {
      logger.info('sendEmail.start', { to: options.to, subject: options.subject });
      
      // Check rate limiting first
      const rateLimitCheck = await this.checkRateLimit(options.to);
      if (!rateLimitCheck.allowed) {
        logger.warn('sendEmail.rate_limited', { to: options.to, waitTime: rateLimitCheck.waitTime });
        return { 
          success: false, 
          error: rateLimitCheck.message,
          waitTime: rateLimitCheck.waitTime
        };
      }
      
      logger.info('sendEmail.rate_limit_passed', { to: options.to });

      // Check if main service needs to be retested
      const now = Date.now();
      if (this.isMainServiceDown && now - this.lastMainServiceCheck > 300000) { // 5 minutes
        this.lastMainServiceCheck = now;
        try {
          await this.transporter.verify();
          logger.info('Primary SMTP service recovered');
          this.isMainServiceDown = false;
        } catch {
          logger.warn('Primary SMTP service still down');
        }
      }

      // Check backup service if needed
      if (this.backupTransporter && this.isBackupServiceDown && now - this.lastBackupServiceCheck > 300000) {
        this.lastBackupServiceCheck = now;
        try {
          await this.backupTransporter.verify();
          logger.info('Backup SMTP service recovered');
          this.isBackupServiceDown = false;
        } catch {
          logger.warn('Backup SMTP service still down');
        }
      }

      let result: EmailResult;

      // Try primary transporter first (if not down)
      if (!this.isMainServiceDown) {
        result = await this.sendWithTransporter(this.transporter, options, 'Primary SMTP');
        
        if (result.success) {
          this.lastSendTime = now;
          return result;
        } else {
          // Mark primary as down if it fails
          this.isMainServiceDown = true;
          this.lastMainServiceCheck = now;
        }
      }

      // Try backup transporter if primary failed
      if (this.backupTransporter && !this.isBackupServiceDown) {
  logger.warn('Primary SMTP failed; attempting backup service');
        result = await this.sendWithTransporter(this.backupTransporter, options, 'Backup SMTP');
        
        if (result.success) {
          this.lastSendTime = now;
          return result;
        } else {
          this.isBackupServiceDown = true;
          this.lastBackupServiceCheck = now;
        }
      }

      // If primary failed, return error
      return {
        success: false,
        error: 'Email service is currently unavailable. Please try again in a few minutes or contact support.'
      };

    } catch (error) {
      logger.error('Unexpected error in sendEmail', { error });
      return {
        success: false,
        error: 'An unexpected error occurred while sending email'
      };
    }
  }

  async sendOTPEmail(
    email: string, 
    otp: string, 
    type: 'signup' | 'recovery' = 'signup'
  ): Promise<EmailResult> {
    const subject = type === 'signup' 
      ? 'Verify Your Email - TecBunny Store' 
      : 'Password Recovery Code - TecBunny Store';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            margin: 0; 
            padding: 0; 
          }
          .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background: #ffffff; 
          }
          .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            padding: 30px 20px; 
            text-align: center; 
          }
          .content { 
            padding: 40px 20px; 
            background: #f8f9fa; 
          }
          .otp-section { 
            background: #ffffff; 
            border: 3px dashed #667eea; 
            padding: 30px; 
            text-align: center; 
            margin: 30px 0; 
            border-radius: 12px; 
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          }
          .otp-code { 
            font-size: 36px; 
            font-weight: bold; 
            color: #667eea; 
            letter-spacing: 8px; 
            margin: 10px 0; 
          }
          .warning-box { 
            background: #fff3cd; 
            border: 1px solid #ffeaa7; 
            padding: 20px; 
            border-radius: 8px; 
            margin: 20px 0; 
          }
          .footer { 
            background: #343a40; 
            color: #ffffff; 
            text-align: center; 
            padding: 20px; 
            font-size: 14px; 
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 ${type === 'signup' ? 'Email Verification' : 'Password Recovery'}</h1>
            <p>TecBunny Store - Secure Account Management</p>
          </div>
          
          <div class="content">
            <h2>Hello!</h2>
            <p>${type === 'signup' 
              ? 'Thank you for creating your TecBunny Store account! Please use the verification code below to complete your registration:' 
              : 'We received a request to reset your password. Use the code below to proceed:'
            }</p>
            
            <div class="otp-section">
              <p style="margin: 0 0 10px 0; font-size: 18px; color: #666;">Your verification code:</p>
              <div class="otp-code">${otp}</div>
              <p style="margin: 10px 0 0 0; color: #666; font-size: 14px;">
                Enter this code to ${type === 'signup' ? 'verify your email' : 'reset your password'}
              </p>
            </div>
            
            <div class="warning-box">
              <h3 style="color: #856404; margin-top: 0;">⚠️ Important Security Information:</h3>
              <ul style="color: #856404; margin: 10px 0;">
                <li><strong>This code expires in 15 minutes</strong></li>
                <li>Never share this code with anyone</li>
                <li>TecBunny staff will never ask for this code</li>
                <li>If you didn't request this, please ignore this email</li>
              </ul>
            </div>
            
            <p>Having trouble? Contact our support team at support@tecbunny.com</p>
            
            <p style="margin-top: 30px;">
              Best regards,<br>
              <strong>TecBunny Store Team</strong>
            </p>
          </div>
          
          <div class="footer">
            <p>This is an automated security email from TecBunny Store.</p>
            <p>Please do not reply to this email.</p>
            <p>&copy; 2025 TecBunny Store. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject,
      html,
      text: `Your ${type === 'signup' ? 'verification' : 'password recovery'} code is: ${otp}. This code expires in 15 minutes.`
    });
  }

  async sendTestEmail(
    email: string,
    subject: string,
    message: string
  ): Promise<EmailResult> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #667eea; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f8f9fa; }
          .footer { background: #343a40; color: white; text-align: center; padding: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Test Email from TecBunny Store</h1>
          </div>
          <div class="content">
            <h2>${subject}</h2>
            <p>${message}</p>
            <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
          </div>
          <div class="footer">
            <p>This is a test email from TecBunny Store Enhanced Email Service</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject,
      html,
      text: `${subject}\n\n${message}\n\nTimestamp: ${new Date().toISOString()}`
    });
  }
}

// Export singleton instance
const improvedEmailService = new ImprovedEmailService();

export default improvedEmailService;
