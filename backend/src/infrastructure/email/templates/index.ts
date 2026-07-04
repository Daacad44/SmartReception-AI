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

interface AppointmentEmailData {
  customerName: string;
  serviceName: string;
  date: string;
  time: string;
  meetingLink?: string;
  details?: string;
  businessName?: string;
  bookingNumber?: string;
  location?: string;
  logoUrl?: string;
  calendarLinks?: { google?: string; outlook?: string; apple?: string };
}

export function appointmentConfirmationEmail(data: AppointmentEmailData): { subject: string; html: string } {
  const business = data.businessName ?? BRAND.productName;
  const body = `
    ${data.logoUrl ? `<img src="${data.logoUrl}" alt="${business}" style="max-height:48px;margin-bottom:16px;" />` : ''}
    <h1 style="margin:0 0 12px;font-size:24px;font-weight:700;color:${BRAND.primaryColor};">Appointment Confirmation</h1>
    <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.7;">
      Hello ${data.customerName}, your appointment with <strong>${business}</strong> has been confirmed.
    </p>
    <table role="presentation" width="100%" style="margin:16px 0;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;">
      <tr><td style="padding:16px;font-size:14px;color:#475569;line-height:1.8;">
        <strong>Reference:</strong> ${data.bookingNumber ?? '—'}<br />
        <strong>Full Name:</strong> ${data.customerName}<br />
        <strong>Service:</strong> ${data.serviceName}<br />
        <strong>Date:</strong> ${data.date}<br />
        <strong>Time:</strong> ${data.time}
        ${data.location ? `<br /><strong>Location:</strong> ${data.location}` : ''}
        ${data.meetingLink ? `<br /><strong>Meeting Link:</strong> <a href="${data.meetingLink}" style="color:${BRAND.accentColor};">${data.meetingLink}</a>` : ''}
        ${data.details ? `<br /><strong>Details:</strong> ${data.details}` : ''}
      </td></tr>
    </table>
    ${
      data.calendarLinks
        ? `<p style="margin:16px 0;font-size:14px;color:#475569;">
        Add to calendar:
        ${data.calendarLinks.google ? `<a href="${data.calendarLinks.google}" style="color:${BRAND.accentColor};margin-right:12px;">Google</a>` : ''}
        ${data.calendarLinks.outlook ? `<a href="${data.calendarLinks.outlook}" style="color:${BRAND.accentColor};margin-right:12px;">Outlook</a>` : ''}
        ${data.calendarLinks.apple ? `<a href="${data.calendarLinks.apple}" style="color:${BRAND.accentColor};">Apple</a>` : ''}
      </p>`
        : ''
    }
    <p style="margin:0;font-size:14px;color:#64748B;line-height:1.6;">
      You will receive reminders before your appointment. Reply to reschedule or cancel.
    </p>
  `;

  return {
    subject: `Appointment Confirmation – ${business}`,
    html: renderEmailLayout({
      preheader: `Your appointment on ${data.date} at ${data.time} is confirmed`,
      title: 'Appointment Confirmation',
      body,
    }),
  };
}

export function appointmentReminderEmail(
  data: AppointmentEmailData & { reminderLabel: string }
): { subject: string; html: string } {
  const body = `
    <h1 style="margin:0 0 12px;font-size:24px;font-weight:700;color:${BRAND.primaryColor};">Appointment Reminder</h1>
    <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.7;">
      Hello ${data.customerName}, this is a reminder that your appointment is scheduled in:
    </p>
    <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.7;">
      <strong>${data.reminderLabel}</strong>
    </p>
    <p style="margin:0 0 8px;font-size:14px;color:#475569;">Appointment Time: <strong>${data.time}</strong></p>
  `;

  return {
    subject: `Appointment Reminder – ${data.reminderLabel}`,
    html: renderEmailLayout({
      preheader: `Reminder: ${data.serviceName} on ${data.date}`,
      title: 'Appointment Reminder',
      body,
    }),
  };
}

export function appointmentMissedEmail(data: { customerName: string }): { subject: string; html: string } {
  const body = `
    <h1 style="margin:0 0 12px;font-size:24px;font-weight:700;color:${BRAND.primaryColor};">Missed Appointment</h1>
    <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.7;">
      Hello ${data.customerName},
    </p>
    <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.7;">
      Your appointment time has passed.
    </p>
    <p style="margin:0;font-size:14px;color:#64748B;line-height:1.6;">
      If you still need assistance, please contact us or schedule a new appointment.
    </p>
    <p style="margin:16px 0 0;font-size:14px;color:#64748B;">Thank you.</p>
  `;

  return {
    subject: 'Missed Appointment – SmartReception',
    html: renderEmailLayout({
      preheader: 'Your appointment time has passed',
      title: 'Missed Appointment',
      body,
    }),
  };
}

export function appointmentApprovedEmail(data: {
  customerName: string;
  date: string;
  time: string;
}): { subject: string; html: string } {
  const body = `
    <h1 style="margin:0 0 12px;font-size:24px;font-weight:700;color:${BRAND.primaryColor};">Appointment Approved</h1>
    <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.7;">
      Hello ${data.customerName},
    </p>
    <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.7;">
      Your appointment has been approved. Please be available at the scheduled time.
    </p>
    <table role="presentation" width="100%" style="margin:16px 0;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;">
      <tr><td style="padding:16px;font-size:14px;color:#475569;line-height:1.8;">
        <strong>Date:</strong> ${data.date}<br />
        <strong>Time:</strong> ${data.time}
      </td></tr>
    </table>
    <p style="margin:0;font-size:14px;color:#64748B;line-height:1.6;">
      We look forward to serving you.
    </p>
  `;

  return {
    subject: 'Appointment Approved – SmartReception',
    html: renderEmailLayout({
      preheader: `Your appointment on ${data.date} at ${data.time} is approved`,
      title: 'Appointment Approved',
      body,
    }),
  };
}

export function appointmentMissedFollowUpEmail(data: {
  customerName: string;
}): { subject: string; html: string } {
  const body = `
    <h1 style="margin:0 0 12px;font-size:24px;font-weight:700;color:${BRAND.primaryColor};">Reschedule Your Appointment</h1>
    <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.7;">
      Hello ${data.customerName},
    </p>
    <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.7;">
      We noticed that your appointment was missed.
    </p>
    <p style="margin:0;font-size:14px;color:#64748B;line-height:1.6;">
      Would you like to book a new appointment? Reply to this message or contact us to reschedule.
    </p>
  `;

  return {
    subject: 'Book a New Appointment – SmartReception',
    html: renderEmailLayout({
      preheader: 'Would you like to reschedule your missed appointment?',
      title: 'Missed Appointment Follow-up',
      body,
    }),
  };
}

interface GovernanceApprovalRequestEmailData {
  firstName: string;
  businessName: string;
  requesterName: string;
  actionLabel: string;
  reviewUrl: string;
}

export function governanceApprovalRequestEmail(
  data: GovernanceApprovalRequestEmailData
): { subject: string; html: string } {
  const body = `
    <h1 style="margin:0 0 12px;font-size:24px;font-weight:700;color:${BRAND.primaryColor};">Administrator approval required</h1>
    <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.7;">
      Hi ${data.firstName}, an Enterprise customer submitted a sensitive action that requires your approval.
    </p>
    <table role="presentation" width="100%" style="margin:16px 0;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;">
      <tr><td style="padding:16px;font-size:14px;color:#475569;line-height:1.8;">
        <strong>Business:</strong> ${data.businessName}<br />
        <strong>Requested by:</strong> ${data.requesterName}<br />
        <strong>Action:</strong> ${data.actionLabel}
      </td></tr>
    </table>
    ${renderButton(data.reviewUrl, 'Review Request')}
  `;

  return {
    subject: `[Action Required] ${data.businessName} — ${data.actionLabel}`,
    html: renderEmailLayout({
      preheader: `${data.requesterName} requested ${data.actionLabel}`,
      title: 'Governance approval',
      body,
    }),
  };
}

interface GovernanceActivationCodeEmailData {
  firstName: string;
  businessName: string;
  actionLabel: string;
  code: string;
  expiryMinutes: number;
  activateUrl: string;
}

export function governanceActivationCodeEmail(
  data: GovernanceActivationCodeEmailData
): { subject: string; html: string } {
  const body = `
    <h1 style="margin:0 0 12px;font-size:24px;font-weight:700;color:${BRAND.primaryColor};">Approval granted</h1>
    <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.7;">
      Hi ${data.firstName}, your request to <strong>${data.actionLabel}</strong> for <strong>${data.businessName}</strong> was approved.
    </p>
    <p style="margin:0 0 8px;font-size:15px;color:#475569;line-height:1.7;">
      Enter this one-time activation code to complete the action:
    </p>
    ${renderOtpCard(data.code)}
    <p style="margin:0 0 16px;font-size:14px;color:#64748B;line-height:1.6;text-align:center;">
      Valid for <strong>${data.expiryMinutes} minutes</strong>. Single use only.
    </p>
    ${renderButton(data.activateUrl, 'Enter Activation Code')}
    ${renderSecurityNotice('Never share this code. If you did not request this action, contact your administrator immediately.')}
  `;

  return {
    subject: `${data.code} — Activation code for ${data.actionLabel}`,
    html: renderEmailLayout({
      preheader: `Your activation code is ${data.code}`,
      title: 'Activation code',
      body,
    }),
  };
}
