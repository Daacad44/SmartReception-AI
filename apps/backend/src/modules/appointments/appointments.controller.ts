import { Request, Response, NextFunction } from 'express';
import { routeParam } from '../../core/utils';
import { appointmentsService } from './appointments.service';
import {
  createAppointmentSchema,
  updateAppointmentSchema,
  paginationSchema,
  appointmentActionSchema,
  addInternalNoteSchema,
} from '@smartreception/shared';
import { z } from 'zod';

const calendarQuerySchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

const availabilityQuerySchema = z.object({
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  excludeId: z.string().uuid().optional(),
});

export class AppointmentsController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const params = paginationSchema.parse(req.query);
      const status = req.query.status as string | undefined;
      const customerId = req.query.customerId as string | undefined;
      const result = await appointmentsService.list(req.user!.businessId!, {
        ...params,
        status,
        customerId,
      });
      res.json({ success: true, data: result.data, meta: result.meta });
    } catch (error) {
      next(error);
    }
  }

  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const detailed = req.query.detail === 'true';
      const appointment = detailed
        ? await appointmentsService.getDetail(req.user!.businessId!, routeParam(req.params.id))
        : await appointmentsService.get(req.user!.businessId!, routeParam(req.params.id));
      res.json({ success: true, data: appointment });
    } catch (error) {
      next(error);
    }
  }

  async performAction(req: Request, res: Response, next: NextFunction) {
    try {
      const { action, assignedToId, startTime, endTime, internalNote } =
        appointmentActionSchema.parse(req.body);
      const appointment = await appointmentsService.performAction(
        req.user!.businessId!,
        routeParam(req.params.id),
        action,
        req.user!.userId,
        { assignedToId, startTime, endTime, internalNote }
      );
      res.json({ success: true, data: appointment });
    } catch (error) {
      next(error);
    }
  }

  async addNote(req: Request, res: Response, next: NextFunction) {
    try {
      const { content } = addInternalNoteSchema.parse(req.body);
      const note = await appointmentsService.addInternalNote(
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

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const input = createAppointmentSchema.parse(req.body);
      const appointment = await appointmentsService.create(
        req.user!.businessId!,
        input,
        req.user!.userId
      );
      res.status(201).json({ success: true, data: appointment });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const input = updateAppointmentSchema.parse(req.body);
      const appointment = await appointmentsService.update(
        req.user!.businessId!,
        routeParam(req.params.id),
        input,
        req.user!.userId
      );
      res.json({ success: true, data: appointment });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await appointmentsService.delete(req.user!.businessId!, routeParam(req.params.id), req.user!.userId);
      res.json({ success: true, message: 'Appointment cancelled successfully' });
    } catch (error) {
      next(error);
    }
  }

  async calendar(req: Request, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = calendarQuerySchema.parse(req.query);
      const appointments = await appointmentsService.getCalendar(
        req.user!.businessId!,
        startDate,
        endDate
      );
      res.json({ success: true, data: appointments });
    } catch (error) {
      next(error);
    }
  }

  async availability(req: Request, res: Response, next: NextFunction) {
    try {
      const { startTime, endTime, excludeId } = availabilityQuerySchema.parse(req.query);
      const result = await appointmentsService.checkAvailability(
        req.user!.businessId!,
        startTime,
        endTime,
        excludeId
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

export const appointmentsController = new AppointmentsController();
