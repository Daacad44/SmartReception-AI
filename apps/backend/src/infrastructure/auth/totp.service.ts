import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import QRCode from 'qrcode';
import speakeasy from 'speakeasy';

const BACKUP_CODE_COUNT = 8;

export class TotpService {
  generateSecret(): string {
    return speakeasy.generateSecret({ length: 20 }).base32;
  }

  getOtpAuthUrl(email: string, secret: string): string {
    return speakeasy.otpauthURL({
      secret,
      label: email,
      issuer: 'SmartReception AI',
      encoding: 'base32',
    });
  }

  async generateQrCodeDataUrl(otpAuthUrl: string): Promise<string> {
    return QRCode.toDataURL(otpAuthUrl);
  }

  async verifyToken(secret: string, token: string): Promise<boolean> {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: token.replace(/\s/g, ''),
      window: 1,
    });
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
