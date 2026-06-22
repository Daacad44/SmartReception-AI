import { generateSecret, generateURI, verify } from 'otplib';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import QRCode from 'qrcode';

const BACKUP_CODE_COUNT = 8;

export class TotpService {
  generateSecret(): string {
    return generateSecret();
  }

  getOtpAuthUrl(email: string, secret: string): string {
    return generateURI({ issuer: 'SmartReception AI', label: email, secret });
  }

  async generateQrCodeDataUrl(otpAuthUrl: string): Promise<string> {
    return QRCode.toDataURL(otpAuthUrl);
  }

  async verifyToken(secret: string, token: string): Promise<boolean> {
    const result = await verify({ secret, token: token.replace(/\s/g, '') });
    return result.valid;
  }

  generateBackupCodes(): string[] {
    return Array.from({ length: BACKUP_CODE_COUNT }, () =>
      crypto.randomBytes(4).toString('hex').toUpperCase()
    );
  }

  async hashBackupCodes(codes: string[]): Promise<string> {
    const hashed = await Promise.all(codes.map((c) => bcrypt.hash(c, 12)));
    return JSON.stringify(hashed);
  }

  async consumeBackupCode(storedJson: string | null, code: string): Promise<string | null> {
    if (!storedJson) return null;
    const hashes: string[] = JSON.parse(storedJson);
    for (let i = 0; i < hashes.length; i++) {
      if (await bcrypt.compare(code.toUpperCase(), hashes[i]!)) {
        hashes.splice(i, 1);
        return JSON.stringify(hashes);
      }
    }
    return null;
  }
}

export const totpService = new TotpService();
