import jwt from 'jsonwebtoken';
import { prisma } from '../../infrastructure/database/prisma';
import { totpService } from '../../infrastructure/auth/totp.service';
import { passwordService } from '../../infrastructure/auth/password.service';
import { UnauthorizedError, ValidationError } from '../../core/errors';
import { config } from '../../config';

const TWO_FA_ROLES = new Set(['OWNER', 'ADMIN']);

export class TwoFactorService {
  requiresTwoFactor(role?: string, totpEnabled?: boolean, isSuperAdmin?: boolean): boolean {
    if (totpEnabled) return true;
    if (isSuperAdmin) return true;
    if (role && TWO_FA_ROLES.has(role)) return true;
    return false;
  }

  createTempToken(userId: string, email: string): string {
    return jwt.sign({ userId, email, purpose: '2fa' }, config.jwt.secret, { expiresIn: '5m' });
  }

  verifyTempToken(token: string): { userId: string; email: string } {
    const decoded = jwt.verify(token, config.jwt.secret) as { userId: string; email: string; purpose?: string };
    if (decoded.purpose !== '2fa') throw new UnauthorizedError('Invalid 2FA token');
    return { userId: decoded.userId, email: decoded.email };
  }

  async setup(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedError('User not found');
    if (user.totpEnabled) throw new ValidationError('2FA is already enabled');

    const secret = totpService.generateSecret();
    const otpAuthUrl = totpService.getOtpAuthUrl(user.email, secret);
    const qrCode = await totpService.generateQrCodeDataUrl(otpAuthUrl);
    const backupCodes = totpService.generateBackupCodes();

    await prisma.user.update({
      where: { id: userId },
      data: { totpSecret: secret, totpBackupCodes: await totpService.hashBackupCodes(backupCodes) },
    });

    return { qrCode, otpAuthUrl, backupCodes, secret };
  }

  async confirmSetup(userId: string, code: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.totpSecret) throw new ValidationError('2FA setup not started');

    if (!(await totpService.verifyToken(user.totpSecret, code))) {
      throw new UnauthorizedError('Invalid verification code');
    }

    await prisma.user.update({
      where: { id: userId },
      data: { totpEnabled: true },
    });

    await prisma.auditLog.create({
      data: { userId, action: 'UPDATE', entity: 'User', entityId: userId, newData: { event: '2fa_enabled' } },
    });

    return { enabled: true };
  }

  async verifyLogin(tempToken: string, code: string) {
    const { userId } = this.verifyTempToken(tempToken);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.totpSecret) throw new UnauthorizedError('2FA not configured');

    const validTotp = await totpService.verifyToken(user.totpSecret, code);
    let validBackup = false;
    let updatedBackupCodes = user.totpBackupCodes;

    if (!validTotp && user.totpBackupCodes) {
      updatedBackupCodes = await totpService.consumeBackupCode(user.totpBackupCodes, code);
      validBackup = Boolean(updatedBackupCodes);
      if (validBackup && updatedBackupCodes) {
        await prisma.user.update({ where: { id: userId }, data: { totpBackupCodes: updatedBackupCodes } });
      }
    }

    if (!validTotp && !validBackup) {
      throw new UnauthorizedError('Invalid verification code');
    }

    return user;
  }

  async disable(userId: string, password: string, code: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedError('User not found');

    const validPassword = await passwordService.compare(password, user.passwordHash);
    if (!validPassword) throw new UnauthorizedError('Invalid password');

    if (!user.totpSecret || !(await totpService.verifyToken(user.totpSecret, code))) {
      throw new UnauthorizedError('Invalid verification code');
    }

    await prisma.user.update({
      where: { id: userId },
      data: { totpEnabled: false, totpSecret: null, totpBackupCodes: null },
    });

    await prisma.auditLog.create({
      data: { userId, action: 'UPDATE', entity: 'User', entityId: userId, newData: { event: '2fa_disabled' } },
    });

    return { disabled: true };
  }

  async getStatus(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { totpEnabled: true, isSuperAdmin: true },
    });
    return { enabled: user?.totpEnabled ?? false, isSuperAdmin: user?.isSuperAdmin ?? false };
  }
}

export const twoFactorService = new TwoFactorService();
