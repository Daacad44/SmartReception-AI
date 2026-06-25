import { prisma } from '../../infrastructure/database/prisma';
import { ConflictError, NotFoundError } from '../../core/errors';
import { CreateMessageTemplateInput, UpdateMessageTemplateInput } from '@smartreception/shared';
import type { CampaignType } from '@prisma/client';

const SYSTEM_TEMPLATES: Array<{ name: string; content: string; type: CampaignType }> = [
  {
    name: 'Welcome Message',
    content:
      'Salaan {{name}}! Ku soo dhawoow {{business}}. Waxaan ku caawin doonaa wixii aad u baahan tahay. Mahadsanid!',
    type: 'MARKETING',
  },
  {
    name: 'Appointment Reminder',
    content:
      'Salaan {{name}}, waxaan ku xasuusinaynaa ballantaada {{date}} saacadda {{time}}. Fadlan xaqiiji haddii aad iman doonto.',
    type: 'REMINDER',
  },
  {
    name: 'Follow Up Message',
    content:
      'Salaan {{name}}, sidee kuu ahaa adeeggeenii? Waxaan jeclaan lahayn inaan maqalno ra\'yiintaada.',
    type: 'FOLLOW_UP',
  },
  {
    name: 'Promotion Message',
    content:
      'Salaan {{name}}! Fursad gaar ah: {{offer}}. Ku dhawaada {{deadline}} si aad uga faa\'iidaysato!',
    type: 'PROMOTION',
  },
  {
    name: 'Holiday Greetings',
    content: 'Salaan {{name}}! Ciid wanaagsan! Waxaan rajaynaynaa inaad ku faraxsan tahay ciidkan.',
    type: 'HOLIDAY',
  },
  {
    name: 'Customer Reactivation',
    content:
      'Salaan {{name}}, waan kuu soo wacnay! Waxaan jeclaan lahayn inaan dib kuu soo noqono. Ma jiraan wax aan kuu caawin karno?',
    type: 'MARKETING',
  },
];

export class MessageTemplatesService {
  async ensureSystemTemplates(businessId: string): Promise<void> {
    for (const tpl of SYSTEM_TEMPLATES) {
      await prisma.messageTemplate.upsert({
        where: { businessId_name: { businessId, name: tpl.name } },
        create: {
          businessId,
          name: tpl.name,
          content: tpl.content,
          type: tpl.type,
          isSystem: true,
          variables: ['name', 'business', 'date', 'time', 'offer', 'deadline'],
        },
        update: { content: tpl.content, type: tpl.type, isSystem: true },
      });
    }
  }

  async list(businessId: string) {
    await this.ensureSystemTemplates(businessId);
    return prisma.messageTemplate.findMany({
      where: { businessId },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      include: { _count: { select: { campaigns: true } } },
    });
  }

  async get(businessId: string, id: string) {
    const template = await prisma.messageTemplate.findFirst({
      where: { id, businessId },
    });
    if (!template) throw new NotFoundError('Template not found');
    return template;
  }

  async create(businessId: string, input: CreateMessageTemplateInput, userId: string) {
    const existing = await prisma.messageTemplate.findFirst({
      where: { businessId, name: input.name },
    });
    if (existing) throw new ConflictError('Template with this name already exists');

    const template = await prisma.messageTemplate.create({
      data: {
        businessId,
        name: input.name,
        content: input.content,
        type: input.type,
        variables: input.variables ?? [],
        isSystem: false,
      },
    });

    await prisma.auditLog.create({
      data: { businessId, userId, action: 'CREATE', entity: 'MessageTemplate', entityId: template.id },
    });

    return template;
  }

  async update(businessId: string, id: string, input: UpdateMessageTemplateInput, userId: string) {
    const existing = await prisma.messageTemplate.findFirst({ where: { id, businessId } });
    if (!existing) throw new NotFoundError('Template not found');
    if (existing.isSystem && input.name) throw new ConflictError('Cannot rename system templates');

    const template = await prisma.messageTemplate.update({
      where: { id },
      data: {
        name: input.name,
        content: input.content,
        type: input.type,
        variables: input.variables,
      },
    });

    await prisma.auditLog.create({
      data: { businessId, userId, action: 'UPDATE', entity: 'MessageTemplate', entityId: id, newData: input as object },
    });

    return template;
  }

  async delete(businessId: string, id: string, userId: string) {
    const existing = await prisma.messageTemplate.findFirst({ where: { id, businessId } });
    if (!existing) throw new NotFoundError('Template not found');
    if (existing.isSystem) throw new ConflictError('Cannot delete system templates');

    await prisma.messageTemplate.delete({ where: { id } });

    await prisma.auditLog.create({
      data: { businessId, userId, action: 'DELETE', entity: 'MessageTemplate', entityId: id },
    });
  }
}

export const messageTemplatesService = new MessageTemplatesService();
