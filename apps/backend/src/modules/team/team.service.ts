import { teamRepository } from './team.repository';
import { ConflictError, ForbiddenError, NotFoundError } from '../../core/errors';
import { InviteTeamMemberInput, UpdateTeamMemberInput } from '@smartreception/shared';
import { tokenService } from '../../infrastructure/auth/token.service';
import { emailService } from '../../infrastructure/email/email.service';
import { prisma } from '../../infrastructure/database/prisma';
import { billingService } from '../billing/billing.service';
import { UserRole } from '@prisma/client';

export class TeamService {
  async listMembers(businessId: string) {
    const members = await teamRepository.findMembers(businessId);
    return members.map((m) => ({
      id: m.id,
      userId: m.userId,
      role: m.role,
      joinedAt: m.joinedAt,
      user: m.user,
    }));
  }

  async inviteMember(businessId: string, input: InviteTeamMemberInput, invitedBy: string) {
    await billingService.assertWithinLimit(businessId, 'teamMembers');

    const existingMember = await teamRepository.findUserByEmail(input.email);
    if (existingMember) {
      const membership = await teamRepository.findMemberByUserId(businessId, existingMember.id);
      if (membership?.isActive) {
        throw new ConflictError('User is already a team member');
      }
    }

    const existingInvite = await teamRepository.findInvitationByEmail(businessId, input.email);
    if (existingInvite) {
      const token = tokenService.generateSecureToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const invitation = await teamRepository.updateInvitation(existingInvite.id, {
        token,
        expiresAt,
        role: input.role as UserRole,
      });
      const business = await prisma.business.findUnique({ where: { id: businessId } });
      const inviter = await prisma.user.findUnique({ where: { id: invitedBy } });
      await emailService.sendTeamInvitation(input.email, {
        businessName: business?.name || 'SmartReception',
        inviterName: inviter ? `${inviter.firstName} ${inviter.lastName}` : 'A team member',
        role: input.role,
        token,
      });
      return invitation;
    }

    const token = tokenService.generateSecureToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invitation = await teamRepository.createInvitation({
      businessId,
      email: input.email,
      role: input.role as UserRole,
      token,
      expiresAt,
    });

    const business = await prisma.business.findUnique({ where: { id: businessId } });
    const inviter = await prisma.user.findUnique({ where: { id: invitedBy } });

    await emailService.sendTeamInvitation(input.email, {
      businessName: business?.name || 'SmartReception',
      inviterName: inviter ? `${inviter.firstName} ${inviter.lastName}` : 'A team member',
      role: input.role,
      token,
    });

    await prisma.auditLog.create({
      data: {
        businessId,
        userId: invitedBy,
        action: 'CREATE',
        entity: 'TeamInvitation',
        entityId: invitation.id,
        newData: { email: input.email, role: input.role },
      },
    });

    return invitation;
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

    if (actorRole !== 'OWNER' && actorRole !== 'ADMIN') {
      throw new ForbiddenError('Insufficient permissions to update roles');
    }

    const updated = await teamRepository.updateRole(
      businessId,
      memberId,
      input.role as UserRole
    );

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
      throw new ForbiddenError('Cannot remove business owner');
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
    return teamRepository.findInvitations(businessId);
  }

  async acceptInvite(token: string, userId: string) {
    const invitation = await teamRepository.findInvitationByToken(token);
    if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date()) {
      throw new NotFoundError('Invalid or expired invitation');
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new ForbiddenError('Invitation email does not match your account');
    }

    const member = await teamRepository.createMember({
      businessId: invitation.businessId,
      userId,
      role: invitation.role,
    });

    await teamRepository.acceptInvitation(invitation.id);

    await prisma.auditLog.create({
      data: {
        businessId: invitation.businessId,
        userId,
        action: 'CREATE',
        entity: 'BusinessMember',
        entityId: member.id,
        newData: { email: invitation.email, role: invitation.role, via: 'invitation' },
      },
    });

    return {
      businessId: invitation.businessId,
      businessName: invitation.business.name,
      role: invitation.role,
      member,
    };
  }
}

export const teamService = new TeamService();
