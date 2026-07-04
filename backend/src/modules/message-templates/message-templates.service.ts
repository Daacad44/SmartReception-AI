import { prisma } from '../../infrastructure/database/prisma';
import { ConflictError, NotFoundError } from '../../core/errors';
import { CreateMessageTemplateInput, UpdateMessageTemplateInput } from '@smartreception/shared';
import {
  normalizeWhatsAppTemplateLanguage,
  isMetaTemplateSlug,
} from '../../infrastructure/whatsapp/whatsapp-template-language.util';

export class MessageTemplatesService {
  /** Remove legacy auto-seeded templates — inbox shows user-created templates only. */
  async purgeSystemTemplates(businessId: string): Promise<void> {
    await prisma.messageTemplate.deleteMany({
      where: { businessId, isSystem: true },
    });
  }

  async list(businessId: string) {
    await this.purgeSystemTemplates(businessId);
    return prisma.messageTemplate.findMany({
      where: { businessId, isSystem: false },
      orderBy: { name: 'asc' },
      include: { _count: { select: { campaigns: true } } },
    });
  }

  /** Templates available in Conversations inbox picker (user-created only). */
  async listForInbox(businessId: string) {
    return this.list(businessId);
  }

  async get(businessId: string, id: string) {
    const template = await prisma.messageTemplate.findFirst({
      where: { id, businessId, isSystem: false },
    });
    if (!template) throw new NotFoundError('Template not found');
    return template;
  }

  async create(businessId: string, input: CreateMessageTemplateInput, userId: string) {
    const existing = await prisma.messageTemplate.findFirst({
      where: { businessId, name: input.name },
    });
    if (existing) {
      if (existing.isSystem) {
        throw new ConflictError(
          'This name is reserved by a system template. Choose a different name or wait for the next platform update.'
        );
      }
      return this.update(businessId, existing.id, input, userId);
    }

    const template = await prisma.messageTemplate.create({
      data: {
        businessId,
        name: input.name,
        content: input.content,
        type: input.type,
        variables: input.variables ?? [],
        whatsappTemplateName:
          input.whatsappTemplateName ??
          (isMetaTemplateSlug(input.name) ? input.name.trim() : null),
        whatsappTemplateLanguage: input.whatsappTemplateLanguage
          ? normalizeWhatsAppTemplateLanguage(input.whatsappTemplateLanguage)
          : null,
        isSystem: false,
      },
    });

    await prisma.auditLog.create({
      data: { businessId, userId, action: 'CREATE', entity: 'MessageTemplate', entityId: template.id },
    });

    return template;
  }

  async update(businessId: string, id: string, input: UpdateMessageTemplateInput, userId: string) {
    const existing = await prisma.messageTemplate.findFirst({
      where: { id, businessId, isSystem: false },
    });
    if (!existing) throw new NotFoundError('Template not found');

    const template = await prisma.messageTemplate.update({
      where: { id },
      data: {
        name: input.name,
        content: input.content,
        type: input.type,
        variables: input.variables,
        whatsappTemplateName:
          input.whatsappTemplateName ??
          (input.name && isMetaTemplateSlug(input.name) ? input.name.trim() : undefined),
        whatsappTemplateLanguage: input.whatsappTemplateLanguage
          ? normalizeWhatsAppTemplateLanguage(input.whatsappTemplateLanguage)
          : input.whatsappTemplateLanguage,
      },
    });

    await prisma.auditLog.create({
      data: { businessId, userId, action: 'UPDATE', entity: 'MessageTemplate', entityId: id, newData: input as object },
    });

    return template;
  }

  async delete(businessId: string, id: string, userId: string) {
    const existing = await prisma.messageTemplate.findFirst({
      where: { id, businessId, isSystem: false },
    });
    if (!existing) throw new NotFoundError('Template not found');

    await prisma.messageTemplate.delete({ where: { id } });

    await prisma.auditLog.create({
      data: { businessId, userId, action: 'DELETE', entity: 'MessageTemplate', entityId: id },
    });
  }
}

export const messageTemplatesService = new MessageTemplatesService();
