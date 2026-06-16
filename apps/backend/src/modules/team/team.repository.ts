import { prisma } from '../../infrastructure/database/prisma';
import { UserRole } from '@prisma/client';

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
    token: string;
    expiresAt: Date;
  }) {
    return prisma.teamInvitation.create({ data });
  }

  async findInvitations(businessId: string) {
    return prisma.teamInvitation.findMany({
      where: { businessId, acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findInvitationByEmail(businessId: string, email: string) {
    return prisma.teamInvitation.findFirst({
      where: { businessId, email, acceptedAt: null, expiresAt: { gt: new Date() } },
    });
  }

  async findUserByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  }
}

export const teamRepository = new TeamRepository();
