import nodemailer from 'nodemailer';
import { config } from '../../config';
import { logger } from '../../core/logger';

const transporter = config.email.host
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
  async send(to: string, subject: string, html: string): Promise<void> {
    if (!transporter) {
      logger.info(`[Email Dev] To: ${to}, Subject: ${subject}`);
      return;
    }

    await transporter.sendMail({
      from: config.email.from,
      to,
      subject,
      html,
    });
  }

  async sendVerificationEmail(email: string, token: string): Promise<void> {
    const url = `${config.frontendUrl}/verify-email?token=${token}`;
    await this.send(
      email,
      'Verify your SmartReception AI account',
      `<h1>Welcome to SmartReception AI</h1>
       <p>Click the link below to verify your email:</p>
       <a href="${url}">Verify Email</a>`
    );
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const url = `${config.frontendUrl}/reset-password?token=${token}`;
    await this.send(
      email,
      'Reset your SmartReception AI password',
      `<h1>Password Reset</h1>
       <p>Click the link below to reset your password:</p>
       <a href="${url}">Reset Password</a>
       <p>This link expires in 1 hour.</p>`
    );
  }

  async sendTeamInvitation(email: string, businessName: string, token: string): Promise<void> {
    const url = `${config.frontendUrl}/accept-invite?token=${token}`;
    await this.send(
      email,
      `You've been invited to join ${businessName}`,
      `<h1>Team Invitation</h1>
       <p>You've been invited to join <strong>${businessName}</strong> on SmartReception AI.</p>
       <a href="${url}">Accept Invitation</a>`
    );
  }
}

export const emailService = new EmailService();
