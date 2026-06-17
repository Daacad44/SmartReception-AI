import { authRepository } from './auth.repository';
import { passwordService } from '../../infrastructure/auth/password.service';
import { tokenService } from '../../infrastructure/auth/token.service';
import { emailService } from '../../infrastructure/email/email.service';
import { generateSecureToken, hashToken } from '../../infrastructure/email/token.util';
import {
  ConflictError,
  UnauthorizedError,
  NotFoundError,
  EmailNotVerifiedError,
} from '../../core/errors';
import { RegisterInput, LoginInput } from '@smartreception/shared';
import { prisma } from '../../infrastructure/database/prisma';

const VERIFY_EXPIRY_HOURS = 24;
const RESET_EXPIRY_MINUTES = 15;

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
    const rawVerifyToken = generateSecureToken();
    const emailVerifyExpires = new Date(Date.now() + VERIFY_EXPIRY_HOURS * 60 * 60 * 1000);

    const user = await authRepository.createUser({
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      emailVerifyToken: hashToken(rawVerifyToken),
      emailVerifyExpires,
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

    await emailService.sendVerificationEmail(user.email, rawVerifyToken, {
      firstName: user.firstName,
      businessName: business.name,
    });

    await prisma.auditLog.create({
      data: {
        businessId: business.id,
        userId: user.id,
        action: 'CREATE',
        entity: 'User',
        entityId: user.id,
        newData: { event: 'registration', emailSent: true },
      },
    });

    return {
      message: 'Registration successful. Please check your email to verify your account.',
      email: user.email,
      requiresVerification: true,
    };
  }

  async login(input: LoginInput, ipAddress?: string) {
    const user = await authRepository.findUserByEmail(input.email);
    if (!user || !user.isActive) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const valid = await passwordService.compare(input.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedError('Invalid credentials');
    }

    if (!user.isEmailVerified) {
      throw new EmailNotVerifiedError();
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
        ipAddress,
        newData: { event: 'login' },
      },
    });

    emailService
      .sendLoginAlert(user.email, { firstName: user.firstName, ipAddress })
      .catch(() => undefined);

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
        industry: m.business.industry,
        plan: m.business.subscription?.plan ?? 'STARTER',
      })),
      ...tokens,
    };
  }

  async resendVerification(email: string) {
    const user = await authRepository.findUserByEmail(email);
    if (!user || user.isEmailVerified) {
      return { message: 'If the account exists and is unverified, a new email has been sent' };
    }

    const rawVerifyToken = generateSecureToken();
    const emailVerifyExpires = new Date(Date.now() + VERIFY_EXPIRY_HOURS * 60 * 60 * 1000);

    await authRepository.updateUser(user.id, {
      emailVerifyToken: hashToken(rawVerifyToken),
      emailVerifyExpires,
    });

    await emailService.sendResendVerificationEmail(user.email, rawVerifyToken, user.firstName);

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'UPDATE',
        entity: 'User',
        entityId: user.id,
        newData: { event: 'verification_resent' },
      },
    });

    return { message: 'If the account exists and is unverified, a new email has been sent' };
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

    if (!user.isEmailVerified) {
      throw new EmailNotVerifiedError();
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

    const rawResetToken = generateSecureToken();
    const expires = new Date(Date.now() + RESET_EXPIRY_MINUTES * 60 * 1000);

    await authRepository.updateUser(user.id, {
      resetPasswordToken: hashToken(rawResetToken),
      resetPasswordExpires: expires,
    });

    await emailService.sendPasswordResetEmail(email, rawResetToken, user.firstName);

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'UPDATE',
        entity: 'User',
        entityId: user.id,
        newData: { event: 'password_reset_requested' },
      },
    });
  }

  async resetPassword(token: string, password: string) {
    const user = await prisma.user.findFirst({
      where: {
        resetPasswordToken: hashToken(token),
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

    await tokenService.revokeAllUserTokens(user.id);

    await emailService.sendPasswordChangedEmail(user.email, user.firstName);

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'UPDATE',
        entity: 'User',
        entityId: user.id,
        newData: { event: 'password_reset_completed' },
      },
    });
  }

  async verifyEmail(token: string) {
    const user = await prisma.user.findFirst({
      where: {
        emailVerifyToken: hashToken(token),
        emailVerifyExpires: { gt: new Date() },
      },
      include: {
        businessMemberships: {
          include: { business: true },
          take: 1,
        },
      },
    });

    if (!user) {
      throw new NotFoundError('Invalid or expired verification token');
    }

    await authRepository.updateUser(user.id, {
      isEmailVerified: true,
      emailVerifyToken: null,
      emailVerifyExpires: null,
    });

    const businessName = user.businessMemberships[0]?.business.name ?? 'your business';

    await emailService.sendWelcomeEmail(user.email, {
      firstName: user.firstName,
      businessName,
    });

    await emailService.sendAccountActivatedEmail(user.email, {
      firstName: user.firstName,
      businessName,
    });

    await prisma.auditLog.create({
      data: {
        businessId: user.businessMemberships[0]?.businessId,
        userId: user.id,
        action: 'UPDATE',
        entity: 'User',
        entityId: user.id,
        newData: { event: 'email_verified' },
      },
    });

    return { message: 'Email verified successfully. You can now sign in.' };
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
        industry: m.business.industry,
        plan: m.business.subscription?.plan ?? 'STARTER',
      })),
    };
  }
}

export const authService = new AuthService();
