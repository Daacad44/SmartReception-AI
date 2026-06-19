import crypto from 'crypto';
import { hashToken } from '../email/token.util';

const OTP_EXPIRY_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 5;

export class OtpService {
  generateCode(): string {
    return crypto.randomInt(100000, 999999).toString();
  }

  hashCode(code: string): string {
    return hashToken(code);
  }

  getExpiry(): Date {
    return new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
  }

  get expiryMinutes(): number {
    return OTP_EXPIRY_MINUTES;
  }

  get maxAttempts(): number {
    return MAX_OTP_ATTEMPTS;
  }

  isExpired(expiresAt: Date | null | undefined): boolean {
    if (!expiresAt) return true;
    return expiresAt < new Date();
  }

  verifyCode(code: string, hash: string | null | undefined): boolean {
    if (!hash) return false;
    return this.hashCode(code) === hash;
  }
}

export const otpService = new OtpService();
