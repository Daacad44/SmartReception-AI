import type { AppointmentWorkflowEventType, Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma';
import { NotFoundError } from '../../core/errors';
import {
  ENTERPRISE_WORKFLOW_TEMPLATES,
  DEFAULT_REMINDER_SCHEDULE,
} from './workflow-templates.data';
import type { WorkflowTemplateDefinition } from './types';

export class AppointmentWorkflowBuilderService {
  async seedGlobalTemplates() {
    for (const template of ENTERPRISE_WORKFLOW_TEMPLATES) {
      await prisma.appointmentWorkflowTemplate.upsert({
        where: { key: template.key },
        create: {
          key: template.key,
          industry: template.industry,
          name: template.name,
          description: template.description,
          definition: template.definition as unknown as Prisma.InputJsonValue,
          sortOrder: ENTERPRISE_WORKFLOW_TEMPLATES.indexOf(template),
        },
        update: {
          industry: template.industry,
          name: template.name,
          description: template.description,
          definition: template.definition as unknown as Prisma.InputJsonValue,
        },
      });
    }
  }

  async listTemplates() {
    await this.seedGlobalTemplates();
    return prisma.appointmentWorkflowTemplate.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async ensureDefaultWorkflow(businessId: string) {
    const existing = await prisma.appointmentWorkflow.findFirst({
      where: { businessId, isDefault: true },
      include: { stages: { orderBy: { sortOrder: 'asc' } }, rules: true, transitions: true },
    });
    if (existing) return existing;

    return this.createFromTemplate(businessId, 'default', true);
  }

  async createFromTemplate(businessId: string, templateKey: string, isDefault = false) {
    await this.seedGlobalTemplates();
    const template = await prisma.appointmentWorkflowTemplate.findUnique({ where: { key: templateKey } });
    if (!template) throw new NotFoundError('Workflow template not found');

    const definition = template.definition as unknown as WorkflowTemplateDefinition;
    return this.createWorkflowFromDefinition(businessId, definition, templateKey, isDefault);
  }

  private async createWorkflowFromDefinition(
    businessId: string,
    definition: WorkflowTemplateDefinition,
    templateKey: string,
    isDefault: boolean
  ) {
    if (isDefault) {
      await prisma.appointmentWorkflow.updateMany({
        where: { businessId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const workflow = await prisma.appointmentWorkflow.create({
      data: {
        businessId,
        name: definition.name,
        description: definition.description,
        isDefault,
        templateKey,
        config: { version: 1 },
      },
    });

    const stageIdByKey = new Map<string, string>();
    for (const stage of definition.stages) {
      const created = await prisma.appointmentWorkflowStage.create({
        data: {
          workflowId: workflow.id,
          businessId,
          key: stage.key,
          label: stage.label,
          color: stage.color ?? '#651147',
          sortOrder: stage.sortOrder,
          isEnabled: stage.isEnabled ?? true,
          isTerminal: stage.isTerminal ?? false,
          requiresApproval: stage.requiresApproval ?? false,
          positionX: stage.positionX ?? 0,
          positionY: stage.positionY ?? 0,
          defaultActions: stage.defaultActions as unknown as Prisma.InputJsonValue,
        },
      });
      stageIdByKey.set(stage.key, created.id);
    }

    for (const transition of definition.transitions) {
      const fromStageId = stageIdByKey.get(transition.fromKey);
      const toStageId = stageIdByKey.get(transition.toKey);
      if (!fromStageId || !toStageId) continue;
      await prisma.appointmentWorkflowTransition.create({
        data: {
          workflowId: workflow.id,
          businessId,
          fromStageId,
          toStageId,
          triggerEvent: transition.triggerEvent,
          conditions: transition.conditions as unknown as Prisma.InputJsonValue,
        },
      });
    }

    for (const rule of definition.rules) {
      await prisma.appointmentWorkflowRule.create({
        data: {
          workflowId: workflow.id,
          businessId,
          name: rule.name,
          triggerEvent: rule.triggerEvent,
          conditions: rule.conditions as unknown as Prisma.InputJsonValue,
          actions: rule.actions as unknown as Prisma.InputJsonValue,
          priority: rule.priority ?? 0,
        },
      });
    }

    const offsets = definition.reminderOffsets ?? DEFAULT_REMINDER_SCHEDULE;
    for (const [i, offset] of offsets.entries()) {
      await prisma.appointmentReminderConfig.create({
        data: {
          businessId,
          workflowId: workflow.id,
          label: offset.label,
          offsetMinutes: offset.offsetMinutes,
          sortOrder: i,
        },
      });
    }

    await prisma.appointmentAutomationSettings.upsert({
      where: { businessId },
      create: { businessId, activeWorkflowId: workflow.id },
      update: { activeWorkflowId: workflow.id },
    });

    return prisma.appointmentWorkflow.findUnique({
      where: { id: workflow.id },
      include: {
        stages: { orderBy: { sortOrder: 'asc' } },
        transitions: true,
        rules: { orderBy: { priority: 'desc' } },
      },
    });
  }

  async listWorkflows(businessId: string) {
    await this.ensureDefaultWorkflow(businessId);
    return prisma.appointmentWorkflow.findMany({
      where: { businessId },
      include: {
        stages: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { appointments: true, rules: true } },
      },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  async getWorkflow(businessId: string, workflowId: string) {
    const workflow = await prisma.appointmentWorkflow.findFirst({
      where: { id: workflowId, businessId },
      include: {
        stages: { orderBy: { sortOrder: 'asc' } },
        transitions: { include: { fromStage: true, toStage: true } },
        rules: { orderBy: { priority: 'desc' } },
      },
    });
    if (!workflow) throw new NotFoundError('Workflow not found');
    return workflow;
  }

  async updateWorkflow(
    businessId: string,
    workflowId: string,
    data: {
      name?: string;
      description?: string;
      isActive?: boolean;
      stages?: Array<{
        id?: string;
        key: string;
        label: string;
        color?: string;
        sortOrder: number;
        isEnabled?: boolean;
        isTerminal?: boolean;
        requiresApproval?: boolean;
        positionX?: number;
        positionY?: number;
        defaultActions?: unknown;
      }>;
      transitions?: Array<{
        id?: string;
        fromStageId: string;
        toStageId: string;
        triggerEvent: AppointmentWorkflowEventType;
        conditions?: unknown;
        isActive?: boolean;
      }>;
      rules?: Array<{
        id?: string;
        name: string;
        triggerEvent: AppointmentWorkflowEventType;
        conditions: unknown;
        actions: unknown;
        priority?: number;
        isActive?: boolean;
      }>;
    }
  ) {
    const workflow = await this.getWorkflow(businessId, workflowId);

    await prisma.appointmentWorkflow.update({
      where: { id: workflowId },
      data: {
        name: data.name,
        description: data.description,
        isActive: data.isActive,
      },
    });

    if (data.stages) {
      for (const stage of data.stages) {
        if (stage.id) {
          await prisma.appointmentWorkflowStage.updateMany({
            where: { id: stage.id, businessId, workflowId },
            data: {
              key: stage.key,
              label: stage.label,
              color: stage.color,
              sortOrder: stage.sortOrder,
              isEnabled: stage.isEnabled,
              isTerminal: stage.isTerminal,
              requiresApproval: stage.requiresApproval,
              positionX: stage.positionX,
              positionY: stage.positionY,
              defaultActions: stage.defaultActions as unknown as Prisma.InputJsonValue,
            },
          });
        } else {
          await prisma.appointmentWorkflowStage.create({
            data: {
              workflowId,
              businessId,
              key: stage.key,
              label: stage.label,
              color: stage.color ?? '#651147',
              sortOrder: stage.sortOrder,
              isEnabled: stage.isEnabled ?? true,
              isTerminal: stage.isTerminal ?? false,
              requiresApproval: stage.requiresApproval ?? false,
              positionX: stage.positionX ?? 0,
              positionY: stage.positionY ?? 0,
              defaultActions: stage.defaultActions as unknown as Prisma.InputJsonValue,
            },
          });
        }
      }
    }

    if (data.transitions) {
      for (const transition of data.transitions) {
        if (transition.id) {
          await prisma.appointmentWorkflowTransition.updateMany({
            where: { id: transition.id, businessId, workflowId },
            data: {
              fromStageId: transition.fromStageId,
              toStageId: transition.toStageId,
              triggerEvent: transition.triggerEvent,
              conditions: transition.conditions as unknown as Prisma.InputJsonValue,
              isActive: transition.isActive,
            },
          });
        } else {
          await prisma.appointmentWorkflowTransition.create({
            data: {
              workflowId,
              businessId,
              fromStageId: transition.fromStageId,
              toStageId: transition.toStageId,
              triggerEvent: transition.triggerEvent,
              conditions: transition.conditions as unknown as Prisma.InputJsonValue,
              isActive: transition.isActive ?? true,
            },
          });
        }
      }
    }

    if (data.rules) {
      for (const rule of data.rules) {
        if (rule.id) {
          await prisma.appointmentWorkflowRule.updateMany({
            where: { id: rule.id, businessId, workflowId },
            data: {
              name: rule.name,
              triggerEvent: rule.triggerEvent,
              conditions: rule.conditions as Prisma.InputJsonValue,
              actions: rule.actions as Prisma.InputJsonValue,
              priority: rule.priority,
              isActive: rule.isActive,
            },
          });
        } else {
          await prisma.appointmentWorkflowRule.create({
            data: {
              workflowId,
              businessId,
              name: rule.name,
              triggerEvent: rule.triggerEvent,
              conditions: rule.conditions as Prisma.InputJsonValue,
              actions: rule.actions as Prisma.InputJsonValue,
              priority: rule.priority ?? 0,
              isActive: rule.isActive ?? true,
            },
          });
        }
      }
    }

    return this.getWorkflow(businessId, workflowId);
  }

  async duplicateWorkflow(businessId: string, workflowId: string, name: string) {
    const source = await this.getWorkflow(businessId, workflowId);
    const stageIdMap = new Map<string, string>();

    const workflow = await prisma.appointmentWorkflow.create({
      data: {
        businessId,
        name,
        description: source.description,
        templateKey: source.templateKey,
        config: source.config ?? undefined,
      },
    });

    for (const stage of source.stages) {
      const created = await prisma.appointmentWorkflowStage.create({
        data: {
          workflowId: workflow.id,
          businessId,
          key: stage.key,
          label: stage.label,
          color: stage.color,
          sortOrder: stage.sortOrder,
          isEnabled: stage.isEnabled,
          isTerminal: stage.isTerminal,
          requiresApproval: stage.requiresApproval,
          positionX: stage.positionX,
          positionY: stage.positionY,
          defaultActions: stage.defaultActions ?? undefined,
        },
      });
      stageIdMap.set(stage.id, created.id);
    }

    for (const transition of source.transitions) {
      await prisma.appointmentWorkflowTransition.create({
        data: {
          workflowId: workflow.id,
          businessId,
          fromStageId: stageIdMap.get(transition.fromStageId)!,
          toStageId: stageIdMap.get(transition.toStageId)!,
          triggerEvent: transition.triggerEvent,
          conditions: transition.conditions ?? undefined,
          isActive: transition.isActive,
        },
      });
    }

    for (const rule of source.rules) {
      await prisma.appointmentWorkflowRule.create({
        data: {
          workflowId: workflow.id,
          businessId,
          name: rule.name,
          triggerEvent: rule.triggerEvent,
          conditions: rule.conditions ?? [],
          actions: rule.actions ?? [],
          priority: rule.priority,
          isActive: rule.isActive,
        },
      });
    }

    return this.getWorkflow(businessId, workflow.id);
  }

  async getSettings(businessId: string) {
    await this.ensureDefaultWorkflow(businessId);
    return prisma.appointmentAutomationSettings.findUnique({ where: { businessId } });
  }

  async updateSettings(businessId: string, data: Prisma.AppointmentAutomationSettingsUpdateInput) {
    await this.ensureDefaultWorkflow(businessId);
    const { businessId: _ignored, ...rest } = data as Prisma.AppointmentAutomationSettingsUncheckedUpdateInput & {
      businessId?: string;
    };
    return prisma.appointmentAutomationSettings.upsert({
      where: { businessId },
      create: { businessId, ...rest } as Prisma.AppointmentAutomationSettingsUncheckedCreateInput,
      update: rest,
    });
  }

  async listReminderConfigs(businessId: string) {
    await this.ensureDefaultWorkflow(businessId);
    return prisma.appointmentReminderConfig.findMany({
      where: { businessId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async updateReminderConfigs(
    businessId: string,
    configs: Array<{
      id?: string;
      label: string;
      offsetMinutes: number;
      channels?: string[];
      template?: string;
      isEnabled?: boolean;
      sortOrder?: number;
    }>
  ) {
    await this.ensureDefaultWorkflow(businessId);
    const workflow = await prisma.appointmentWorkflow.findFirst({ where: { businessId, isDefault: true } });

    for (const [i, config] of configs.entries()) {
      if (config.id) {
        await prisma.appointmentReminderConfig.updateMany({
          where: { id: config.id, businessId },
          data: {
            label: config.label,
            offsetMinutes: config.offsetMinutes,
            channels: config.channels,
            template: config.template,
            isEnabled: config.isEnabled,
            sortOrder: config.sortOrder ?? i,
          },
        });
      } else {
        await prisma.appointmentReminderConfig.create({
          data: {
            businessId,
            workflowId: workflow?.id,
            label: config.label,
            offsetMinutes: config.offsetMinutes,
            channels: config.channels ?? ['WHATSAPP', 'EMAIL'],
            template: config.template,
            isEnabled: config.isEnabled ?? true,
            sortOrder: config.sortOrder ?? i,
          },
        });
      }
    }

    return this.listReminderConfigs(businessId);
  }
}

export const appointmentWorkflowBuilderService = new AppointmentWorkflowBuilderService();
