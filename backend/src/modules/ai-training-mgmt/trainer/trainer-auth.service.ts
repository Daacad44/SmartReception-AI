import jwt from 'jsonwebtoken';
import { prisma } from '../../../infrastructure/database/prisma';
import { passwordService } from '../../../infrastructure/auth/password.service';
import { config } from '../../../config';
import { UnauthorizedError } from '../../../core/errors';
import type { JwtPayload } from '@smartreception/shared';
import { recordAiTrainingAudit, parseDeviceLabel } from '../audit.service';

export interface TrainerLoginInput {
  username: string;
  password: string;
}

export class TrainerAuthService {
  async login(input: TrainerLoginInput, ipAddress?: string, userAgent?: string) {
    const trainer = await prisma.aiTrainer.findUnique({
      where: { username: input.username },
      include: {
        businessAssignments: {
          include: { business: { select: { id: true, name: true, slug: true } } },
        },
      },
    });

    const deviceLabel = parseDeviceLabel(userAgent);

    if (!trainer || !trainer.isActive) {
      if (trainer) {
        await prisma.aiTrainerLoginHistory.create({
          data: { trainerId: trainer.id, ipAddress, userAgent, deviceLabel, success: false },
        });
      }
      throw new UnauthorizedError('Invalid credentials');
    }

    const valid = await passwordService.compare(input.password, trainer.passwordHash);
    await prisma.aiTrainerLoginHistory.create({
      data: { trainerId: trainer.id, ipAddress, userAgent, deviceLabel, success: valid },
    });

    if (!valid) {
      throw new UnauthorizedError('Invalid credentials');
    }

    await prisma.aiTrainer.update({
      where: { id: trainer.id },
      data: { lastLoginAt: new Date() },
    });

    const primaryBusiness = trainer.businessAssignments[0]?.business;
    const payload: JwtPayload = {
      userId: trainer.id,
      email: trainer.email ?? trainer.username,
      trainerId: trainer.id,
      businessId: primaryBusiness?.id,
      purpose: 'ai_trainer',
    };

    const accessToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: '12h',
    });

    if (primaryBusiness) {
      await recordAiTrainingAudit(
        {
          businessId: primaryBusiness.id,
          trainerId: trainer.id,
          ipAddress,
          userAgent,
          deviceLabel,
        },
        'TRAINER_LOGIN'
      );
    }

    return {
      accessToken,
      trainer: {
        id: trainer.id,
        username: trainer.username,
        firstName: trainer.firstName,
        lastName: trainer.lastName,
        email: trainer.email,
        permissions: trainer.permissions,
        businesses: trainer.businessAssignments.map((a) => a.business),
      },
    };
  }

  verifyTrainerToken(token: string): JwtPayload {
    const payload = jwt.verify(token, config.jwt.secret) as JwtPayload;
    if (payload.purpose !== 'ai_trainer' || !payload.trainerId) {
      throw new UnauthorizedError('Invalid trainer token');
    }
    return payload;
  }
}

export const trainerAuthService = new TrainerAuthService();
