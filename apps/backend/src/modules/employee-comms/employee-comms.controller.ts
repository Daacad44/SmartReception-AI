import { Request, Response, NextFunction } from 'express';
import { employeesService } from './employees.service';
import { employeeGroupsService } from './employee-groups.service';
import { employeeBroadcastsService } from './employee-broadcasts.service';
import { employeeTemplatesService } from './employee-templates.service';
import { employeeInboxService } from './employee-inbox.service';
import { generateEmployeeMessageWithAi } from './employee-ai-generator.service';
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  createEmployeeGroupSchema,
  updateEmployeeGroupSchema,
  createEmployeeBroadcastSchema,
  createEmployeeTemplateSchema,
  updateEmployeeTemplateSchema,
  generateEmployeeMessageSchema,
  paginationSchema,
  sendEmployeeReplySchema,
} from '@smartreception/shared';
import { routeParam } from '../../core/utils';

export class EmployeeCommsController {
  // Employees
  async listEmployees(req: Request, res: Response, next: NextFunction) {
    try {
      const params = paginationSchema.parse(req.query);
      const department = typeof req.query.department === 'string' ? req.query.department : undefined;
      const branch = typeof req.query.branch === 'string' ? req.query.branch : undefined;
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      const groupId = typeof req.query.groupId === 'string' ? req.query.groupId : undefined;
      const result = await employeesService.list(req.user!.businessId!, {
        ...params,
        department,
        branch,
        status,
        groupId,
      });
      res.json({ success: true, data: result.data, meta: result.meta });
    } catch (error) {
      next(error);
    }
  }

  async getEmployee(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await employeesService.get(req.user!.businessId!, routeParam(req.params.id));
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async createEmployee(req: Request, res: Response, next: NextFunction) {
    try {
      const input = createEmployeeSchema.parse(req.body);
      const data = await employeesService.create(req.user!.businessId!, input);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async updateEmployee(req: Request, res: Response, next: NextFunction) {
    try {
      const input = updateEmployeeSchema.parse(req.body);
      const data = await employeesService.update(req.user!.businessId!, routeParam(req.params.id), input);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async deleteEmployee(req: Request, res: Response, next: NextFunction) {
    try {
      await employeesService.softDelete(req.user!.businessId!, routeParam(req.params.id));
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  // Groups
  async listGroups(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await employeeGroupsService.list(req.user!.businessId!);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async createGroup(req: Request, res: Response, next: NextFunction) {
    try {
      const input = createEmployeeGroupSchema.parse(req.body);
      const data = await employeeGroupsService.create(req.user!.businessId!, input);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async updateGroup(req: Request, res: Response, next: NextFunction) {
    try {
      const input = updateEmployeeGroupSchema.parse(req.body);
      const data = await employeeGroupsService.update(
        req.user!.businessId!,
        routeParam(req.params.id),
        input
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async deleteGroup(req: Request, res: Response, next: NextFunction) {
    try {
      await employeeGroupsService.delete(req.user!.businessId!, routeParam(req.params.id));
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  // Broadcasts
  async listBroadcasts(req: Request, res: Response, next: NextFunction) {
    try {
      const params = paginationSchema.parse(req.query);
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      const result = await employeeBroadcastsService.list(req.user!.businessId!, { ...params, status });
      res.json({ success: true, data: result.data, meta: result.meta });
    } catch (error) {
      next(error);
    }
  }

  async getBroadcast(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await employeeBroadcastsService.get(req.user!.businessId!, routeParam(req.params.id));
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async createBroadcast(req: Request, res: Response, next: NextFunction) {
    try {
      const input = createEmployeeBroadcastSchema.parse(req.body);
      const data = await employeeBroadcastsService.create(
        req.user!.businessId!,
        input,
        req.user!.userId
      );
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async sendBroadcast(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await employeeBroadcastsService.sendNow(req.user!.businessId!, routeParam(req.params.id));
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async pauseBroadcast(req: Request, res: Response, next: NextFunction) {
    try {
      await employeeBroadcastsService.pause(req.user!.businessId!, routeParam(req.params.id));
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  async resumeBroadcast(req: Request, res: Response, next: NextFunction) {
    try {
      await employeeBroadcastsService.resume(req.user!.businessId!, routeParam(req.params.id));
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  async cancelBroadcast(req: Request, res: Response, next: NextFunction) {
    try {
      await employeeBroadcastsService.cancel(req.user!.businessId!, routeParam(req.params.id));
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  async broadcastAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await employeeBroadcastsService.analytics(req.user!.businessId!);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async deliveries(req: Request, res: Response, next: NextFunction) {
    try {
      const params = paginationSchema.parse(req.query);
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      const result = await employeeBroadcastsService.deliveries(req.user!.businessId!, { ...params, status });
      res.json({ success: true, data: result.data, meta: result.meta });
    } catch (error) {
      next(error);
    }
  }

  async generateAi(req: Request, res: Response, next: NextFunction) {
    try {
      const input = generateEmployeeMessageSchema.parse(req.body);
      const data = await generateEmployeeMessageWithAi(req.user!.businessId!, input);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  // Templates
  async listTemplates(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await employeeTemplatesService.list(req.user!.businessId!);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async createTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const input = createEmployeeTemplateSchema.parse(req.body);
      const data = await employeeTemplatesService.create(req.user!.businessId!, input);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async updateTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const input = updateEmployeeTemplateSchema.parse(req.body);
      const data = await employeeTemplatesService.update(
        req.user!.businessId!,
        routeParam(req.params.id),
        input
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async deleteTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      await employeeTemplatesService.delete(req.user!.businessId!, routeParam(req.params.id));
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  // Inbox
  async listInbox(req: Request, res: Response, next: NextFunction) {
    try {
      const params = paginationSchema.parse(req.query);
      const archived = req.query.archived === 'true';
      const result = await employeeInboxService.listConversations(req.user!.businessId!, {
        ...params,
        archived,
      });
      res.json({ success: true, data: result.data, meta: result.meta });
    } catch (error) {
      next(error);
    }
  }

  async getInboxConversation(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await employeeInboxService.getConversation(
        req.user!.businessId!,
        routeParam(req.params.id)
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async replyInbox(req: Request, res: Response, next: NextFunction) {
    try {
      const { content } = sendEmployeeReplySchema.parse(req.body);
      const data = await employeeInboxService.sendReply(
        req.user!.businessId!,
        routeParam(req.params.id),
        content,
        req.user!.userId
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async archiveInbox(req: Request, res: Response, next: NextFunction) {
    try {
      await employeeInboxService.archive(req.user!.businessId!, routeParam(req.params.id));
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
}

export const employeeCommsController = new EmployeeCommsController();
