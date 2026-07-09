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
  ApplicationPendingError,
  ApplicationAwaitingCodeError,
  ApplicationRejectedError,
} from '../../core/errors';
import { RegisterInput, LoginInput } from '@smartreception/shared';

// Activation codes (sent after Super Admin approval) live longer than the
// 10-minute email OTP so a business has time to act after being approved.
const APPROVAL_CODE_EXPIRY_MINUTES = 30;
function approvalCodeExpiry(): Date {
  return new Date(Date.now() + APPROVAL_CODE_EXPIRY_MINUTES * 60 * 1000);
}
import { prisma } from '../../infrastructure/database/prisma';
import {
  assertLoginAllowed,
  recordFailedLogin,
  clearLoginAttempts,
} from '../../infrastructure/auth/login-lockout.service';
import { twoFactorService } from '../two-factor/two-factor.service';

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

    // New businesses are held for Super Admin approval — no auto-activation and
    // no business is created until the applicant enters the approval code.
    const user = await authRepository.createUser({
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      pendingBusinessName: input.businessName,
      approvalStatus: 'PENDING',
    });

    await emailService
      .sendApplicationReceivedEmail(user.email, user.firstName, input.businessName)
      .catch(() => undefined);

    return {
      message:
        'Application submitted. A Super Admin will review your business shortly and email you an activation code.',
      email: user.email,
      requiresApproval: true,
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

    // Business application / approval gate.
    if (user.approvalStatus === 'PENDING') {
      throw new ApplicationPendingError();
    }
    if (user.approvalStatus === 'REJECTED') {
      throw new ApplicationRejectedError(
        user.rejectionReason
          ? `Your application was declined: ${user.rejectionReason}`
          : undefined
      );
    }
    if (user.approvalStatus === 'APPROVED') {
      throw new ApplicationAwaitingCodeError();
    }

    if (!user.isEmailVerified) {
      throw new EmailNotVerifiedError();
    }

    const memberships = await authRepository.getUserBusinesses(user.id);
    const primaryMembership = memberships[0];

    if (primaryMembership && !user.isSuperAdmin) {
      const { validateBusinessLicense } = await import(
        '../subscription/subscription-license.service'
      );
      const license = await validateBusinessLicense(primaryMembership.businessId);
      if (!license.valid) {
        const { ForbiddenError } = await import('../../core/errors');
        throw new ForbiddenError(
          license.reason ?? 'Subscription expired. Please contact SmartReception support.'
        );
      }
    }

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
      approvalStatus: 'ACTIVE',
      emailOtpHash: null,
      emailOtpExpires: null,
      emailOtpAttempts: 0,
    });

    return this.completeActivation(user.id, 'Email verified successfully.');
  }

  /**
   * Creates the applicant's business (if they don't have one yet), sends the
   * welcome email and issues a token pair. Shared by email-OTP verification and
   * the Super Admin approval-code activation flow.
   */
  private async completeActivation(userId: string, message: string) {
    const user = await authRepository.findUserById(userId);
    if (!user) throw new NotFoundError('User not found');

    let memberships = await authRepository.getUserBusinesses(user.id);

    if (memberships.length === 0) {
      const businessName =
        user.pendingBusinessName?.trim() ||
        [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
        user.email.split('@')[0] ||
        'Ganacsigayga';

      let slug = slugify(businessName) || `business-${user.id.slice(0, 8)}`;
      const existingSlug = await prisma.business.findUnique({ where: { slug } });
      if (existingSlug) slug = `${slug}-${Date.now()}`;

      try {
        await authRepository.createBusinessWithOwner(user.id, {
          name: businessName,
          slug,
          phone: user.phone ?? undefined,
          onboardingStep: 0,
        });
        await authRepository.updateUser(user.id, { pendingBusinessName: null });
      } catch {
        /* business may already exist from a concurrent request */
      }
      memberships = await authRepository.getUserBusinesses(user.id);
    }

    const businessName = memberships[0]?.business.name ?? 'ganacsigaaga';

    await emailService
      .sendWelcomeEmail(user.email, { firstName: user.firstName, businessName })
      .catch(() => undefined);

    const tokens = await tokenService.createTokenPair(
      user.id,
      user.email,
      memberships[0]?.businessId,
      memberships[0]?.role
    );

    const needsOnboarding =
      memberships.length === 0 || !memberships[0]?.business.onboardingCompletedAt;

    return {
      message,
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

  /**
   * Applicant enters the activation code emailed after Super Admin approval.
   * Activates the account, creates the business and logs them in.
   */
  async verifyApprovalCode(email: string, code: string) {
    const user = await authRepository.findUserByEmail(email);
    if (!user) {
      throw new NotFoundError('Invalid activation code');
    }

    if (user.approvalStatus === 'ACTIVE') {
      return this.completeActivation(user.id, 'Account already activated.');
    }

    if (user.approvalStatus === 'PENDING') {
      throw new ApplicationPendingError();
    }

    if (user.approvalStatus === 'REJECTED') {
      throw new ApplicationRejectedError(
        user.rejectionReason
          ? `Your application was declined: ${user.rejectionReason}`
          : undefined
      );
    }

    if ((user.approvalCodeAttempts ?? 0) >= otpService.maxAttempts) {
      throw new ValidationError('Too many failed attempts. Request a new activation code.');
    }

    if (
      otpService.isExpired(user.approvalCodeExpires) ||
      !otpService.verifyCode(code, user.approvalCodeHash)
    ) {
      await authRepository.updateUser(user.id, {
        approvalCodeAttempts: (user.approvalCodeAttempts ?? 0) + 1,
      });
      throw new ValidationError('Invalid or expired activation code');
    }

    await authRepository.updateUser(user.id, {
      approvalStatus: 'ACTIVE',
      isEmailVerified: true,
      approvalCodeHash: null,
      approvalCodeExpires: null,
      approvalCodeAttempts: 0,
    });

    return this.completeActivation(user.id, 'Account activated successfully.');
  }

  /**
   * Resends a fresh activation code — used when the previous one expired.
   * Only valid for approved applications awaiting activation.
   */
  async resendApprovalCode(email: string) {
    const user = await authRepository.findUserByEmail(email);
    const genericMessage = {
      message: 'If your application has been approved, a new activation code has been sent.',
    };
    if (!user || user.approvalStatus !== 'APPROVED') {
      return genericMessage;
    }

    const code = otpService.generateCode();
    await authRepository.updateUser(user.id, {
      approvalCodeHash: otpService.hashCode(code),
      approvalCodeExpires: approvalCodeExpiry(),
      approvalCodeAttempts: 0,
    });

    await emailService
      .sendApprovalCodeEmail(user.email, code, user.firstName, {
        businessName: user.pendingBusinessName ?? undefined,
        expiryMinutes: APPROVAL_CODE_EXPIRY_MINUTES,
      })
      .catch(() => undefined);

    return genericMessage;
  }

  // ── Super Admin approval actions ──────────────────────────────────────────

  async listApplications(status: 'PENDING' | 'APPROVED' | 'REJECTED' = 'PENDING') {
    const users = await authRepository.findUsersByApprovalStatus(status);
    return users.map((u) => ({
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      phone: u.phone,
      businessName: u.pendingBusinessName,
      approvalStatus: u.approvalStatus,
      approvalCodeExpires: u.approvalCodeExpires,
      rejectionReason: u.rejectionReason,
      appliedAt: u.createdAt,
      approvedAt: u.approvedAt,
    }));
  }

  async approveApplication(userId: string, adminId: string) {
    const user = await authRepository.findUserById(userId);
    if (!user) throw new NotFoundError('Applicant not found');
    if (user.approvalStatus === 'ACTIVE') {
      throw new ValidationError('This account is already active.');
    }

    const code = otpService.generateCode();
    await authRepository.updateUser(user.id, {
      approvalStatus: 'APPROVED',
      approvalCodeHash: otpService.hashCode(code),
      approvalCodeExpires: approvalCodeExpiry(),
      approvalCodeAttempts: 0,
      approvedAt: new Date(),
      approvedById: adminId,
      rejectionReason: null,
    });

    await emailService
      .sendApprovalCodeEmail(user.email, code, user.firstName, {
        businessName: user.pendingBusinessName ?? undefined,
        expiryMinutes: APPROVAL_CODE_EXPIRY_MINUTES,
      })
      .catch(() => undefined);

    return { message: 'Application approved. Activation code sent to the applicant.' };
  }

  async rejectApplication(userId: string, reason?: string) {
    const user = await authRepository.findUserById(userId);
    if (!user) throw new NotFoundError('Applicant not found');
    if (user.approvalStatus === 'ACTIVE') {
      throw new ValidationError('Cannot reject an already active account.');
    }

    await authRepository.updateUser(user.id, {
      approvalStatus: 'REJECTED',
      rejectionReason: reason ?? null,
      approvalCodeHash: null,
      approvalCodeExpires: null,
      approvalCodeAttempts: 0,
    });

    await emailService
      .sendApplicationRejectedEmail(user.email, user.firstName, reason)
      .catch(() => undefined);

    return { message: 'Application rejected.' };
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
