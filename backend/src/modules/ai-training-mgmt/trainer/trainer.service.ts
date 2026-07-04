import { prisma } from '../../../infrastructure/database/prisma';
import { passwordService } from '../../../infrastructure/auth/password.service';
import { ConflictError, NotFoundError } from '../../../core/errors';

const DEFAULT_TRAINER_PERMISSIONS = {
  uploadDocuments: true,
  editDocuments: true,
  trainAi: true,
  retrainAi: true,
  generateEmbeddings: true,
  reviewAi: true,
  runSandbox: true,
  viewReports: true,
};

export class TrainerService {
  async listTrainers() {
    return prisma.aiTrainer.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        businessAssignments: {
          include: { business: { select: { id: true, name: true } } },
        },
        _count: { select: { loginHistory: true } },
      },
    });
  }

  async getTrainer(trainerId: string) {
    const trainer = await prisma.aiTrainer.findUnique({
      where: { id: trainerId },
      include: {
        businessAssignments: { include: { business: { select: { id: true, name: true } } } },
        loginHistory: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!trainer) throw new NotFoundError('Trainer not found');
    return trainer;
  }

  async createTrainer(input: {
    username: string;
    password: string;
    firstName: string;
    lastName: string;
    email?: string;
    businessIds: string[];
    permissions?: Record<string, boolean>;
  }) {
    const existing = await prisma.aiTrainer.findUnique({ where: { username: input.username } });
    if (existing) throw new ConflictError('Username already exists');

    const passwordHash = await passwordService.hash(input.password);
    return prisma.aiTrainer.create({
      data: {
        username: input.username,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        permissions: input.permissions ?? DEFAULT_TRAINER_PERMISSIONS,
        businessAssignments: {
          create: input.businessIds.map((businessId) => ({ businessId })),
        },
      },
      include: {
        businessAssignments: { include: { business: { select: { id: true, name: true } } } },
      },
    });
  }

  async updateTrainer(
    trainerId: string,
    input: {
      firstName?: string;
      lastName?: string;
      email?: string;
      isActive?: boolean;
      permissions?: Record<string, boolean>;
      businessIds?: string[];
      password?: string;
    }
  ) {
    await this.getTrainer(trainerId);

    if (input.businessIds) {
      await prisma.aiTrainerBusiness.deleteMany({ where: { trainerId } });
      await prisma.aiTrainerBusiness.createMany({
        data: input.businessIds.map((businessId) => ({ trainerId, businessId })),
      });
    }

    return prisma.aiTrainer.update({
      where: { id: trainerId },
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        isActive: input.isActive,
        permissions: input.permissions,
        ...(input.password ? { passwordHash: await passwordService.hash(input.password) } : {}),
      },
      include: {
        businessAssignments: { include: { business: { select: { id: true, name: true } } } },
      },
    });
  }

  async listAssignedBusinesses(trainerId: string) {
    const assignments = await prisma.aiTrainerBusiness.findMany({
      where: { trainerId },
      include: { business: { select: { id: true, name: true, slug: true } } },
    });
    return assignments.map((a) => a.business);
  }
}

export const trainerService = new TrainerService();
