import { authRepository } from './auth.repository';
import { passwordService } from '../../infrastructure/auth/password.service';
import { tokenService } from '../../infrastructure/auth/token.service';
import { emailService } from '../../infrastructure/email/email.service';
import { ConflictError, UnauthorizedError, NotFoundError } from '../../core/errors';
import { RegisterInput, LoginInput } from '@smartreception/shared';
import { prisma } from '../../infrastructure/database/prisma';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export class AuthService {
  async register(input: RegisterInput) {
    const existing = await authRepository.findUserByEmail(input.email);
    if (existing) {
      throw new ConflictError('Email already registered');
    }

    const passwordHash = await passwordService.hash(input.password);
    const emailVerifyToken = tokenService.generateSecureToken();

    const user = await authRepository.createUser({
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      emailVerifyToken,
    });

    let slug = slugify(input.businessName);
    const existingSlug = await prisma.business.findUnique({ where: { slug } });
    if (existingSlug) {
      slug = `${slug}-${Date.now()}`;
    }

    const { business } = await authRepository.createBusinessWithOwner(user.id, {
      name: input.businessName,
      slug,
      industry: input.industry,
    });

    await emailService.sendVerificationEmail(user.email, emailVerifyToken);

    const tokens = await tokenService.createTokenPair(
      user.id,
      user.email,
      business.id,
      'OWNER'
    );

    await prisma.auditLog.create({
      data: {
        businessId: business.id,
        userId: user.id,
        action: 'CREATE',
        entity: 'User',
        entityId: user.id,
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      business: {
        id: business.id,
        name: business.name,
        slug: business.slug,
      },
      ...tokens,
    };
  }

  async login(input: LoginInput) {
    const user = await authRepository.findUserByEmail(input.email);
    if (!user || !user.isActive) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const valid = await passwordService.compare(input.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const memberships = await authRepository.getUserBusinesses(user.id);
    const primaryMembership = memberships[0];

    await authRepository.updateUser(user.id, { lastLoginAt: new Date() });

    const tokens = await tokenService.createTokenPair(
      user.id,
      user.email,
      primaryMembership?.businessId,
      primaryMembership?.role
    );

    await prisma.auditLog.create({
      data: {
        businessId: primaryMembership?.businessId,
        userId: user.id,
        action: 'LOGIN',
        entity: 'User',
        entityId: user.id,
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
      },
      businesses: memberships.map((m) => ({
        id: m.business.id,
        name: m.business.name,
        slug: m.business.slug,
        role: m.role,
      })),
      ...tokens,
    };
  }

  async refresh(refreshToken: string) {
    const stored = await authRepository.findRefreshToken(refreshToken);
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const decoded = tokenService.verifyRefreshToken(refreshToken);
    const user = await authRepository.findUserById(decoded.userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedError('User not found');
    }

    await tokenService.revokeRefreshToken(refreshToken);

    const memberships = await authRepository.getUserBusinesses(user.id);
    const primaryMembership = memberships[0];

    return tokenService.createTokenPair(
      user.id,
      user.email,
      primaryMembership?.businessId,
      primaryMembership?.role
    );
  }

  async logout(refreshToken: string, userId?: string) {
    if (refreshToken) {
      await tokenService.revokeRefreshToken(refreshToken);
    }
    if (userId) {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'LOGOUT',
          entity: 'User',
          entityId: userId,
        },
      });
    }
  }

  async forgotPassword(email: string) {
    const user = await authRepository.findUserByEmail(email);
    if (!user) return;

    const resetToken = tokenService.generateSecureToken();
    const expires = new Date(Date.now() + 60 * 60 * 1000);

    await authRepository.updateUser(user.id, {
      resetPasswordToken: resetToken,
      resetPasswordExpires: expires,
    });

    await emailService.sendPasswordResetEmail(email, resetToken);
  }

  async resetPassword(token: string, password: string) {
    const user = await prisma.user.findFirst({
      where: {
        resetPasswordToken: token,
        resetPasswordExpires: { gt: new Date() },
      },
    });

    if (!user) {
      throw new NotFoundError('Invalid or expired reset token');
    }

    const passwordHash = await passwordService.hash(password);
    await authRepository.updateUser(user.id, {
      passwordHash,
      resetPasswordToken: null,
      resetPasswordExpires: null,
    });
  }

  async verifyEmail(token: string) {
    const user = await prisma.user.findFirst({
      where: { emailVerifyToken: token },
    });

    if (!user) {
      throw new NotFoundError('Invalid verification token');
    }

    await authRepository.updateUser(user.id, {
      isEmailVerified: true,
      emailVerifyToken: null,
    });
  }

  async switchBusiness(userId: string, businessId: string) {
    const membership = await prisma.businessMember.findUnique({
      where: { businessId_userId: { businessId, userId } },
      include: { business: true, user: true },
    });

    if (!membership) {
      throw new NotFoundError('Business membership not found');
    }

    return tokenService.createTokenPair(
      userId,
      membership.user.email,
      businessId,
      membership.role
    );
  }

  async getProfile(userId: string) {
    const user = await authRepository.findUserById(userId);
    if (!user) throw new NotFoundError('User not found');

    const memberships = await authRepository.getUserBusinesses(userId);

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      isEmailVerified: user.isEmailVerified,
      businesses: memberships.map((m) => ({
        id: m.business.id,
        name: m.business.name,
        slug: m.business.slug,
        role: m.role,
      })),
    };
  }
}

export const authService = new AuthService();
