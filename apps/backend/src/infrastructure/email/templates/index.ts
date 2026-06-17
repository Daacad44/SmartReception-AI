import { BRAND, renderButton, renderEmailLayout, renderSecurityNotice } from './layout';

function renderOtpCard(code: string): string {
  return `<div style="margin:32px auto;max-width:320px;padding:28px 24px;background:${BRAND.primaryColor};border-radius:16px;text-align:center;">
    <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#94A3B8;">Verification Code</p>
    <p style="margin:0;font-size:42px;font-weight:700;letter-spacing:0.35em;color:#ffffff;font-family:'Courier New',monospace;">${code}</p>
  </div>`;
}

interface OtpEmailData {
  firstName: string;
  code: string;
  expiryMinutes: number;
  purpose: 'verification' | 'password_reset';
}

export function otpEmail(data: OtpEmailData): { subject: string; html: string } {
  const isVerify = data.purpose === 'verification';
  const title = isVerify ? 'Verify your email' : 'Reset your password';
  const message = isVerify
    ? `Hi ${data.firstName}, use this code to verify your ${BRAND.productName} account:`
    : `Hi ${data.firstName}, use this code to reset your ${BRAND.productName} password:`;

  const body = `
    <h1 style="margin:0 0 12px;font-size:24px;font-weight:700;color:${BRAND.primaryColor};">${title}</h1>
    <p style="margin:0 0 8px;font-size:15px;color:#475569;line-height:1.7;">${message}</p>
    ${renderOtpCard(data.code)}
    <p style="margin:0;font-size:14px;color:#64748B;line-height:1.6;text-align:center;">
      This code expires in <strong>${data.expiryMinutes} minutes</strong>.
    </p>
    ${renderSecurityNotice('Never share this code with anyone. ' + BRAND.productName + ' will never ask for your code by phone or chat.')}
  `;

  return {
    subject: isVerify
      ? `${data.code} is your ${BRAND.productName} verification code`
      : `${data.code} is your ${BRAND.productName} password reset code`,
    html: renderEmailLayout({
      preheader: `Your verification code is ${data.code}`,
      title,
      body,
    }),
  };
}

interface VerificationEmailData {
  firstName: string;
  businessName: string;
  verifyUrl: string;
}

export function verificationEmail(data: VerificationEmailData): { subject: string; html: string } {
  const body = `
    <h1 style="margin:0 0 12px;font-size:24px;font-weight:700;color:${BRAND.primaryColor};">Verify your email</h1>
    <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.7;">
      Hi ${data.firstName}, welcome to <strong>${BRAND.productName}</strong>! Please verify your email to activate your account for <strong>${data.businessName}</strong>.
    </p>
    ${renderButton(data.verifyUrl, 'Verify Email Address')}
    <p style="margin:0;font-size:13px;color:#64748B;line-height:1.6;">
      Or copy this link into your browser:<br />
      <a href="${data.verifyUrl}" style="color:${BRAND.secondaryColor};word-break:break-all;">${data.verifyUrl}</a>
    </p>
    ${renderSecurityNotice('This verification link expires in 24 hours and can only be used once. You must verify your email before signing in.')}
  `;

  return {
    subject: `Verify your ${BRAND.productName} account`,
    html: renderEmailLayout({
      preheader: `Verify your email to activate ${data.businessName}`,
      title: 'Verify your email',
      body,
    }),
  };
}

interface WelcomeEmailData {
  firstName: string;
  businessName: string;
  dashboardUrl: string;
}

export function welcomeEmail(data: WelcomeEmailData): { subject: string; html: string } {
  const body = `
    <h1 style="margin:0 0 12px;font-size:24px;font-weight:700;color:${BRAND.primaryColor};">Welcome aboard, ${data.firstName}!</h1>
    <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.7;">
      Your email is verified and <strong>${data.businessName}</strong> is ready on ${BRAND.productName}. Start automating customer conversations, appointments, and your knowledge base today.
    </p>
    ${renderButton(data.dashboardUrl, 'Go to Dashboard')}
    <p style="margin:0;font-size:14px;color:#64748B;line-height:1.6;">
      Need help getting started? Contact us at <a href="mailto:${BRAND.supportEmail}" style="color:${BRAND.secondaryColor};">${BRAND.supportEmail}</a>.
    </p>
  `;

  return {
    subject: `Welcome to ${BRAND.productName}`,
    html: renderEmailLayout({
      preheader: `Your ${data.businessName} workspace is ready`,
      title: 'Welcome to SmartReception AI',
      body,
    }),
  };
}

interface PasswordResetEmailData {
  firstName: string;
  resetUrl: string;
}

export function passwordResetEmail(data: PasswordResetEmailData): { subject: string; html: string } {
  const body = `
    <h1 style="margin:0 0 12px;font-size:24px;font-weight:700;color:${BRAND.primaryColor};">Reset your password</h1>
    <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.7;">
      Hi ${data.firstName}, we received a request to reset your ${BRAND.productName} password.
    </p>
    ${renderButton(data.resetUrl, 'Reset Password')}
    <p style="margin:0;font-size:13px;color:#64748B;line-height:1.6;">
      Or copy this link:<br />
      <a href="${data.resetUrl}" style="color:${BRAND.secondaryColor};word-break:break-all;">${data.resetUrl}</a>
    </p>
    ${renderSecurityNotice('This link expires in 15 minutes and can only be used once. If you did not request a password reset, ignore this email — your password will remain unchanged.')}
  `;

  return {
    subject: `Reset your ${BRAND.productName} password`,
    html: renderEmailLayout({
      preheader: 'Reset your password — expires in 15 minutes',
      title: 'Password reset',
      body,
    }),
  };
}

interface PasswordChangedEmailData {
  firstName: string;
  loginUrl: string;
}

export function passwordChangedEmail(data: PasswordChangedEmailData): { subject: string; html: string } {
  const body = `
    <h1 style="margin:0 0 12px;font-size:24px;font-weight:700;color:${BRAND.primaryColor};">Password changed</h1>
    <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.7;">
      Hi ${data.firstName}, your ${BRAND.productName} password was successfully changed.
    </p>
    ${renderButton(data.loginUrl, 'Sign In')}
    ${renderSecurityNotice('If you did not make this change, contact support immediately at ' + BRAND.supportEmail + '.')}
  `;

  return {
    subject: `Your ${BRAND.productName} password was changed`,
    html: renderEmailLayout({
      preheader: 'Your password was successfully updated',
      title: 'Password changed',
      body,
    }),
  };
}

interface LoginAlertEmailData {
  firstName: string;
  loginTime: string;
  ipAddress?: string;
}

export function loginAlertEmail(data: LoginAlertEmailData): { subject: string; html: string } {
  const body = `
    <h1 style="margin:0 0 12px;font-size:24px;font-weight:700;color:${BRAND.primaryColor};">New sign-in detected</h1>
    <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.7;">
      Hi ${data.firstName}, your ${BRAND.productName} account was just signed into.
    </p>
    <table role="presentation" width="100%" style="margin:16px 0;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;">
      <tr><td style="padding:16px;font-size:14px;color:#475569;">
        <strong>Time:</strong> ${data.loginTime}<br />
        ${data.ipAddress ? `<strong>IP Address:</strong> ${data.ipAddress}<br />` : ''}
      </td></tr>
    </table>
    ${renderSecurityNotice('If this was not you, reset your password immediately and contact ' + BRAND.supportEmail + '.')}
  `;

  return {
    subject: `New sign-in to ${BRAND.productName}`,
    html: renderEmailLayout({
      preheader: 'A new sign-in to your account was detected',
      title: 'Login alert',
      body,
    }),
  };
}

interface TeamInvitationEmailData {
  businessName: string;
  inviterName: string;
  role: string;
  inviteUrl: string;
}

export function teamInvitationEmail(data: TeamInvitationEmailData): { subject: string; html: string } {
  const body = `
    <h1 style="margin:0 0 12px;font-size:24px;font-weight:700;color:${BRAND.primaryColor};">You're invited!</h1>
    <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.7;">
      <strong>${data.inviterName}</strong> has invited you to join <strong>${data.businessName}</strong> on ${BRAND.productName} as <strong>${data.role}</strong>.
    </p>
    ${renderButton(data.inviteUrl, 'Accept Invitation')}
    <p style="margin:0;font-size:13px;color:#64748B;line-height:1.6;">
      This invitation expires in 7 days.
    </p>
    ${renderSecurityNotice('If you were not expecting this invitation, you can safely ignore this email.')}
  `;

  return {
    subject: `Join ${data.businessName} on ${BRAND.productName}`,
    html: renderEmailLayout({
      preheader: `You've been invited to join ${data.businessName}`,
      title: 'Team invitation',
      body,
    }),
  };
}

interface AccountActivatedEmailData {
  firstName: string;
  businessName: string;
  dashboardUrl: string;
}

export function accountActivatedEmail(data: AccountActivatedEmailData): { subject: string; html: string } {
  const body = `
    <h1 style="margin:0 0 12px;font-size:24px;font-weight:700;color:${BRAND.primaryColor};">Account activated</h1>
    <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.7;">
      Hi ${data.firstName}, your ${BRAND.productName} account for <strong>${data.businessName}</strong> is now fully activated. You can sign in and start using all features.
    </p>
    ${renderButton(data.dashboardUrl, 'Access Your Account')}
  `;

  return {
    subject: `Your ${BRAND.productName} account is active`,
    html: renderEmailLayout({
      preheader: 'Your account has been activated',
      title: 'Account activated',
      body,
    }),
  };
}

interface ResendVerificationEmailData {
  firstName: string;
  verifyUrl: string;
}

export function resendVerificationEmail(data: ResendVerificationEmailData): { subject: string; html: string } {
  const body = `
    <h1 style="margin:0 0 12px;font-size:24px;font-weight:700;color:${BRAND.primaryColor};">Verify your email</h1>
    <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.7;">
      Hi ${data.firstName}, here is a new verification link for your ${BRAND.productName} account.
    </p>
    ${renderButton(data.verifyUrl, 'Verify Email Address')}
    ${renderSecurityNotice('This link expires in 24 hours. You must verify your email before signing in.')}
  `;

  return {
    subject: `Verify your ${BRAND.productName} email`,
    html: renderEmailLayout({
      preheader: 'New email verification link',
      title: 'Email verification',
      body,
    }),
  };
}
