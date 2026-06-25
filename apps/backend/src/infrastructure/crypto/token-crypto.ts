import crypto from 'crypto';
import { config } from '../../config';

const ALGORITHM = 'aes-256-gcm';
const PREFIX = 'enc:v1:';

function getEncryptionKey(): Buffer {
  const secret =
    process.env.TOKEN_ENCRYPTION_KEY ||
    process.env.JWT_SECRET ||
    'dev-secret-change-me';
  return crypto.createHash('sha256').update(secret).digest();
}

export function isEncryptedToken(value: string): boolean {
  return value.startsWith(PREFIX);
}

export function encryptToken(plainText: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64url')}:${tag.toString('base64url')}:${encrypted.toString('base64url')}`;
}

export function decryptToken(stored: string): string {
  if (!isEncryptedToken(stored)) {
    return stored;
  }

  const payload = stored.slice(PREFIX.length);
  const [ivB64, tagB64, dataB64] = payload.split(':');
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('Invalid encrypted token format');
  }

  const iv = Buffer.from(ivB64, 'base64url');
  const tag = Buffer.from(tagB64, 'base64url');
  const data = Buffer.from(dataB64, 'base64url');
  const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export function resolveStoredToken(stored: string | null | undefined): string | undefined {
  if (!stored) return undefined;
  try {
    return decryptToken(stored);
  } catch {
    if (config.env === 'production') {
      return undefined;
    }
    return stored;
  }
}
