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

  private brandedEmail(heading: string, bodyHtml: string): string {
    return `
      <div style="margin:0;padding:24px;background:#0f1424;font-family:Inter,Segoe UI,Arial,sans-serif;">
        <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;">
          <div style="background:#090B14;padding:24px 28px;">
            <span style="color:#ffffff;font-size:18px;font-weight:800;">Som<span style="color:#FBBF24;">Reception</span> AI</span>
          </div>
          <div style="padding:28px;color:#1f2937;">
            <h1 style="margin:0 0 14px;font-size:20px;color:#0f1424;">${heading}</h1>
            ${bodyHtml}
          </div>
          <div style="padding:18px 28px;background:#f8fafc;color:#94a3b8;font-size:12px;">
            © ${new Date().getFullYear()} SomReception AI · Enterprise AI Reception Platform
          </div>
        </div>
      </div>`;
  }

  async sendApplicationReceivedEmail(
    email: string,
    firstName: string,
    businessName?: string
  ): Promise<void> {
    const body = `
      <p style="font-size:14.5px;line-height:1.6;">Hi ${firstName},</p>
      <p style="font-size:14.5px;line-height:1.6;">
        Thanks for applying to SomReception AI${businessName ? ` for <strong>${businessName}</strong>` : ''}.
        Your application is now <strong>under review</strong> by our team. You'll receive an
        activation code by email as soon as it's approved.
      </p>`;
    await this.send(email, 'We received your SomReception AI application', this.brandedEmail('Application received', body));
  }

  async sendApprovalCodeEmail(
    email: string,
    code: string,
    firstName: string,
    opts?: { businessName?: string; expiryMinutes?: number }
  ): Promise<void> {
    const activateUrl = `${config.frontendUrl}/activate?email=${encodeURIComponent(email)}`;
    const minutes = opts?.expiryMinutes ?? 30;
    const body = `
      <p style="font-size:14.5px;line-height:1.6;">Hi ${firstName},</p>
      <p style="font-size:14.5px;line-height:1.6;">
        Great news — your business${opts?.businessName ? ` <strong>${opts.businessName}</strong>` : ''}
        has been <strong>approved</strong>. Use the activation code below to finish setting up your account:
      </p>
      <div style="margin:22px 0;text-align:center;">
        <span style="display:inline-block;background:#090B14;color:#FBBF24;font-size:30px;font-weight:800;letter-spacing:8px;padding:14px 26px;border-radius:12px;">${code}</span>
      </div>
      <p style="font-size:13.5px;line-height:1.6;color:#64748b;">
        This code expires in ${minutes} minutes. Enter it here:
        <a href="${activateUrl}" style="color:#b45309;font-weight:600;">Activate my account</a>.
        If it expires, you can request a new one from the activation page.
      </p>`;
    await this.send(email, 'Your SomReception AI activation code', this.brandedEmail('Your application was approved', body));
  }

  async sendApplicationRejectedEmail(
    email: string,
    firstName: string,
    reason?: string
  ): Promise<void> {
    const body = `
      <p style="font-size:14.5px;line-height:1.6;">Hi ${firstName},</p>
      <p style="font-size:14.5px;line-height:1.6;">
        Thank you for your interest in SomReception AI. After review, we're unable to approve your
        business application at this time.
      </p>
      ${reason ? `<p style="font-size:14px;line-height:1.6;background:#fef2f2;border-radius:10px;padding:12px 14px;color:#991b1b;">${reason}</p>` : ''}
      <p style="font-size:13.5px;line-height:1.6;color:#64748b;">
        If you believe this was a mistake, please contact SomReception support.
      </p>`;
    await this.send(email, 'Update on your SomReception AI application', this.brandedEmail('Application update', body));
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
