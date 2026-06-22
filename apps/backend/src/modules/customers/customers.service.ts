import { customersRepository } from './customers.repository';
import { ConflictError, NotFoundError } from '../../core/errors';
import {
  CreateCustomerInput,
  UpdateCustomerInput,
  PaginationInput,
} from '@smartreception/shared';
import { prisma } from '../../infrastructure/database/prisma';
import { billingService } from '../billing/billing.service';

export class CustomersService {
  async list(businessId: string, params: PaginationInput & { tagId?: string }) {
    const result = await customersRepository.findMany(businessId, params);
    return {
      data: result.customers.map((c) => ({
        ...c,
        tags: c.tags.map((t) => t.tag),
      })),
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      },
    };
  }

  async get(businessId: string, id: string) {
    const customer = await customersRepository.findById(businessId, id);
    if (!customer) {
      throw new NotFoundError('Customer not found');
    }
    return {
      ...customer,
      tags: customer.tags.map((t) => t.tag),
    };
  }

  async create(businessId: string, input: CreateCustomerInput, userId: string) {
    await billingService.assertWithinLimit(businessId, 'customers');

    const existing = await customersRepository.findByPhone(businessId, input.phone);
    if (existing) {
      throw new ConflictError('Customer with this phone number already exists');
    }

    const customer = await customersRepository.create(businessId, {
      name: input.name,
      phone: input.phone,
      email: input.email || null,
      notes: input.notes,
      companyName: input.companyName,
      whatsappNumber: input.whatsappNumber || input.phone,
      customerType: input.customerType,
      leadStatus: input.leadStatus,
      customerValue: input.customerValue,
      tagIds: input.tagIds,
    });

    await prisma.auditLog.create({
      data: {
        businessId,
        userId,
        action: 'CREATE',
        entity: 'Customer',
        entityId: customer.id,
      },
    });

    return customer;
  }

  async update(businessId: string, id: string, input: UpdateCustomerInput, userId: string) {
    const existing = await customersRepository.findById(businessId, id);
    if (!existing) {
      throw new NotFoundError('Customer not found');
    }

    if (input.phone && input.phone !== existing.phone) {
      const phoneTaken = await customersRepository.findByPhone(businessId, input.phone);
      if (phoneTaken) {
        throw new ConflictError('Customer with this phone number already exists');
      }
    }

    const customer = await customersRepository.update(businessId, id, {
      name: input.name,
      phone: input.phone,
      email: input.email === '' ? null : input.email,
      notes: input.notes,
      companyName: input.companyName,
      whatsappNumber: input.whatsappNumber,
      customerType: input.customerType,
      leadStatus: input.leadStatus,
      customerValue: input.customerValue,
    });

    if (input.tagIds) {
      await customersRepository.assignTags(businessId, id, input.tagIds);
    }

    await prisma.auditLog.create({
      data: {
        businessId,
        userId,
        action: 'UPDATE',
        entity: 'Customer',
        entityId: id,
        newData: input as object,
      },
    });

    return customer;
  }

  async delete(businessId: string, id: string, userId: string) {
    const existing = await customersRepository.findById(businessId, id);
    if (!existing) {
      throw new NotFoundError('Customer not found');
    }

    await customersRepository.softDelete(businessId, id);

    await prisma.auditLog.create({
      data: {
        businessId,
        userId,
        action: 'DELETE',
        entity: 'Customer',
        entityId: id,
      },
    });
  }

  async listTags(businessId: string) {
    return customersRepository.findTags(businessId);
  }

  async createTag(businessId: string, name: string, color?: string) {
    try {
      return await customersRepository.createTag(businessId, name, color);
    } catch {
      throw new ConflictError('Tag with this name already exists');
    }
  }

  async deleteTag(businessId: string, tagId: string) {
    try {
      await customersRepository.deleteTag(businessId, tagId);
    } catch {
      throw new NotFoundError('Tag not found');
    }
  }

  async assignTags(businessId: string, customerId: string, tagIds: string[]) {
    const customer = await customersRepository.findById(businessId, customerId);
    if (!customer) {
      throw new NotFoundError('Customer not found');
    }
    const updated = await customersRepository.assignTags(businessId, customerId, tagIds);
    return { ...updated, tags: updated?.tags.map((t) => t.tag) };
  }

  async addNote(businessId: string, customerId: string, content: string, userId: string) {
    const customer = await customersRepository.findById(businessId, customerId);
    if (!customer) {
      throw new NotFoundError('Customer not found');
    }
    return customersRepository.addNote(customerId, content, userId);
  }

  async getNotes(businessId: string, customerId: string) {
    const customer = await customersRepository.findById(businessId, customerId);
    if (!customer) {
      throw new NotFoundError('Customer not found');
    }
    return customersRepository.getNotes(customerId);
  }

  async getTimeline(businessId: string, customerId: string) {
    const customer = await customersRepository.findById(businessId, customerId);
    if (!customer) {
      throw new NotFoundError('Customer not found');
    }

    const [notes, appointments, conversations, auditLogs] = await Promise.all([
      customersRepository.getNotes(customerId),
      prisma.appointment.findMany({
        where: { businessId, customerId },
        orderBy: { startTime: 'desc' },
        take: 20,
        select: { id: true, title: true, status: true, startTime: true, endTime: true },
      }),
      prisma.conversation.findMany({
        where: { businessId, customerId },
        orderBy: { lastMessageAt: 'desc' },
        take: 20,
        select: { id: true, status: true, lastMessageAt: true, unreadCount: true },
      }),
      prisma.auditLog.findMany({
        where: { businessId, entity: 'Customer', entityId: customerId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          user: { select: { firstName: true, lastName: true } },
        },
      }),
    ]);

    const events = [
      ...notes.map((n) => ({
        id: n.id,
        type: 'note' as const,
        title: 'Note added',
        description: n.content,
        timestamp: n.createdAt.toISOString(),
      })),
      ...appointments.map((a) => ({
        id: a.id,
        type: 'appointment' as const,
        title: a.title,
        description: `Status: ${a.status}`,
        timestamp: a.startTime.toISOString(),
      })),
      ...conversations.map((c) => ({
        id: c.id,
        type: 'conversation' as const,
        title: 'Conversation',
        description: `Status: ${c.status}`,
        timestamp: (c.lastMessageAt ?? new Date()).toISOString(),
      })),
      ...auditLogs.map((l) => ({
        id: l.id,
        type: 'activity' as const,
        title: `${l.action} ${l.entity}`,
        description: l.user
          ? `By ${l.user.firstName} ${l.user.lastName}`
          : 'System activity',
        timestamp: l.createdAt.toISOString(),
      })),
    ].sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    return events;
  }

  async getInsights(businessId: string, customerId: string) {
    const customer = await customersRepository.findById(businessId, customerId);
    if (!customer) {
      throw new NotFoundError('Customer not found');
    }

    const [appointmentStats, messageCount, lastConversation] = await Promise.all([
      prisma.appointment.groupBy({
        by: ['status'],
        where: { businessId, customerId },
        _count: { id: true },
      }),
      prisma.message.count({
        where: { conversation: { businessId, customerId } },
      }),
      prisma.conversation.findFirst({
        where: { businessId, customerId },
        orderBy: { lastMessageAt: 'desc' },
        select: { lastMessageAt: true, status: true },
      }),
    ]);

    const appointmentByStatus = Object.fromEntries(
      appointmentStats.map((s) => [s.status, s._count.id])
    );

    return {
      leadScore: customer.leadScore,
      status: customer.leadScore >= 80 ? 'vip' : customer.isActive ? 'active' : 'inactive',
      totalConversations: customer._count.conversations,
      totalAppointments: customer._count.appointments,
      completedAppointments: appointmentByStatus.COMPLETED ?? 0,
      cancelledAppointments: appointmentByStatus.CANCELLED ?? 0,
      totalMessages: messageCount,
      lastActivity: customer.lastContactAt?.toISOString() ?? customer.updatedAt.toISOString(),
      lastConversationStatus: lastConversation?.status ?? null,
      tags: customer.tags.map((t) => t.tag),
    };
  }

  async getProfile(businessId: string, customerId: string) {
    const customer = await customersRepository.findById(businessId, customerId);
    if (!customer) throw new NotFoundError('Customer not found');

    const [appointments, messages, campaigns, insights] = await Promise.all([
      prisma.appointment.findMany({
        where: { businessId, customerId },
        orderBy: { startTime: 'desc' },
        take: 20,
        include: { service: true, assignedTo: { select: { firstName: true, lastName: true } } },
      }),
      prisma.message.findMany({
        where: { conversation: { businessId, customerId } },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { id: true, content: true, direction: true, createdAt: true, isAiGenerated: true },
      }),
      prisma.campaignRecipient.findMany({
        where: { customerId, campaign: { businessId } },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { campaign: { select: { id: true, name: true, type: true, status: true } } },
      }),
      this.getInsights(businessId, customerId),
    ]);

    return {
      ...customer,
      tags: customer.tags.map((t) => t.tag),
      appointments,
      messages,
      campaignHistory: campaigns,
      insights,
      aiSummary: customer.aiSummary,
      servicesInterestedIn: appointments
        .map((a) => a.serviceRequested || a.service?.name)
        .filter(Boolean),
    };
  }
}

export const customersService = new CustomersService();
