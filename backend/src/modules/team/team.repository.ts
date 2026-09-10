import { prisma } from '../../infrastructure/database/prisma';
import { InvitationStatus, UserRole } from '@prisma/client';
import { hashInvitationToken } from './invitation.policy';

export class TeamRepository {
  async findMembers(businessId: string) {
    return prisma.businessMember.findMany({
      where: { businessId, isActive: true },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            lastLoginAt: true,
            isActive: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });
  }

  async findMember(businessId: string, memberId: string) {
    return prisma.businessMember.findFirst({
      where: { id: memberId, businessId, isActive: true },
      include: { user: true },
    });
  }

  async findMemberByUserId(businessId: string, userId: string) {
    return prisma.businessMember.findUnique({
      where: { businessId_userId: { businessId, userId } },
    });
  }

  async countActiveOwners(businessId: string) {
    return prisma.businessMember.count({
      where: { businessId, role: 'OWNER', isActive: true },
    });
  }

  async updateRole(businessId: string, memberId: string, role: UserRole) {
    return prisma.businessMember.update({
      where: { id: memberId, businessId },
      data: { role },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true },
        },
      },
    });
  }

  async removeMember(businessId: string, memberId: string) {
    return prisma.businessMember.update({
      where: { id: memberId, businessId },
      data: { isActive: false },
    });
  }

  async createInvitation(data: {
    businessId: string;
    email: string;
    role: UserRole;
    tokenHash: string;
    expiresAt: Date;
    invitedById?: string;
  }) {
    return prisma.teamInvitation.create({
      data: {
        businessId: data.businessId,
        email: data.email,
        role: data.role,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
        invitedById: data.invitedById,
        status: InvitationStatus.PENDING,
      },
    });
  }

  async findInvitations(businessId: string) {
    return prisma.teamInvitation.findMany({
      where: { businessId },
      include: {
        invitedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async findPendingInvitationByEmail(businessId: string, email: string) {
    return prisma.teamInvitation.findFirst({
      where: {
        businessId,
        email,
        status: InvitationStatus.PENDING,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
  }

  async findInvitationById(businessId: string, invitationId: string) {
    return prisma.teamInvitation.findFirst({
      where: { id: invitationId, businessId },
    });
  }

  async findInvitationByPresentedToken(token: string) {
    const tokenHash = hashInvitationToken(token);
    return prisma.teamInvitation.findFirst({
      where: {
        OR: [{ tokenHash }, { tokenHash: token }, { token }],
      },
      include: {
        business: { select: { id: true, name: true, onboardingCompletedAt: true } },
        invitedBy: { select: { firstName: true, lastName: true } },
      },
    });
  }

  async updateInvitation(
    id: string,
    data: {
      tokenHash?: string;
      token?: string | null;
      expiresAt?: Date;
      role?: UserRole;
      status?: InvitationStatus;
      acceptedAt?: Date | null;
      revokedAt?: Date | null;
    }
  ) {
    return prisma.teamInvitation.update({
      where: { id },
      data,
    });
  }

  async deleteInvitation(id: string) {
    return prisma.teamInvitation.delete({ where: { id } });
  }

  async createMember(data: {
    businessId: string;
    userId: string;
    role: UserRole;
  }) {
    return prisma.businessMember.upsert({
      where: {
        businessId_userId: { businessId: data.businessId, userId: data.userId },
      },
      create: {
        businessId: data.businessId,
        userId: data.userId,
        role: data.role,
        isActive: true,
      },
      update: { role: data.role, isActive: true },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });
  }

  async findUserByEmail(email: string) {
    return prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  }
}

export const teamRepository = new TeamRepository();
