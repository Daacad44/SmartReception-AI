import dotenv from 'dotenv';
dotenv.config();

const PRODUCTION_API_URL = 'https://api.somreception.botandev.com';
const PRODUCTION_FRONTEND_URL = 'https://somreception.botandev.com';
const DEFAULT_VERIFY_TOKEN = 'smartreception-verify';
export const WHATSAPP_WEBHOOK_PATH = '/api/v1/webhooks/whatsapp';

function normalizeEnv(value: string | undefined): string {
  return (value ?? '').trim();
}

function resolveVerifyToken(): string {
  const token =
    normalizeEnv(process.env.WHATSAPP_VERIFY_TOKEN) ||
    normalizeEnv(process.env.VERIFY_TOKEN) ||
    DEFAULT_VERIFY_TOKEN;
  return token;
}

function resolveApiUrl(): string {
  if (process.env.API_URL) {
    return process.env.API_URL.replace(/\/$/, '');
  }
  if (process.env.NODE_ENV === 'production') {
    return PRODUCTION_API_URL;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return 'http://localhost:3001';
}

function resolveWebhookUrl(): string {
  const canonical = `${resolveApiUrl()}${WHATSAPP_WEBHOOK_PATH}`;

  if (!process.env.WHATSAPP_WEBHOOK_URL) {
    return canonical;
  }

  const configured = process.env.WHATSAPP_WEBHOOK_URL.replace(/\/$/, '');
  const apiBase = resolveApiUrl();
  const legacyUrls = new Set([
    `${apiBase}/webhook`,
    `${apiBase}/api/webhook`,
    'https://somreception.botandev.com/webhook',
    'https://api.somreception.botandev.com/webhook',
  ]);

  if (legacyUrls.has(configured)) {
    console.warn(
      '[WhatsApp] WHATSAPP_WEBHOOK_URL uses legacy path — serving canonical URL:',
      canonical
    );
    return canonical;
  }

  return configured;
}

function resolveFrontendUrl(): string {
  if (process.env.FRONTEND_URL) {
    return process.env.FRONTEND_URL.replace(/\/$/, '');
  }
  if (process.env.NODE_ENV === 'production') {
    return PRODUCTION_FRONTEND_URL;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return 'http://localhost:5173';
}

const apiUrl = resolveApiUrl();
const webhookUrl = resolveWebhookUrl();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  frontendUrl: resolveFrontendUrl(),
  apiUrl,

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

  ai: {
    provider: (process.env.AI_PROVIDER || 'gemini').toLowerCase(),
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    embeddingModel: process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001',
    ragTopK: parseInt(process.env.AI_RAG_TOP_K || '5', 10),
    ragMinScore: parseFloat(process.env.AI_RAG_MIN_SCORE || '0.25'),
    ragChunkTokenSize: parseInt(process.env.AI_RAG_CHUNK_TOKENS || '450', 10),
    ragChunkOverlapTokens: parseInt(process.env.AI_RAG_CHUNK_OVERLAP || '75', 10),
    ragMaxKnowledgeChars: parseInt(process.env.AI_RAG_MAX_KNOWLEDGE_CHARS || '4000', 10),
    ragSecondaryRetrieval: process.env.AI_RAG_SECONDARY_RETRIEVAL !== 'false',
    memoryRawExchanges: parseInt(process.env.AI_MEMORY_RAW_EXCHANGES || '4', 10),
    summaryMaxChars: parseInt(process.env.AI_SUMMARY_MAX_CHARS || '1200', 10),
  },

  whatsapp: {
    verifyToken: resolveVerifyToken(),
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
    appId: process.env.META_APP_ID || '',
    appSecret:
      process.env.WHATSAPP_APP_SECRET ||
      process.env.META_APP_SECRET ||
      '',
    apiVersion: process.env.WHATSAPP_API_VERSION || 'v23.0',
    apiUrl: `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION || 'v23.0'}`,
    webhookUrl,
    displayPhone: process.env.WHATSAPP_DISPLAY_PHONE || '+25268776299',
    embeddedSignupConfigId: process.env.META_WHATSAPP_CONFIG_ID || '',
  },

  r2: {
    accountId: process.env.R2_ACCOUNT_ID || '',
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    // Legacy single-bucket name — kept for backward compat, treated as the
    // knowledge-documents bucket if the more-specific env var below is unset.
    bucketName: process.env.R2_BUCKET_NAME || 'smartreception',
    knowledgeBucket:
      process.env.R2_KNOWLEDGE_BUCKET ||
      process.env.R2_BUCKET_NAME ||
      'knowledge-documents',
    whatsappMediaBucket: process.env.R2_WHATSAPP_MEDIA_BUCKET || 'whatsapp-media',
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

  aiReply: {
    enabled: process.env.AI_REPLY_ENABLED !== 'false',
    maxContextMessages: parseInt(process.env.AI_MAX_CONTEXT_MESSAGES || '20', 10),
    timeoutMs: parseInt(process.env.AI_REPLY_TIMEOUT_MS || '5000', 10),
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

/** Log WhatsApp webhook config at startup (never logs secrets). */
export function logWhatsAppConfig(): void {
  const verifyToken = config.whatsapp.verifyToken;
  const tokenSource = normalizeEnv(process.env.WHATSAPP_VERIFY_TOKEN)
    ? 'WHATSAPP_VERIFY_TOKEN'
    : normalizeEnv(process.env.VERIFY_TOKEN)
      ? 'VERIFY_TOKEN'
      : 'default';
  console.log('[WhatsApp] Webhook URL:', config.whatsapp.webhookUrl);
  console.log('[WhatsApp] Verify token source:', tokenSource);
  console.log('[WhatsApp] Verify token configured:', Boolean(verifyToken));
  console.log('[WhatsApp] Verify token length:', verifyToken.length);
  console.log('[WhatsApp] Expected verify token:', verifyToken);
  console.log('[WhatsApp] App secret configured:', Boolean(config.whatsapp.appSecret));
  console.log('[WhatsApp] Access token configured:', Boolean(config.whatsapp.accessToken));
  console.log('[AI] Provider:', config.ai.provider);
  console.log('[AI] Gemini API key configured:', Boolean(config.ai.geminiApiKey));
}
