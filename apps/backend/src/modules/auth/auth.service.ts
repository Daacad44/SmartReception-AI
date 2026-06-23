import { authRepository } from './auth.repository';
import { passwordService } from '../../infrastructure/auth/password.service';
import { tokenService } from '../../infrastructure/auth/token.service';
import { emailService } from '../../infrastructure/email/email.service';
import { otpService } from '../../infrastructure/auth/otp.service';
import {
  ConflictError,
  UnauthorizedError,
  NotFoundError,
  EmailNotVerifiedError,
  ValidationError,
} from '../../core/errors';
import { RegisterInput, LoginInput } from '@smartreception/shared';
import { prisma } from '../../infrastructure/database/prisma';
import {
  assertLoginAllowed,
  recordFailedLogin,
  clearLoginAttempts,
} from '../../infrastructure/auth/login-lockout.service';
import { twoFactorService } from '../two-factor/two-factor.service';

export class AuthService {
  async register(input: RegisterInput) {
    const existing = await authRepository.findUserByEmail(input.email);
    if (existing) {
      throw new ConflictError('Email already registered');
    }

    const passwordHash = await passwordService.hash(input.password);
    const otpCode = otpService.generateCode();

    const user = await authRepository.createUser({
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      emailOtpHash: otpService.hashCode(otpCode),
      emailOtpExpires: otpService.getExpiry(),
      emailOtpAttempts: 0,
    });

    await emailService.sendOtpEmail(user.email, otpCode, user.firstName, 'verification');

    return {
      message: 'Registration successful. Please verify your email to continue.',
      email: user.email,
      requiresVerification: true,
    };
  }

  async checkEmailAvailability(email: string) {
    const existing = await authRepository.findUserByEmail(email);
    return { available: !existing };
  }

  async login(input: LoginInput, ipAddress?: string) {
    assertLoginAllowed(input.email, ipAddress);

    const user = await authRepository.findUserByEmail(input.email);
    if (!user || !user.isActive) {
      recordFailedLogin(input.email, ipAddress);
      throw new UnauthorizedError('Invalid credentials');
    }

    const valid = await passwordService.compare(input.password, user.passwordHash);
    if (!valid) {
      recordFailedLogin(input.email, ipAddress);
      throw new UnauthorizedError('Invalid credentials');
    }

    clearLoginAttempts(input.email, ipAddress);

    if (!user.isEmailVerified) {
      throw new EmailNotVerifiedError();
    }

    const memberships = await authRepository.getUserBusinesses(user.id);
    const primaryMembership = memberships[0];

    const mustVerify2fa = twoFactorService.requiresTwoFactor(
      primaryMembership?.role,
      user.totpEnabled,
      user.isSuperAdmin
    );

    if (mustVerify2fa && user.totpEnabled) {
      const tempToken = twoFactorService.createTempToken(user.id, user.email);
      return {
        requiresTwoFactor: true,
        tempToken,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      };
    }

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

    const needsOnboarding =
      memberships.length === 0 || !memberships[0]?.business.onboardingCompletedAt;

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
        plan: m.business.subscription?.plan ?? 'FREE',
      })),
      isSuperAdmin: user.isSuperAdmin,
      requiresOnboarding: needsOnboarding,
      ...tokens,
    };
  }

  async verifyTwoFactorLogin(tempToken: string, code: string, ipAddress?: string) {
    const user = await twoFactorService.verifyLogin(tempToken, code);
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
        newData: { event: 'login_2fa' },
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
        industry: m.business.industry,
        plan: m.business.subscription?.plan ?? 'FREE',
      })),
      isSuperAdmin: user.isSuperAdmin,
      requiresOnboarding:
        memberships.length === 0 || !memberships[0]?.business.onboardingCompletedAt,
      ...tokens,
    };
  }

  async resendOtp(email: string) {
    const user = await authRepository.findUserByEmail(email);
    if (!user || user.isEmailVerified) {
      return { message: 'If the account exists and is unverified, a new code has been sent' };
    }

    const otpCode = otpService.generateCode();

    await authRepository.updateUser(user.id, {
      emailOtpHash: otpService.hashCode(otpCode),
      emailOtpExpires: otpService.getExpiry(),
      emailOtpAttempts: 0,
    });

    await emailService.sendOtpEmail(user.email, otpCode, user.firstName, 'verification');

    return { message: 'If the account exists and is unverified, a new code has been sent' };
  }

  async verifyOtp(email: string, code: string) {
    const user = await authRepository.findUserByEmail(email);
    if (!user) {
      throw new NotFoundError('Invalid verification code');
    }

    if (user.isEmailVerified) {
      const memberships = await authRepository.getUserBusinesses(user.id);
      const tokens = await tokenService.createTokenPair(
        user.id,
        user.email,
        memberships[0]?.businessId,
        memberships[0]?.role
      );
      return {
        message: 'Email already verified.',
        requiresOnboarding:
          memberships.length === 0 || !memberships[0]?.business.onboardingCompletedAt,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
        businesses: memberships.map((m) => ({
          id: m.business.id,
          name: m.business.name,
          slug: m.business.slug,
          role: m.role,
          industry: m.business.industry,
          plan: m.business.subscription?.plan ?? 'FREE',
        })),
        ...tokens,
      };
    }

    if ((user.emailOtpAttempts ?? 0) >= otpService.maxAttempts) {
      throw new ValidationError('Too many failed attempts. Request a new code.');
    }

    if (otpService.isExpired(user.emailOtpExpires) || !otpService.verifyCode(code, user.emailOtpHash)) {
      await authRepository.updateUser(user.id, {
        emailOtpAttempts: (user.emailOtpAttempts ?? 0) + 1,
      });
      throw new ValidationError('Invalid or expired verification code');
    }

    await authRepository.updateUser(user.id, {
      isEmailVerified: true,
      emailOtpHash: null,
      emailOtpExpires: null,
      emailOtpAttempts: 0,
    });

    const memberships = await authRepository.getUserBusinesses(user.id);
    const businessName = memberships[0]?.business.name ?? 'your business';

    await emailService.sendWelcomeEmail(user.email, {
      firstName: user.firstName,
      businessName,
    });

    const tokens = await tokenService.createTokenPair(
      user.id,
      user.email,
      memberships[0]?.businessId,
      memberships[0]?.role
    );

    const needsOnboarding =
      memberships.length === 0 || !memberships[0]?.business.onboardingCompletedAt;

    return {
      message: 'Email verified successfully.',
      requiresOnboarding: needsOnboarding,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      businesses: memberships.map((m) => ({
        id: m.business.id,
        name: m.business.name,
        slug: m.business.slug,
        role: m.role,
        industry: m.business.industry,
        plan: m.business.subscription?.plan ?? 'FREE',
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

  async logout(refreshToken?: string, userId?: string) {
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

    const otpCode = otpService.generateCode();

    await authRepository.updateUser(user.id, {
      resetOtpHash: otpService.hashCode(otpCode),
      resetOtpExpires: otpService.getExpiry(),
      resetOtpAttempts: 0,
    });

    await emailService.sendOtpEmail(email, otpCode, user.firstName, 'password_reset');
  }

  async resetPassword(email: string, code: string, password: string) {
    const user = await authRepository.findUserByEmail(email);
    if (!user) {
      throw new NotFoundError('Invalid or expired reset code');
    }

    if ((user.resetOtpAttempts ?? 0) >= otpService.maxAttempts) {
      throw new ValidationError('Too many failed attempts. Request a new code.');
    }

    if (otpService.isExpired(user.resetOtpExpires) || !otpService.verifyCode(code, user.resetOtpHash)) {
      await authRepository.updateUser(user.id, {
        resetOtpAttempts: (user.resetOtpAttempts ?? 0) + 1,
      });
      throw new ValidationError('Invalid or expired reset code');
    }

    const passwordHash = await passwordService.hash(password);
    await authRepository.updateUser(user.id, {
      passwordHash,
      resetOtpHash: null,
      resetOtpExpires: null,
      resetOtpAttempts: 0,
      resetPasswordToken: null,
      resetPasswordExpires: null,
    });

    await tokenService.revokeAllUserTokens(user.id);
    await emailService.sendPasswordChangedEmail(user.email, user.firstName);
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
      isSuperAdmin: user.isSuperAdmin,
      welcomeSeen: Boolean(user.welcomeSeenAt),
      needsOnboarding: memberships.length === 0 || !memberships[0]?.business.onboardingCompletedAt,
      onboardingCompleted: memberships.length > 0 && Boolean(memberships[0]?.business.onboardingCompletedAt),
      businesses: memberships.map((m) => ({
        id: m.business.id,
        name: m.business.name,
        slug: m.business.slug,
        role: m.role,
        industry: m.business.industry,
        plan: m.business.subscription?.plan ?? 'FREE',
      })),
    };
  }
}

export const authService = new AuthService();
