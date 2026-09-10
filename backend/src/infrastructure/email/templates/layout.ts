import { config, PRODUCTION_FRONTEND_URL } from '../../../config';

const ASSET_VERSION = '20260910';

export const BRAND = {
  productName: 'SomReception AI',
  tagline: 'AI Receptionist for Modern Businesses',
  company: 'SomReception AI',
  website: config.frontendUrl,
  supportEmail: config.email.supportEmail,
  fromEmail: config.email.fromEmail,
  primaryColor: '#0D1B4B',
  secondaryColor: '#0D1B4B',
  backgroundColor: '#F8FAFC',
  accentColor: '#F59E0B',
  canvasColor: '#090B14',
  lightBlue: '#DBEAFE',
  white: '#FFFFFF',
  logoUrl: `${config.publicAssetUrl('/brand/somreception-logo.png')}?v=${ASSET_VERSION}`,
  iconUrl: `${config.publicAssetUrl('/brand/somreception-icon.png')}?v=${ASSET_VERSION}`,
} as const;

export interface EmailLayoutOptions {
  preheader?: string;
  title: string;
  body: string;
}

export function renderEmailLayout({ preheader, title, body }: EmailLayoutOptions): string {
  const year = new Date().getFullYear();
  const logoUrl = BRAND.logoUrl || `${PRODUCTION_FRONTEND_URL}/brand/somreception-logo.png?v=${ASSET_VERSION}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${title}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    :root { color-scheme: light; supported-color-schemes: light; }
    @media only screen and (max-width: 600px) {
      .email-card { width: 100% !important; }
      .email-pad { padding-left: 20px !important; padding-right: 20px !important; }
      .email-button { display: block !important; width: 100% !important; }
      .email-logo { width: 200px !important; height: auto !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:${BRAND.backgroundColor};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>` : ''}
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${BRAND.backgroundColor};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" class="email-card" style="max-width:600px;width:100%;background:${BRAND.white};border:1px solid #E2E8F0;border-radius:16px;overflow:hidden;">
          <tr>
            <td align="center" class="email-pad" style="background:${BRAND.white};padding:28px 32px 20px;border-bottom:1px solid ${BRAND.lightBlue};">
              <a href="${BRAND.website}" style="text-decoration:none;border:0;">
                <img
                  src="${logoUrl}"
                  alt="${BRAND.productName}"
                  width="220"
                  height="55"
                  class="email-logo"
                  style="display:block;margin:0 auto;width:220px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;background:transparent;"
                />
              </a>
            </td>
          </tr>
          <tr>
            <td class="email-pad email-text" style="padding:32px 36px 28px;background:${BRAND.white};">
              ${body}
            </td>
          </tr>
          <tr>
            <td class="email-pad" style="background:${BRAND.white};padding:8px 36px 32px;border-top:1px solid ${BRAND.lightBlue};">
              <p style="margin:16px 0 4px;font-size:14px;font-weight:700;color:${BRAND.primaryColor};line-height:1.4;">
                ${BRAND.productName}
              </p>
              <p style="margin:0 0 12px;font-size:13px;color:${BRAND.primaryColor};line-height:1.5;">
                ${BRAND.tagline}
              </p>
              <p style="margin:0;font-size:12px;color:#64748B;line-height:1.6;">
                © ${year} ${BRAND.productName}. All rights reserved.
              </p>
              <p style="margin:8px 0 0;font-size:12px;color:#94A3B8;line-height:1.6;">
                <a href="${BRAND.website}" style="color:${BRAND.primaryColor};text-decoration:none;">Website</a>
                &nbsp;·&nbsp;
                <a href="mailto:${BRAND.supportEmail}" style="color:${BRAND.primaryColor};text-decoration:none;">${BRAND.supportEmail}</a>
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
      <a href="${href}" class="email-button" style="display:inline-block;padding:14px 28px;color:${BRAND.primaryColor};font-size:15px;font-weight:700;text-decoration:none;border-radius:10px;">${label}</a>
    </td>
  </tr>
</table>`;
}

export function renderSecurityNotice(text: string): string {
  return `<div style="margin-top:24px;padding:16px;background:${BRAND.lightBlue};border:1px solid #BFDBFE;border-radius:10px;">
  <p style="margin:0;font-size:13px;color:#1E3A8A;line-height:1.6;">
    <strong style="color:${BRAND.primaryColor};">Security notice:</strong> ${text}
  </p>
  </div>`;
}
