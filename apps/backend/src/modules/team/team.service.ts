import { teamRepository } from './team.repository';
import { ConflictError, ForbiddenError, NotFoundError } from '../../core/errors';
import { InviteTeamMemberInput, UpdateTeamMemberInput } from '@smartreception/shared';
import { tokenService } from '../../infrastructure/auth/token.service';
import { emailService } from '../../infrastructure/email/email.service';
import { prisma } from '../../infrastructure/database/prisma';
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
    const existingMember = await teamRepository.findUserByEmail(input.email);
    if (existingMember) {
      const membership = await teamRepository.findMemberByUserId(businessId, existingMember.id);
      if (membership?.isActive) {
        throw new ConflictError('User is already a team member');
      }
    }

    const existingInvite = await teamRepository.findInvitationByEmail(businessId, input.email);
    if (existingInvite) {
      throw new ConflictError('Invitation already sent to this email');
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

    await emailService.sendTeamInvitation(input.email, business?.name || 'SmartReception', token);

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
}

export const teamService = new TeamService();
