import { EmailService } from './service';
import { EMAIL_TEMPLATES } from './types';
import type { EmailTemplateData, EmailTemplateType } from './types';
import { getEmailQueue } from './queue';
import { logger } from '../logger';

export class EmailClient {
  private static instance: EmailClient;
  private readonly emailService: EmailService;

  private constructor() {
    this.emailService = new EmailService({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
      },
      from: {
        name: process.env.SMTP_FROM_NAME || 'TecBunny Solutions',
        email: process.env.SMTP_FROM || 'noreply@tecbunny.com',
      },
    });
  }

  public static getInstance(): EmailClient {
    if (!EmailClient.instance) {
      EmailClient.instance = new EmailClient();
    }
    return EmailClient.instance;
  }

  private async dispatchEmail(to: string | string[], templateId: EmailTemplateType, data: any, options: any): Promise<boolean> {
    const queue = getEmailQueue();
    if (queue) {
      try {
        await queue.add('send-email', { to, templateId, data, options }, { priority: options.priority === 'high' ? 1 : 5 });
        logger.info('email_queued', { to, templateId });
        return true;
      } catch (error) {
        logger.error('email_queue_failed_fallback_direct', { error: (error as Error).message });
      }
    }
    // Fallback if no queue
    try {
      return await this.emailService.sendTemplateEmail(to, templateId, data, options);
    } catch (error) {
      logger.error('email_send_failed', { error: (error as Error).message });
      return false;
    }
  }

  /**
   * Send OTP Email
   */
  async sendOtpEmail(to: string, otp: string, userName?: string, expiryMinutes: number = 10): Promise<boolean> {
    const data: EmailTemplateData = {
      userName,
      otp,
      otpExpiryMinutes: expiryMinutes,
    };

    return this.dispatchEmail(
      to,
      EMAIL_TEMPLATES.EMAIL_OTP_VERIFICATION,
      data,
      { priority: 'high' }
    );
  }

  /**
   * Send Marketing Email
   */
  async sendMarketingEmail(to: string | string[], campaign: {
    title: string;
    body: string;
    ctaText?: string;
    ctaUrl?: string;
    bannerImageUrl?: string;
    discountCode?: string;
  }): Promise<boolean> {
    const data: EmailTemplateData = {
      campaignTitle: campaign.title,
      campaignBody: campaign.body,
      ctaText: campaign.ctaText,
      ctaUrl: campaign.ctaUrl,
      bannerImageUrl: campaign.bannerImageUrl,
      discountCode: campaign.discountCode,
    };

    return this.dispatchEmail(
      to,
      EMAIL_TEMPLATES.MARKETING_CAMPAIGN,
      data,
      { priority: 'low' }
    );
  }

  /**
   * Send Update Email
   */
  async sendUpdateEmail(to: string | string[], update: {
    title: string;
    body: string;
    date?: string;
    userName?: string;
  }): Promise<boolean> {
    const data: EmailTemplateData = {
      userName: update.userName,
      updateTitle: update.title,
      updateBody: update.body,
      updateDate: update.date || new Date().toLocaleDateString(),
    };

    return this.dispatchEmail(
      to,
      EMAIL_TEMPLATES.GENERAL_UPDATE,
      data,
      { priority: 'normal' }
    );
  }
}

export const emailClient = EmailClient.getInstance();
