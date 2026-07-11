import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { routeParam } from '../../core/utils';
import { appointmentSchedulingService } from './appointment-scheduling.service';
import {
  updateAppointmentSettingsSchema,
  businessExceptionSchema,
  updateBusinessExceptionSchema,
} from '@smartreception/shared';

const dayQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
});

const upcomingQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(60).default(7),
});

export class AppointmentSchedulingController {
  async getSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await appointmentSchedulingService.getSettings(req.user!.businessId!);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async updateSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const input = updateAppointmentSettingsSchema.parse(req.body);
      const data = await appointmentSchedulingService.updateSettings(req.user!.businessId!, input);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async listExceptions(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await appointmentSchedulingService.listExceptions(req.user!.businessId!);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async createException(req: Request, res: Response, next: NextFunction) {
    try {
      const input = businessExceptionSchema.parse(req.body);
      const data = await appointmentSchedulingService.createException(req.user!.businessId!, input);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async updateException(req: Request, res: Response, next: NextFunction) {
    try {
      const input = updateBusinessExceptionSchema.parse(req.body);
      const data = await appointmentSchedulingService.updateException(
        req.user!.businessId!,
        routeParam(req.params.id),
        input
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async deleteException(req: Request, res: Response, next: NextFunction) {
    try {
      await appointmentSchedulingService.deleteException(
        req.user!.businessId!,
        routeParam(req.params.id)
      );
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  async day(req: Request, res: Response, next: NextFunction) {
    try {
      const { date } = dayQuerySchema.parse(req.query);
      const data = await appointmentSchedulingService.getDay(req.user!.businessId!, date);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async upcoming(req: Request, res: Response, next: NextFunction) {
    try {
      const { days } = upcomingQuerySchema.parse(req.query);
      const data = await appointmentSchedulingService.getUpcoming(req.user!.businessId!, days);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async workingHours(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await appointmentSchedulingService.getWorkingHours(req.user!.businessId!);
      res.json({ success: true, data: { summary: data } });
    } catch (error) {
      next(error);
    }
  }
}

export const appointmentSchedulingController = new AppointmentSchedulingController();
