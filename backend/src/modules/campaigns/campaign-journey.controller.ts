import { Request, Response, NextFunction } from 'express';
import { campaignJourneyService } from './campaign-journey.service';
import { createJourneySchema, enrollJourneySchema } from '@smartreception/shared';
import { routeParam } from '../../core/utils';

export class CampaignJourneyController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await campaignJourneyService.list(req.user!.businessId!);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await campaignJourneyService.get(req.user!.businessId!, routeParam(req.params.id));
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const input = createJourneySchema.parse(req.body);
      const data = await campaignJourneyService.create(req.user!.businessId!, input);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async activate(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await campaignJourneyService.activate(req.user!.businessId!, routeParam(req.params.id));
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async pause(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await campaignJourneyService.pause(req.user!.businessId!, routeParam(req.params.id));
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async enroll(req: Request, res: Response, next: NextFunction) {
    try {
      const { customerId } = enrollJourneySchema.parse(req.body);
      const data = await campaignJourneyService.enrollCustomer(
        req.user!.businessId!,
        routeParam(req.params.id),
        customerId
      );
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

export const campaignJourneyController = new CampaignJourneyController();
