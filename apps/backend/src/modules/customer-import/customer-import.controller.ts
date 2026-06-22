import { Request, Response, NextFunction } from 'express';
import { customerImportService } from './customer-import.service';
import { routeParam } from '../../core/utils';

export class CustomerImportController {
  async listJobs(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await customerImportService.listJobs(req.user!.businessId!);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getJob(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await customerImportService.getJob(
        req.user!.businessId!,
        routeParam(req.params.id)
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async upload(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, message: 'No file uploaded' });
        return;
      }
      const data = await customerImportService.processUpload(
        req.user!.businessId!,
        req.user!.userId,
        req.file
      );
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

export const customerImportController = new CustomerImportController();
