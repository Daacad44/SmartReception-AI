import { Request, Response, NextFunction } from 'express';
import { customersService } from './customers.service';
import {
  createCustomerSchema,
  updateCustomerSchema,
  paginationSchema,
} from '@smartreception/shared';
import { z } from 'zod';
import { routeParam } from '../../core/utils';

const createTagSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

const assignTagsSchema = z.object({
  tagIds: z.array(z.string().uuid()),
});

const addNoteSchema = z.object({
  content: z.string().min(1).max(5000),
});

export class CustomersController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const params = paginationSchema.parse(req.query);
      const tagId = req.query.tagId as string | undefined;
      const result = await customersService.list(req.user!.businessId!, { ...params, tagId });
      res.json({ success: true, data: result.data, meta: result.meta });
    } catch (error) {
      next(error);
    }
  }

  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const customer = await customersService.get(req.user!.businessId!, routeParam(req.params.id));
      res.json({ success: true, data: customer });
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const input = createCustomerSchema.parse(req.body);
      const customer = await customersService.create(
        req.user!.businessId!,
        input,
        req.user!.userId
      );
      res.status(201).json({ success: true, data: customer });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const input = updateCustomerSchema.parse(req.body);
      const customer = await customersService.update(
        req.user!.businessId!,
        routeParam(req.params.id),
        input,
        req.user!.userId
      );
      res.json({ success: true, data: customer });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await customersService.delete(req.user!.businessId!, routeParam(req.params.id), req.user!.userId);
      res.json({ success: true, message: 'Customer deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  async listTags(req: Request, res: Response, next: NextFunction) {
    try {
      const tags = await customersService.listTags(req.user!.businessId!);
      res.json({ success: true, data: tags });
    } catch (error) {
      next(error);
    }
  }

  async createTag(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, color } = createTagSchema.parse(req.body);
      const tag = await customersService.createTag(req.user!.businessId!, name, color);
      res.status(201).json({ success: true, data: tag });
    } catch (error) {
      next(error);
    }
  }

  async deleteTag(req: Request, res: Response, next: NextFunction) {
    try {
      await customersService.deleteTag(req.user!.businessId!, routeParam(req.params.tagId));
      res.json({ success: true, message: 'Tag deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  async assignTags(req: Request, res: Response, next: NextFunction) {
    try {
      const { tagIds } = assignTagsSchema.parse(req.body);
      const customer = await customersService.assignTags(
        req.user!.businessId!,
        routeParam(req.params.id),
        tagIds
      );
      res.json({ success: true, data: customer });
    } catch (error) {
      next(error);
    }
  }

  async addNote(req: Request, res: Response, next: NextFunction) {
    try {
      const { content } = addNoteSchema.parse(req.body);
      const note = await customersService.addNote(
        req.user!.businessId!,
        routeParam(req.params.id),
        content,
        req.user!.userId
      );
      res.status(201).json({ success: true, data: note });
    } catch (error) {
      next(error);
    }
  }

  async getNotes(req: Request, res: Response, next: NextFunction) {
    try {
      const notes = await customersService.getNotes(req.user!.businessId!, routeParam(req.params.id));
      res.json({ success: true, data: notes });
    } catch (error) {
      next(error);
    }
  }

  async getTimeline(req: Request, res: Response, next: NextFunction) {
    try {
      const timeline = await customersService.getTimeline(
        req.user!.businessId!,
        routeParam(req.params.id)
      );
      res.json({ success: true, data: timeline });
    } catch (error) {
      next(error);
    }
  }

  async getInsights(req: Request, res: Response, next: NextFunction) {
    try {
      const insights = await customersService.getInsights(
        req.user!.businessId!,
        routeParam(req.params.id)
      );
      res.json({ success: true, data: insights });
    } catch (error) {
      next(error);
    }
  }

  async getProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const profile = await customersService.getProfile(
        req.user!.businessId!,
        routeParam(req.params.id)
      );
      res.json({ success: true, data: profile });
    } catch (error) {
      next(error);
    }
  }
}

export const customersController = new CustomersController();
