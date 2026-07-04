import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import { config } from '../../config';
import { logger } from '../../core/logger';
import * as templates from './templates';

let resendClient: Resend | null = null;

function getResend(): Resend | null {
  if (!config.resend.apiKey) return null;
  if (!resendClient) {
    resendClient = new Resend(config.resend.apiKey);
  }
  return resendClient;
}

const smtpTransporter = config.email.host
  ? nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.port === 465,
      auth: {
        user: config.email.user,
        pass: config.email.pass,
      },
    })
  : null;

export class EmailService {
  private get fromAddress(): string {
    return `${config.email.fromName} <${config.email.fromEmail}>`;
  }

  async send(to: string, subject: string, html: string): Promise<void> {
    await this.sendWithAttachment(to, subject, html);
  }

  async sendWithAttachment(
    to: string,
    subject: string,
    html: string,
    attachments?: Array<{ filename: string; content: string; contentType: string }>
  ): Promise<void> {
    const resend = getResend();

    if (resend) {
      const { error } = await resend.emails.send({
        from: this.fromAddress,
        to,
        subject,
        html,
        attachments: attachments?.map((a) => ({
          filename: a.filename,
          content: Buffer.from(a.content).toString('base64'),
          content_type: a.contentType,
        })),
      });

      if (error) {
        logger.error('Resend email failed:', error);
        throw new Error(`Failed to send email: ${error.message}`);
      }
      logger.info(`Email sent via Resend to ${to}: ${subject}`);
      return;
    }

    if (smtpTransporter) {
      await smtpTransporter.sendMail({
        from: this.fromAddress,
        to,
        subject,
        html,
        attachments: attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
          contentType: a.contentType,
        })),
      });
      logger.info(`Email sent via SMTP to ${to}: ${subject}`);
      return;
    }

    logger.info(`[Email Dev] From: ${this.fromAddress}, To: ${to}, Subject: ${subject}`);
  }

  async sendOtpEmail(
    email: string,
    code: string,
    firstName: string,
    purpose: 'verification' | 'password_reset'
  ): Promise<void> {
    const { subject, html } = templates.otpEmail({
      firstName,
      code,
      expiryMinutes: 10,
      purpose,
    });
    await this.send(email, subject, html);
  }

  async sendWelcomeEmail(
    email: string,
    data: { firstName: string; businessName: string }
  ): Promise<void> {
    const dashboardUrl = `${config.frontendUrl}/dashboard`;
    const { subject, html } = templates.welcomeEmail({
      firstName: data.firstName,
      businessName: data.businessName,
      dashboardUrl,
    });
    await this.send(email, subject, html);
  }

  async sendAccountActivatedEmail(
    email: string,
    data: { firstName: string; businessName: string }
  ): Promise<void> {
    const dashboardUrl = `${config.frontendUrl}/dashboard`;
    const { subject, html } = templates.accountActivatedEmail({
      firstName: data.firstName,
      businessName: data.businessName,
      dashboardUrl,
    });
    await this.send(email, subject, html);
  }

  async sendPasswordResetEmail(email: string, token: string, firstName: string): Promise<void> {
    const resetUrl = `${config.frontendUrl}/reset-password?token=${token}`;
    const { subject, html } = templates.passwordResetEmail({ firstName, resetUrl });
    await this.send(email, subject, html);
  }

  async sendPasswordChangedEmail(email: string, firstName: string): Promise<void> {
    const loginUrl = `${config.frontendUrl}/login`;
    const { subject, html } = templates.passwordChangedEmail({ firstName, loginUrl });
    await this.send(email, subject, html);
  }

  async sendLoginAlert(email: string, data: { firstName: string; ipAddress?: string }): Promise<void> {
    const loginTime = new Date().toUTCString();
    const { subject, html } = templates.loginAlertEmail({
      firstName: data.firstName,
      loginTime,
      ipAddress: data.ipAddress,
    });
    await this.send(email, subject, html);
  }

  async sendTeamInvitation(
    email: string,
    data: { businessName: string; inviterName: string; role: string; token: string }
  ): Promise<void> {
    const inviteUrl = `${config.frontendUrl}/accept-invite?token=${data.token}`;
    const { subject, html } = templates.teamInvitationEmail({
      businessName: data.businessName,
      inviterName: data.inviterName,
      role: data.role,
      inviteUrl,
    });
    await this.send(email, subject, html);
  }
}

export const emailService = new EmailService();
