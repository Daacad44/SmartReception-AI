import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import { config } from '../../config';
import { prisma } from '../database/prisma';
import { JwtPayload, AuthTokens } from '@smartreception/shared';

export class TokenService {
  generateAccessToken(payload: JwtPayload): string {
    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'],
    });
  }

  generateRefreshToken(userId: string): string {
    return jwt.sign({ userId }, config.jwt.refreshSecret, {
      expiresIn: config.jwt.refreshExpiresIn as jwt.SignOptions['expiresIn'],
    });
  }

  async createTokenPair(
    userId: string,
    email: string,
    businessId?: string,
    role?: string
  ): Promise<AuthTokens> {
    const accessToken = this.generateAccessToken({
      userId,
      email,
      businessId,
      role,
    });

    const refreshToken = this.generateRefreshToken(userId);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.refreshToken.create({
      data: {
        userId,
        token: refreshToken,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  async revokeRefreshToken(token: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { token },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  verifyRefreshToken(token: string): { userId: string } {
    return jwt.verify(token, config.jwt.refreshSecret) as { userId: string };
  }

  generateSecureToken(): string {
    return uuid();
  }
}

export const tokenService = new TokenService();
