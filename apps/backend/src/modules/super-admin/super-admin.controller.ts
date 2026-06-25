import { Request, Response, NextFunction } from 'express';
import { superAdminService } from './super-admin.service';
import {
  paginationSchema,
  superAdminCreateBusinessSchema,
  superAdminUpdateBusinessSchema,
  superAdminCreateUserSchema,
  superAdminUpdateUserSchema,
  transferOwnershipSchema,
} from '@smartreception/shared';
import { routeParam } from '../../core/utils';
import { z } from 'zod';

export class SuperAdminController {
  async stats(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await superAdminService.getPlatformStats();
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async businesses(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit } = paginationSchema.parse(req.query);
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;
      const result = await superAdminService.listBusinesses(page, limit, search);
      res.json({ success: true, data: result.data, meta: result.meta });
    } catch (error) {
      next(error);
    }
  }

  async getBusiness(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await superAdminService.getBusiness(routeParam(req.params.id));
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async createBusiness(req: Request, res: Response, next: NextFunction) {
    try {
      const input = superAdminCreateBusinessSchema.parse(req.body);
      const data = await superAdminService.createBusiness(input, req.user!.userId);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async updateBusiness(req: Request, res: Response, next: NextFunction) {
    try {
      const input = superAdminUpdateBusinessSchema.parse(req.body);
      const data = await superAdminService.updateBusiness(
        routeParam(req.params.id),
        input,
        req.user!.userId
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async deleteBusiness(req: Request, res: Response, next: NextFunction) {
    try {
      await superAdminService.deleteBusiness(routeParam(req.params.id), req.user!.userId);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  async transferOwnership(req: Request, res: Response, next: NextFunction) {
    try {
      const input = transferOwnershipSchema.parse(req.body);
      await superAdminService.transferOwnership(routeParam(req.params.id), input, req.user!.userId);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  async users(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit } = paginationSchema.parse(req.query);
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;
      const result = await superAdminService.listUsers(page, limit, search);
      res.json({ success: true, data: result.data, meta: result.meta });
    } catch (error) {
      next(error);
    }
  }

  async createUser(req: Request, res: Response, next: NextFunction) {
    try {
      const input = superAdminCreateUserSchema.parse(req.body);
      const data = await superAdminService.createUser(input, req.user!.userId);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async updateUser(req: Request, res: Response, next: NextFunction) {
    try {
      const input = superAdminUpdateUserSchema.parse(req.body);
      const data = await superAdminService.updateUser(routeParam(req.params.id), input, req.user!.userId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async deleteUser(req: Request, res: Response, next: NextFunction) {
    try {
      await superAdminService.deleteUser(routeParam(req.params.id), req.user!.userId);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { password } = z.object({ password: z.string().min(8).max(128) }).parse(req.body);
      await superAdminService.resetPassword(routeParam(req.params.id), password, req.user!.userId);
      res.json({ success: true, message: 'Password reset successfully' });
    } catch (error) {
      next(error);
    }
  }

  async toggleBusiness(req: Request, res: Response, next: NextFunction) {
    try {
      const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body);
      const business = await superAdminService.toggleBusinessActive(
        routeParam(req.params.id),
        isActive,
        req.user!.userId
      );
      res.json({ success: true, data: business });
    } catch (error) {
      next(error);
    }
  }

  async impersonateBusiness(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await superAdminService.impersonateBusiness(
        routeParam(req.params.id),
        req.user!.userId,
        req.user!.email
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async listCampaigns(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit } = paginationSchema.parse(req.query);
      const businessId = typeof req.query.businessId === 'string' ? req.query.businessId : undefined;
      const result = await superAdminService.listCampaigns(page, limit, businessId);
      res.json({ success: true, data: result.data, meta: result.meta });
    } catch (error) {
      next(error);
    }
  }

  async campaignStats(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await superAdminService.getCampaignStats();
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async pauseCampaign(req: Request, res: Response, next: NextFunction) {
    try {
      await superAdminService.pauseCampaign(routeParam(req.params.id), req.user!.userId);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
}

export const superAdminController = new SuperAdminController();
