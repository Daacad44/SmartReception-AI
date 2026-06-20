import dotenv from 'dotenv';
dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  frontendUrl:
    process.env.FRONTEND_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5173'),
  apiUrl: process.env.API_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3001'),

  database: {
    url: process.env.DATABASE_URL!,
  },

  redis: {
    url: process.env.REDIS_URL || '',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-me',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  },

  whatsapp: {
    verifyToken:
      process.env.VERIFY_TOKEN ||
      process.env.WHATSAPP_VERIFY_TOKEN ||
      '',
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    businessAccountId:
      process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
    appId: process.env.META_APP_ID || '',
    appSecret:
      process.env.WHATSAPP_APP_SECRET ||
      process.env.META_APP_SECRET ||
      '',
    apiVersion: process.env.WHATSAPP_API_VERSION || 'v21.0',
    apiUrl: `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION || 'v21.0'}`,
  },

  r2: {
    accountId: process.env.R2_ACCOUNT_ID || '',
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    bucketName: process.env.R2_BUCKET_NAME || 'smartreception',
    publicUrl: process.env.R2_PUBLIC_URL || '',
  },

  supabase: {
    url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    anonKey: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
  },

  email: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.EMAIL_FROM || 'SmartReception AI <noreply@botandev.com>',
    fromName: process.env.EMAIL_FROM_NAME || 'SmartReception AI',
    fromEmail: process.env.EMAIL_FROM_ADDRESS || 'noreply@botandev.com',
    supportEmail: process.env.EMAIL_SUPPORT || 'support@botandev.com',
  },

  resend: {
    apiKey: process.env.RESEND_API_KEY || '',
  },

  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  },
} as const;

const INSECURE_JWT_SECRETS = new Set([
  'dev-secret-change-me',
  'dev-refresh-secret-change-me',
]);

export function validateProductionConfig(): void {
  if (config.env !== 'production') return;

  if (!config.database.url) {
    throw new Error('DATABASE_URL is required in production');
  }

  if (INSECURE_JWT_SECRETS.has(config.jwt.secret) || INSECURE_JWT_SECRETS.has(config.jwt.refreshSecret)) {
    throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be set to strong values in production');
  }
}
