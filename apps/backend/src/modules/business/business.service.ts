import { businessRepository } from './business.repository';
import { NotFoundError } from '../../core/errors';
import { UpdateBusinessInput } from '@smartreception/shared';
import { prisma } from '../../infrastructure/database/prisma';
import { Industry } from '@prisma/client';

export class BusinessService {
  async getBusiness(businessId: string) {
    const business = await businessRepository.findById(businessId);
    if (!business) {
      throw new NotFoundError('Business not found');
    }
    return business;
  }

  async updateBusiness(businessId: string, input: UpdateBusinessInput, userId: string) {
    const existing = await businessRepository.findById(businessId);
    if (!existing) {
      throw new NotFoundError('Business not found');
    }

    const business = await businessRepository.update(businessId, {
      name: input.name,
      description: input.description,
      industry: input.industry as Industry | undefined,
      phone: input.phone,
      email: input.email,
      website: input.website || null,
      address: input.address,
      timezone: input.timezone,
    });

    await prisma.auditLog.create({
      data: {
        businessId,
        userId,
        action: 'UPDATE',
        entity: 'Business',
        entityId: businessId,
        newData: input as object,
      },
    });

    return business;
  }

  async getSettings(businessId: string) {
    const settings = await businessRepository.getSettings(businessId);
    if (!settings) {
      throw new NotFoundError('Business not found');
    }
    return settings;
  }

  async updateSettings(
    businessId: string,
    input: { timezone?: string; phone?: string; email?: string; website?: string; address?: string },
    userId: string
  ) {
    const existing = await businessRepository.findById(businessId);
    if (!existing) {
      throw new NotFoundError('Business not found');
    }

    const business = await businessRepository.update(businessId, {
      timezone: input.timezone,
      phone: input.phone,
      email: input.email,
      website: input.website || null,
      address: input.address,
    });

    await prisma.auditLog.create({
      data: {
        businessId,
        userId,
        action: 'UPDATE',
        entity: 'BusinessSettings',
        entityId: businessId,
        newData: input as object,
      },
    });

    return business;
  }
}

export const businessService = new BusinessService();
