import { config } from '../../../config';

export const BRAND = {
  productName: 'SmartReception AI',
  company: 'BotanDev',
  website: config.frontendUrl,
  supportEmail: config.email.supportEmail,
  fromEmail: config.email.fromEmail,
  primaryColor: '#0F172A',
  secondaryColor: '#635147',
  backgroundColor: '#F8FAFC',
  accentColor: '#651147',
} as const;

export interface EmailLayoutOptions {
  preheader?: string;
  title: string;
  body: string;
}

export function renderEmailLayout({ preheader, title, body }: EmailLayoutOptions): string {
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>${title}</title>
  <style>
    @media (prefers-color-scheme: dark) {
      .email-bg { background-color: #0B1220 !important; }
      .email-card { background-color: #111827 !important; border-color: #1F2937 !important; }
      .email-text { color: #F8FAFC !important; }
      .email-muted { color: #94A3B8 !important; }
      .email-footer { background-color: #0F172A !important; }
    }
    @media only screen and (max-width: 600px) {
      .email-card { width: 100% !important; }
      .email-button { display: block !important; width: 100% !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:${BRAND.backgroundColor};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>` : ''}
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="email-bg" style="background:${BRAND.backgroundColor};padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" class="email-card" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #E2E8F0;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="background:${BRAND.primaryColor};padding:28px 32px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="display:inline-block;width:40px;height:40px;border-radius:10px;background:${BRAND.accentColor};text-align:center;line-height:40px;color:#fff;font-weight:700;font-size:18px;">SR</div>
                  </td>
                  <td style="padding-left:12px;">
                    <div class="email-text" style="color:#ffffff;font-size:18px;font-weight:700;line-height:1.2;">${BRAND.productName}</div>
                    <div style="color:#94A3B8;font-size:12px;margin-top:4px;">by ${BRAND.company}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;" class="email-text">
              ${body}
            </td>
          </tr>
          <tr>
            <td class="email-footer" style="background:#F1F5F9;padding:24px 32px;border-top:1px solid #E2E8F0;">
              <p class="email-muted" style="margin:0 0 8px;font-size:12px;color:#64748B;line-height:1.6;">
                © ${year} ${BRAND.company}. All rights reserved.
              </p>
              <p class="email-muted" style="margin:0 0 8px;font-size:12px;color:#64748B;line-height:1.6;">
                <a href="${BRAND.website}" style="color:${BRAND.secondaryColor};text-decoration:none;">${BRAND.website.replace('https://', '')}</a>
                &nbsp;·&nbsp;
                <a href="mailto:${BRAND.supportEmail}" style="color:${BRAND.secondaryColor};text-decoration:none;">${BRAND.supportEmail}</a>
              </p>
              <p class="email-muted" style="margin:0;font-size:11px;color:#94A3B8;line-height:1.5;">
                This is an automated security email from ${BRAND.productName}. If you did not request this, please contact support immediately.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function renderButton(href: string, label: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px 0;">
  <tr>
    <td align="center" style="border-radius:10px;background:${BRAND.accentColor};">
      <a href="${href}" class="email-button" style="display:inline-block;padding:14px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:10px;">${label}</a>
    </td>
  </tr>
</table>`;
}

export function renderSecurityNotice(text: string): string {
  return `<div style="margin-top:24px;padding:16px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;">
  <p class="email-muted" style="margin:0;font-size:13px;color:#64748B;line-height:1.6;">
    <strong style="color:${BRAND.primaryColor};">Security notice:</strong> ${text}
  </p>
</div>`;
}
