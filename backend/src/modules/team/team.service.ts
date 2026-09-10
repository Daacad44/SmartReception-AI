import { teamRepository } from './team.repository';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../core/errors';
import { InviteTeamMemberInput, UpdateTeamMemberInput } from '@smartreception/shared';
import { emailService } from '../../infrastructure/email/email.service';
import { prisma } from '../../infrastructure/database/prisma';
import { billingService } from '../billing/billing.service';
import { InvitationStatus, UserRole } from '@prisma/client';
import { notifyTeam } from '../../infrastructure/notifications/notification-helper';
import { logger } from '../../core/logger';
import { passwordService } from '../../infrastructure/auth/password.service';
import { tokenService } from '../../infrastructure/auth/token.service';
import { authRepository } from '../auth/auth.repository';
import {
  INVITATION_TTL_MS,
  canAssignBusinessRole,
  createInvitationSecret,
  invitationTokenMatches,
  isInvitationAcceptable,
  resolveInvitationStatus,
} from './invitation.policy';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function publicInvitation(invitation: {
  id: string;
  email: string;
  role: UserRole;
  status: InvitationStatus;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  invitedBy?: { firstName: string; lastName: string; email?: string } | null;
}) {
  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    status: resolveInvitationStatus(invitation),
    expiresAt: invitation.expiresAt,
    acceptedAt: invitation.acceptedAt,
    revokedAt: invitation.revokedAt,
    createdAt: invitation.createdAt,
    invitedBy: invitation.invitedBy
      ? `${invitation.invitedBy.firstName} ${invitation.invitedBy.lastName}`.trim()
      : null,
  };
}

export class TeamService {
  async listMembers(businessId: string) {
    const members = await teamRepository.findMembers(businessId);
    return members.map((m) => ({
      id: m.id,
      userId: m.userId,
      role: m.role,
      joinedAt: m.joinedAt,
      isActive: m.isActive,
      user: m.user,
    }));
  }

  async inviteMember(businessId: string, input: InviteTeamMemberInput, invitedBy: string, actorRole?: string) {
    const email = normalizeEmail(input.email);
    if (!canAssignBusinessRole(actorRole, input.role)) {
      throw new ForbiddenError('You cannot invite a member with that role');
    }

    await billingService.assertWithinLimit(businessId, 'teamMembers');

    const existingUser = await teamRepository.findUserByEmail(email);
    if (existingUser) {
      const membership = await teamRepository.findMemberByUserId(businessId, existingUser.id);
      if (membership?.isActive) {
        throw new ConflictError('User is already a team member');
      }
    }

    const existingInvite = await teamRepository.findPendingInvitationByEmail(businessId, email);
    if (existingInvite) {
      return this.resendInvitation(businessId, existingInvite.id, invitedBy, actorRole, input.role as UserRole);
    }

    const { token, tokenHash } = createInvitationSecret();
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);

    const invitation = await teamRepository.createInvitation({
      businessId,
      email,
      role: input.role as UserRole,
      tokenHash,
      expiresAt,
      invitedById: invitedBy,
    });

    try {
      await this.sendInvitationEmail(businessId, invitedBy, email, input.role, token, expiresAt);
    } catch (error) {
      await teamRepository.deleteInvitation(invitation.id).catch(() => undefined);
      logger.error('Team invitation email failed', { error, invitationId: invitation.id });
      throw new ValidationError('Unable to send invitation. Please try again.');
    }

    await prisma.auditLog.create({
      data: {
        businessId,
        userId: invitedBy,
        action: 'CREATE',
        entity: 'TeamInvitation',
        entityId: invitation.id,
        newData: { email, role: input.role },
      },
    });

    if (existingUser) {
      const business = await prisma.business.findUnique({ where: { id: businessId }, select: { name: true } });
      await notifyTeam(
        businessId,
        existingUser.id,
        'Team invitation',
        `You have been invited to join ${business?.name || 'the team'} as ${input.role}`
      );
    }

    return publicInvitation(invitation);
  }

  async resendInvitation(
    businessId: string,
    invitationId: string,
    actorUserId: string,
    actorRole?: string,
    nextRole?: UserRole
  ) {
    const invitation = await teamRepository.findInvitationById(businessId, invitationId);
    if (!invitation) throw new NotFoundError('Invitation not found');

    const status = resolveInvitationStatus(invitation);
    if (status === 'ACCEPTED') throw new ConflictError('Invitation has already been accepted');
    if (status === 'REVOKED') throw new ForbiddenError('Invitation has been revoked');

    const role = nextRole ?? invitation.role;
    if (!canAssignBusinessRole(actorRole, role)) {
      throw new ForbiddenError('You cannot invite a member with that role');
    }

    const { token, tokenHash } = createInvitationSecret();
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);
    const previous = {
      tokenHash: invitation.tokenHash,
      token: invitation.token,
      expiresAt: invitation.expiresAt,
      role: invitation.role,
      status: invitation.status,
      revokedAt: invitation.revokedAt,
    };
    const updated = await teamRepository.updateInvitation(invitation.id, {
      tokenHash,
      token: null,
      expiresAt,
      role,
      status: InvitationStatus.PENDING,
      revokedAt: null,
    });

    try {
      await this.sendInvitationEmail(businessId, actorUserId, invitation.email, role, token, expiresAt);
    } catch (error) {
      await teamRepository.updateInvitation(invitation.id, previous).catch(() => undefined);
      logger.error('Team invitation resend email failed', { error, invitationId: invitation.id });
      throw new ValidationError('Unable to send invitation. Please try again.');
    }

    await prisma.auditLog.create({
      data: {
        businessId,
        userId: actorUserId,
        action: 'UPDATE',
        entity: 'TeamInvitation',
        entityId: invitation.id,
        newData: { email: invitation.email, role, resent: true },
      },
    });

    return publicInvitation(updated);
  }

  async revokeInvitation(businessId: string, invitationId: string, actorUserId: string) {
    const invitation = await teamRepository.findInvitationById(businessId, invitationId);
    if (!invitation) throw new NotFoundError('Invitation not found');
    if (resolveInvitationStatus(invitation) !== 'PENDING') {
      throw new ConflictError('Only pending invitations can be revoked');
    }

    const updated = await teamRepository.updateInvitation(invitation.id, {
      status: InvitationStatus.REVOKED,
      revokedAt: new Date(),
      token: null,
    });

    await prisma.auditLog.create({
      data: {
        businessId,
        userId: actorUserId,
        action: 'DELETE',
        entity: 'TeamInvitation',
        entityId: invitation.id,
        newData: { email: invitation.email, revoked: true },
      },
    });

    return publicInvitation(updated);
  }

  async previewInvitation(token: string) {
    if (!token || token.trim().length < 16) {
      throw new ValidationError('Invalid invitation token');
    }
    const invitation = await this.loadValidTokenRecord(token);
    const status = resolveInvitationStatus(invitation);
    const existing = await teamRepository.findUserByEmail(invitation.email);
    return {
      email: invitation.email,
      role: invitation.role,
      status,
      acceptable: isInvitationAcceptable(invitation),
      accountExists: Boolean(existing),
      expiresAt: invitation.expiresAt,
      businessName: invitation.business.name,
      inviterName: invitation.invitedBy
        ? `${invitation.invitedBy.firstName} ${invitation.invitedBy.lastName}`.trim()
        : null,
    };
  }

  async updateRole(
    businessId: string,
    memberId: string,
    input: UpdateTeamMemberInput,
    actorUserId: string,
    actorRole?: string
  ) {
    const member = await teamRepository.findMember(businessId, memberId);
    if (!member) {
      throw new NotFoundError('Team member not found');
    }

    if (member.role === 'OWNER') {
      throw new ForbiddenError('Cannot change owner role');
    }

    if (member.userId === actorUserId) {
      throw new ForbiddenError('Cannot change your own role');
    }

    if (!canAssignBusinessRole(actorRole, input.role)) {
      throw new ForbiddenError('Insufficient permissions to assign that role');
    }

    const updated = await teamRepository.updateRole(businessId, memberId, input.role as UserRole);

    await prisma.auditLog.create({
      data: {
        businessId,
        userId: actorUserId,
        action: 'UPDATE',
        entity: 'BusinessMember',
        entityId: memberId,
        newData: { role: input.role },
      },
    });

    return updated;
  }

  async removeMember(
    businessId: string,
    memberId: string,
    actorUserId: string,
    actorRole?: string
  ) {
    const member = await teamRepository.findMember(businessId, memberId);
    if (!member) {
      throw new NotFoundError('Team member not found');
    }

    if (member.role === 'OWNER') {
      const owners = await teamRepository.countActiveOwners(businessId);
      if (owners <= 1) {
        throw new ForbiddenError('This business must have at least one owner. Transfer ownership before removing this member.');
      }
      if (actorRole !== 'OWNER') {
        throw new ForbiddenError('Cannot remove business owner');
      }
    }

    if (member.userId === actorUserId) {
      throw new ForbiddenError('Cannot remove yourself');
    }

    if (actorRole !== 'OWNER' && actorRole !== 'ADMIN') {
      throw new ForbiddenError('Insufficient permissions to remove members');
    }

    await teamRepository.removeMember(businessId, memberId);

    await prisma.auditLog.create({
      data: {
        businessId,
        userId: actorUserId,
        action: 'DELETE',
        entity: 'BusinessMember',
        entityId: memberId,
      },
    });
  }

  async listInvitations(businessId: string) {
    const invitations = await teamRepository.findInvitations(businessId);
    return invitations.map((invitation) => publicInvitation(invitation));
  }

  async acceptInvite(token: string, userId: string) {
    const invitation = await this.loadValidTokenRecord(token);
    if (!isInvitationAcceptable(invitation)) {
      throw new NotFoundError('Invalid or expired invitation');
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new ForbiddenError('Invitation email does not match your account');
    }

    const existing = await teamRepository.findMemberByUserId(invitation.businessId, userId);
    if (existing?.isActive) {
      await teamRepository.updateInvitation(invitation.id, {
        status: InvitationStatus.ACCEPTED,
        acceptedAt: existing.joinedAt ?? new Date(),
        token: null,
      });
      throw new ConflictError('You are already a team member of this business');
    }

    const result = await prisma.$transaction(async (tx) => {
      const member = await tx.businessMember.upsert({
        where: {
          businessId_userId: { businessId: invitation.businessId, userId },
        },
        create: {
          businessId: invitation.businessId,
          userId,
          role: invitation.role,
          isActive: true,
        },
        update: { role: invitation.role, isActive: true },
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      });
      await tx.teamInvitation.update({
        where: { id: invitation.id },
        data: {
          status: InvitationStatus.ACCEPTED,
          acceptedAt: new Date(),
          token: null,
        },
      });
      await tx.auditLog.create({
        data: {
          businessId: invitation.businessId,
          userId,
          action: 'CREATE',
          entity: 'BusinessMember',
          entityId: member.id,
          newData: { email: invitation.email, role: invitation.role, via: 'invitation' },
        },
      });
      return member;
    });

    const tokens = await tokenService.createTokenPair(
      userId,
      user.email,
      invitation.businessId,
      invitation.role
    );

    return {
      businessId: invitation.businessId,
      businessName: invitation.business.name,
      role: invitation.role,
      member: result,
      tokens,
      requiresOnboarding: !invitation.business.onboardingCompletedAt,
    };
  }

  async registerFromInvite(input: {
    token: string;
    firstName: string;
    lastName: string;
    password: string;
  }) {
    const invitation = await this.loadValidTokenRecord(input.token);
    if (!isInvitationAcceptable(invitation)) {
      throw new NotFoundError('Invalid or expired invitation');
    }

    const existing = await teamRepository.findUserByEmail(invitation.email);
    if (existing) {
      throw new ConflictError('An account already exists for this email. Sign in to accept the invitation.');
    }

    const passwordHash = await passwordService.hash(input.password);
    const user = await authRepository.createUser({
      email: invitation.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      isEmailVerified: true,
      approvalStatus: 'ACTIVE',
    });

    try {
      return await this.acceptInvite(input.token, user.id);
    } catch (error) {
      await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
      throw error;
    }
  }

  private async loadValidTokenRecord(token: string) {
    const invitation = await teamRepository.findInvitationByPresentedToken(token);
    if (!invitation || !invitationTokenMatches(token, invitation.tokenHash, invitation.token)) {
      throw new NotFoundError('Invalid or expired invitation');
    }
    return invitation;
  }

  private async sendInvitationEmail(
    businessId: string,
    invitedBy: string,
    email: string,
    role: string,
    token: string,
    expiresAt: Date
  ) {
    const [business, inviter] = await Promise.all([
      prisma.business.findUnique({ where: { id: businessId }, select: { name: true } }),
      prisma.user.findUnique({ where: { id: invitedBy }, select: { firstName: true, lastName: true } }),
    ]);
    await emailService.sendTeamInvitation(email, {
      businessName: business?.name || 'SomReception AI',
      inviterName: inviter ? `${inviter.firstName} ${inviter.lastName}` : 'A team member',
      role,
      token,
      expiresAt,
    });
  }
}

export const teamService = new TeamService();
