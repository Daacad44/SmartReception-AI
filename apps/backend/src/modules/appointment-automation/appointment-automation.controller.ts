import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { routeParam } from '../../core/utils';
import { appointmentWorkflowBuilderService } from './workflow-builder.service';
import { appointmentWorkflowEngineService } from './workflow-engine.service';
import { appointmentTimelineService } from './timeline.service';
import { appointmentWorkflowAuditService } from './workflow-audit.service';
import { appointmentAnalyticsService } from './analytics.service';
import { appointmentAiWorkflowService } from './ai-workflow.service';

const updateWorkflowSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  stages: z.array(z.object({
    id: z.string().optional(),
    key: z.string(),
    label: z.string(),
    color: z.string().optional(),
    sortOrder: z.number(),
    isEnabled: z.boolean().optional(),
    isTerminal: z.boolean().optional(),
    requiresApproval: z.boolean().optional(),
    positionX: z.number().optional(),
    positionY: z.number().optional(),
    defaultActions: z.array(z.unknown()).optional(),
  })).optional(),
  transitions: z.array(z.object({
    id: z.string().optional(),
    fromStageId: z.string(),
    toStageId: z.string(),
    triggerEvent: z.string(),
    conditions: z.unknown().optional(),
    isActive: z.boolean().optional(),
  })).optional(),
  rules: z.array(z.object({
    id: z.string().optional(),
    name: z.string(),
    triggerEvent: z.string(),
    conditions: z.unknown(),
    actions: z.unknown(),
    priority: z.number().optional(),
    isActive: z.boolean().optional(),
  })).optional(),
});

export class AppointmentAutomationController {
  async listTemplates(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await appointmentWorkflowBuilderService.listTemplates();
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async listWorkflows(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await appointmentWorkflowBuilderService.listWorkflows(req.user!.businessId!);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getWorkflow(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await appointmentWorkflowBuilderService.getWorkflow(
        req.user!.businessId!,
        routeParam(req.params.workflowId)
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async createFromTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const { templateKey, isDefault } = z
        .object({ templateKey: z.string(), isDefault: z.boolean().optional() })
        .parse(req.body);
      const data = await appointmentWorkflowBuilderService.createFromTemplate(
        req.user!.businessId!,
        templateKey,
        isDefault ?? false
      );
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async updateWorkflow(req: Request, res: Response, next: NextFunction) {
    try {
      const body = updateWorkflowSchema.parse(req.body);
      const data = await appointmentWorkflowBuilderService.updateWorkflow(
        req.user!.businessId!,
        routeParam(req.params.workflowId),
        body as Parameters<typeof appointmentWorkflowBuilderService.updateWorkflow>[2]
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async duplicateWorkflow(req: Request, res: Response, next: NextFunction) {
    try {
      const { name } = z.object({ name: z.string() }).parse(req.body);
      const data = await appointmentWorkflowBuilderService.duplicateWorkflow(
        req.user!.businessId!,
        routeParam(req.params.workflowId),
        name
      );
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await appointmentWorkflowBuilderService.getSettings(req.user!.businessId!);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async updateSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await appointmentWorkflowBuilderService.updateSettings(
        req.user!.businessId!,
        req.body
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async listReminders(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await appointmentWorkflowBuilderService.listReminderConfigs(req.user!.businessId!);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async updateReminders(req: Request, res: Response, next: NextFunction) {
    try {
      const { configs } = z.object({ configs: z.array(z.object({
        id: z.string().optional(),
        label: z.string(),
        offsetMinutes: z.number(),
        channels: z.array(z.string()).optional(),
        template: z.string().optional(),
        isEnabled: z.boolean().optional(),
        sortOrder: z.number().optional(),
      })) }).parse(req.body);
      const data = await appointmentWorkflowBuilderService.updateReminderConfigs(
        req.user!.businessId!,
        configs
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getTimeline(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await appointmentTimelineService.listForAppointment(
        req.user!.businessId!,
        routeParam(req.params.appointmentId)
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getExecutions(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await appointmentWorkflowAuditService.listForAppointment(
        req.user!.businessId!,
        routeParam(req.params.appointmentId)
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async transitionStage(req: Request, res: Response, next: NextFunction) {
    try {
      const { stageKey } = z.object({ stageKey: z.string() }).parse(req.body);
      await appointmentWorkflowEngineService.transitionToStage(
        req.user!.businessId!,
        routeParam(req.params.appointmentId),
        stageKey,
        req.user!.userId
      );
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  async analytics(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await appointmentAnalyticsService.getDashboard(req.user!.businessId!);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async aiInsights(req: Request, res: Response, next: NextFunction) {
    try {
      const [analysis, suggestions] = await Promise.all([
        appointmentAiWorkflowService.analyzeAppointment(
          req.user!.businessId!,
          routeParam(req.params.appointmentId)
        ),
        appointmentAiWorkflowService.suggestBetterTimes(
          req.user!.businessId!,
          routeParam(req.params.appointmentId)
        ),
      ]);
      res.json({ success: true, data: { analysis, suggestions } });
    } catch (error) {
      next(error);
    }
  }
}

export const appointmentAutomationController = new AppointmentAutomationController();
