import type { AppointmentWorkflowEventType } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma';
import { logger } from '../../core/logger';
import { broadcastBusinessEvent } from '../../infrastructure/realtime/broadcast.service';
import {
  sendAppointmentConfirmation,
  sendAppointmentApproved,
  sendAppointmentRejected,
  sendAppointmentRescheduled,
  sendAppointmentCancelled,
} from '../../infrastructure/appointments/appointment-notification.service';
import {
  scheduleAppointmentReminders,
  cancelAppointmentReminderJobs,
} from '../../infrastructure/appointments/appointment-scheduler.service';
import { appointmentWorkflowBuilderService } from './workflow-builder.service';
import { appointmentTimelineService } from './timeline.service';
import { appointmentWorkflowAuditService } from './workflow-audit.service';
import { appointmentContactResolverService } from './contact-resolver.service';
import { appointmentCalendarSyncService } from './calendar-sync.service';
import { appointmentAiWorkflowService } from './ai-workflow.service';
import { appointmentAnalyticsService } from './analytics.service';
import { scheduleConfigurableReminders } from './reminder-scheduler.service';
import type { WorkflowAction, WorkflowCondition, WorkflowEventContext } from './types';

export class AppointmentWorkflowEngineService {
  async bootstrapAppointment(businessId: string, appointmentId: string) {
    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, businessId },
      include: { customer: true, business: true, service: true, assignedTo: true },
    });
    if (!appointment) return;

    const workflow = await appointmentWorkflowBuilderService.ensureDefaultWorkflow(businessId);
    if (!workflow) return;

    const draftStage = workflow.stages.find((s) => s.key === 'DRAFT') ?? workflow.stages[0];
    if (!draftStage) return;

    const count = await prisma.appointment.count({ where: { businessId } });
    const bookingNumber = `BK-${appointment.business.slug.toUpperCase().slice(0, 6)}-${String(count).padStart(5, '0')}`;

    const variables = this.buildTemplateVariables(appointment, bookingNumber);
    const calendarLinks = appointmentCalendarSyncService.buildCalendarLinks(
      variables,
      appointment.startTime,
      appointment.endTime
    );
    const icsContent = appointmentCalendarSyncService.generateIcs(
      variables,
      appointment.startTime,
      appointment.endTime,
      bookingNumber
    );
    const qrCodeData = await appointmentCalendarSyncService.generateQrCode(
      JSON.stringify({ bookingNumber, appointmentId, businessId })
    );

    const contacts = appointmentContactResolverService.buildContactFields(
      appointment,
      appointment.customer,
      appointment.business.email
    );

    await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        workflowId: workflow.id,
        workflowStageId: draftStage?.id,
        workflowStageKey: draftStage?.key ?? 'DRAFT',
        bookingNumber,
        qrCodeData,
        icsContent,
        location: appointment.location ?? appointment.business.address,
        ...contacts,
      },
    });

    await appointmentTimelineService.record({
      businessId,
      appointmentId,
      eventType: 'APPOINTMENT_CREATED',
      customerId: appointment.customerId,
      metadata: { bookingNumber, calendarLinks },
    });

    await this.emitEvent({
      businessId,
      appointmentId,
      triggerEvent: 'APPOINTMENT_CREATED',
    });
  }

  async emitEvent(ctx: WorkflowEventContext) {
    const started = Date.now();
    const warnings: unknown[] = [];
    const errors: unknown[] = [];
    const executedActions: WorkflowAction[] = [];
    const deliveryStatus: Record<string, unknown> = {};

    const appointment = await prisma.appointment.findFirst({
      where: { id: ctx.appointmentId, businessId: ctx.businessId },
      include: {
        customer: true,
        business: { include: { whatsappAccounts: { where: { isActive: true }, take: 1 } } },
        service: true,
        assignedTo: true,
        workflow: { include: { stages: true, rules: true, transitions: true } },
      },
    });
    if (!appointment?.workflow) return;

    const workflow = appointment.workflow;
    const currentStageKey = appointment.workflowStageKey ?? 'DRAFT';

    const matchingRules = workflow.rules
      .filter((r) => r.isActive && r.triggerEvent === ctx.triggerEvent)
      .sort((a, b) => b.priority - a.priority);

    for (const rule of matchingRules) {
      const conditions = (rule.conditions as unknown as WorkflowCondition[]) ?? [];
      if (!this.evaluateConditions(conditions, appointment)) continue;

      const actions = (rule.actions as unknown as WorkflowAction[]) ?? [];
      for (const action of actions) {
        const result = await this.executeAction(action, appointment, ctx);
        executedActions.push(action);
        deliveryStatus[action.type] = result;
        if (result && typeof result === 'object' && 'error' in result && result.error) {
          errors.push(result.error);
        }
        if (result && typeof result === 'object' && 'warning' in result && result.warning) {
          warnings.push(result.warning);
        }
      }
    }

    const currentStage = workflow.stages.find((s) => s.key === currentStageKey);
    const stageActions = (currentStage?.defaultActions as unknown as WorkflowAction[] | null) ?? [];
    for (const action of stageActions) {
      if (executedActions.some((a) => a.type === action.type)) continue;
      const result = await this.executeAction(action, appointment, ctx);
      executedActions.push(action);
      deliveryStatus[action.type] = result;
    }

    const transition = workflow.transitions.find(
      (t) =>
        t.isActive &&
        t.triggerEvent === ctx.triggerEvent &&
        workflow.stages.find((s) => s.id === t.fromStageId)?.key === currentStageKey
    );

    if (transition) {
      const toStage = workflow.stages.find((s) => s.id === transition.toStageId);
      if (toStage?.isEnabled) {
        await prisma.appointment.update({
          where: { id: appointment.id },
          data: {
            workflowStageId: toStage.id,
            workflowStageKey: toStage.key,
            status: this.mapStageToLegacyStatus(toStage.key),
          },
        });

        await appointmentTimelineService.record({
          businessId: ctx.businessId,
          appointmentId: ctx.appointmentId,
          eventType: 'STAGE_CHANGED',
          actorId: ctx.operatorId,
          metadata: { from: currentStageKey, to: toStage.key },
        });
      }
    }

    await appointmentWorkflowAuditService.recordExecution({
      businessId: ctx.businessId,
      workflowId: workflow.id,
      appointmentId: ctx.appointmentId,
      triggerEvent: ctx.triggerEvent,
      executedActions,
      deliveryStatus,
      executionTimeMs: Date.now() - started,
      errors,
      warnings,
      operatorId: ctx.operatorId,
      ipAddress: ctx.ipAddress,
      device: ctx.device,
    });

    void appointmentAnalyticsService.refreshSnapshot(ctx.businessId).catch(() => undefined);
    void broadcastBusinessEvent(ctx.businessId, {
      type: 'appointment',
      appointmentId: ctx.appointmentId,
      action: ctx.triggerEvent,
    }).catch(() => undefined);
  }

  async transitionToStage(
    businessId: string,
    appointmentId: string,
    stageKey: string,
    operatorId?: string
  ) {
    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, businessId },
      include: { workflow: { include: { stages: true } } },
    });
    if (!appointment?.workflow) return;

    const stage = appointment.workflow.stages.find((s) => s.key === stageKey && s.isEnabled);
    if (!stage) return;

    await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        workflowStageId: stage.id,
        workflowStageKey: stage.key,
        status: this.mapStageToLegacyStatus(stage.key),
      },
    });

    const event = this.stageKeyToEvent(stageKey);
    if (event) {
      await this.emitEvent({
        businessId,
        appointmentId,
        triggerEvent: event,
        operatorId,
      });
    }
  }

  private evaluateConditions(conditions: WorkflowCondition[], appointment: Record<string, unknown>): boolean {
    if (!conditions.length) return true;

    return conditions.every((condition) => {
      const value = this.resolveField(appointment, condition.field);
      switch (condition.op) {
        case 'eq':
          return value === condition.value;
        case 'neq':
          return value !== condition.value;
        case 'gt':
          return Number(value) > Number(condition.value);
        case 'gte':
          return Number(value) >= Number(condition.value);
        case 'lt':
          return Number(value) < Number(condition.value);
        case 'lte':
          return Number(value) <= Number(condition.value);
        case 'contains':
          return String(value).toLowerCase().includes(String(condition.value).toLowerCase());
        case 'in':
          return Array.isArray(condition.value) && condition.value.includes(String(value));
        default:
          return false;
      }
    });
  }

  private resolveField(appointment: Record<string, unknown>, field: string): unknown {
    const customer = appointment.customer as Record<string, unknown> | undefined;
    if (field === 'customerType') return customer?.customerType;
    if (field === 'customerSatisfaction') return (appointment.metadata as Record<string, unknown> | undefined)?.customerSatisfaction;
    return appointment[field];
  }

  private async executeAction(
    action: WorkflowAction,
    appointment: Awaited<ReturnType<typeof this.loadAppointment>>,
    ctx: WorkflowEventContext
  ) {
    if (!appointment) return { skipped: true };

    try {
      switch (action.type) {
        case 'SEND_WHATSAPP':
        case 'SEND_EMAIL':
          return await this.sendNotifications(appointment, ctx.triggerEvent);
        case 'SCHEDULE_REMINDER':
          await scheduleConfigurableReminders({
            appointmentId: appointment.id,
            businessId: appointment.businessId,
            startTime: appointment.startTime,
          });
          await scheduleAppointmentReminders({
            appointmentId: appointment.id,
            businessId: appointment.businessId,
            customerPhone: appointment.customer.phone,
            startTime: appointment.startTime,
          });
          return { scheduled: true };
        case 'UPDATE_CRM':
          await prisma.customer.update({
            where: { id: appointment.customerId },
            data: { lastContactAt: new Date() },
          });
          return { updated: true };
        case 'UPDATE_ANALYTICS':
          await appointmentAnalyticsService.refreshSnapshot(appointment.businessId);
          return { updated: true };
        case 'GENERATE_QR':
          return { qr: Boolean(appointment.qrCodeData) };
        case 'GENERATE_ICS':
        case 'GENERATE_CALENDAR':
          return { ics: Boolean(appointment.icsContent) };
        case 'RELEASE_TIME_SLOT':
          await cancelAppointmentReminderJobs(appointment.id);
          return { released: true };
        case 'NOTIFY_EMPLOYEE':
          if (appointment.assignedToId) {
            await prisma.notification.create({
              data: {
                businessId: appointment.businessId,
                userId: appointment.assignedToId,
                type: 'APPOINTMENT',
                title: 'Appointment update',
                message: `${appointment.title} workflow event: ${ctx.triggerEvent}`,
                data: { appointmentId: appointment.id },
              },
            });
          }
          return { notified: true };
        case 'REQUEST_FEEDBACK':
          await appointmentTimelineService.record({
            businessId: appointment.businessId,
            appointmentId: appointment.id,
            eventType: 'FEEDBACK_REQUESTED',
          });
          return { requested: true };
        case 'TRIGGER_MARKETING':
          await appointmentTimelineService.record({
            businessId: appointment.businessId,
            appointmentId: appointment.id,
            eventType: 'MARKETING_CAMPAIGN_TRIGGERED',
            metadata: action.config,
          });
          return { triggered: true };
        case 'AI_ANALYZE':
          await appointmentAiWorkflowService.analyzeAppointment(appointment.businessId, appointment.id);
          return { analyzed: true };
        case 'AI_PREDICT_NO_SHOW':
          return await appointmentAiWorkflowService.analyzeAppointment(appointment.businessId, appointment.id);
        case 'AI_SUGGEST_TIMES':
          return {
            suggestions: await appointmentAiWorkflowService.suggestBetterTimes(
              appointment.businessId,
              appointment.id
            ),
          };
        case 'ASSIGN_EMPLOYEE': {
          if (appointment.assignedToId) return { alreadyAssigned: true };
          const member = await prisma.businessMember.findFirst({
            where: { businessId: appointment.businessId, isActive: true, role: { in: ['OWNER', 'ADMIN', 'AGENT'] } },
            orderBy: { joinedAt: 'asc' },
          });
          if (member) {
            await prisma.appointment.update({
              where: { id: appointment.id },
              data: { assignedToId: member.userId },
            });
          }
          return { assigned: member?.userId };
        }
        case 'CHANGE_STAGE':
          if (action.config?.stageKey) {
            await this.transitionToStage(
              appointment.businessId,
              appointment.id,
              String(action.config.stageKey),
              ctx.operatorId
            );
          }
          return { changed: action.config?.stageKey };
        case 'SEND_WEBHOOK':
          await appointmentTimelineService.record({
            businessId: appointment.businessId,
            appointmentId: appointment.id,
            eventType: 'WEBHOOK_DISPATCHED',
            channel: 'WEBHOOK',
            metadata: action.config,
          });
          return { webhook: 'queued' };
        default:
          return { unsupported: action.type };
      }
    } catch (error) {
      logger.error('Workflow action failed', { action: action.type, error });
      return { error: error instanceof Error ? error.message : 'Action failed' };
    }
  }

  private async sendNotifications(
    appointment: NonNullable<Awaited<ReturnType<typeof this.loadAppointment>>>,
    triggerEvent: AppointmentWorkflowEventType
  ) {
    const recipients = appointmentContactResolverService.resolveRecipients(
      appointment,
      appointment.business.email
    );

    switch (triggerEvent) {
      case 'APPOINTMENT_CREATED':
        await sendAppointmentConfirmation(appointment.id, appointment.businessId);
        break;
      case 'APPOINTMENT_CONFIRMED':
        await sendAppointmentApproved(appointment.id, appointment.businessId);
        break;
      case 'APPOINTMENT_REJECTED':
        await sendAppointmentRejected(appointment.id, appointment.businessId);
        break;
      case 'APPOINTMENT_RESCHEDULED':
        await sendAppointmentRescheduled(appointment.id, appointment.businessId);
        break;
      case 'APPOINTMENT_CANCELLED':
        await sendAppointmentCancelled(appointment.id, appointment.businessId);
        break;
      default:
        break;
    }

    return { recipients: recipients.length, channels: recipients.map((r) => r.channel) };
  }

  private buildTemplateVariables(
    appointment: {
      business: { name: string; address: string | null };
      customer: { name: string };
      service?: { name: string } | null;
      serviceRequested?: string | null;
      title: string;
      assignedTo?: { firstName: string | null; lastName: string | null } | null;
      startTime: Date;
      endTime: Date;
      location?: string | null;
    },
    bookingNumber: string
  ) {
    const employee = appointment.assignedTo
      ? `${appointment.assignedTo.firstName ?? ''} ${appointment.assignedTo.lastName ?? ''}`.trim()
      : 'Team';

    const base = {
      businessName: appointment.business.name,
      customerName: appointment.customer.name,
      appointmentDate: appointment.startTime.toLocaleDateString(),
      appointmentTime: appointment.startTime.toLocaleTimeString(),
      assignedEmployee: employee || 'Team',
      service: appointment.serviceRequested || appointment.service?.name || appointment.title,
      bookingNumber,
      location: appointment.location ?? appointment.business.address ?? 'TBD',
      rescheduleLink: `/appointments?reschedule=${bookingNumber}`,
      cancelLink: `/appointments?cancel=${bookingNumber}`,
      googleCalendarLink: '',
      outlookCalendarLink: '',
      appleCalendarLink: '',
    };

    const links = appointmentCalendarSyncService.buildCalendarLinks(
      base,
      appointment.startTime,
      appointment.endTime
    );
    return { ...base, ...links };
  }

  private mapStageToLegacyStatus(stageKey: string) {
    const map: Record<string, 'SCHEDULED' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW' | 'MISSED'> = {
      DRAFT: 'SCHEDULED',
      PENDING_REVIEW: 'SCHEDULED',
      PENDING_CONFIRMATION: 'SCHEDULED',
      CONFIRMED: 'CONFIRMED',
      REMINDER_SCHEDULED: 'CONFIRMED',
      REMINDER_SENT: 'CONFIRMED',
      CUSTOMER_ARRIVED: 'CONFIRMED',
      CHECKED_IN: 'CONFIRMED',
      IN_PROGRESS: 'CONFIRMED',
      COMPLETED: 'COMPLETED',
      CLOSED: 'COMPLETED',
      CANCELLED: 'CANCELLED',
      REJECTED: 'CANCELLED',
      NO_SHOW: 'NO_SHOW',
      RESCHEDULED: 'SCHEDULED',
    };
    return map[stageKey] ?? 'SCHEDULED';
  }

  private stageKeyToEvent(stageKey: string): AppointmentWorkflowEventType | null {
    const map: Partial<Record<string, AppointmentWorkflowEventType>> = {
      CONFIRMED: 'APPOINTMENT_CONFIRMED',
      CANCELLED: 'APPOINTMENT_CANCELLED',
      REJECTED: 'APPOINTMENT_REJECTED',
      RESCHEDULED: 'APPOINTMENT_RESCHEDULED',
      COMPLETED: 'APPOINTMENT_COMPLETED',
      NO_SHOW: 'APPOINTMENT_NO_SHOW',
      REMINDER_SCHEDULED: 'REMINDER_SCHEDULED',
      REMINDER_SENT: 'REMINDER_SENT',
      CUSTOMER_ARRIVED: 'CUSTOMER_ARRIVED',
      CHECKED_IN: 'CUSTOMER_CHECKED_IN',
      IN_PROGRESS: 'APPOINTMENT_STARTED',
      FEEDBACK_REQUESTED: 'FEEDBACK_REQUESTED',
      CLOSED: 'FEEDBACK_RECEIVED',
    };
    return map[stageKey] ?? null;
  }

  private async loadAppointment(businessId: string, appointmentId: string) {
    return prisma.appointment.findFirst({
      where: { id: appointmentId, businessId },
      include: {
        customer: true,
        business: { include: { whatsappAccounts: { where: { isActive: true }, take: 1 } } },
        service: true,
        assignedTo: true,
        workflow: { include: { stages: true, rules: true, transitions: true } },
      },
    });
  }

  mapActionToEvent(action: string): AppointmentWorkflowEventType | null {
    const map: Record<string, AppointmentWorkflowEventType> = {
      approve: 'APPOINTMENT_CONFIRMED',
      reject: 'APPOINTMENT_REJECTED',
      cancel: 'APPOINTMENT_CANCELLED',
      complete: 'APPOINTMENT_COMPLETED',
      mark_missed: 'APPOINTMENT_NO_SHOW',
      reschedule: 'APPOINTMENT_RESCHEDULED',
    };
    return map[action] ?? null;
  }
}

export const appointmentWorkflowEngineService = new AppointmentWorkflowEngineService();
