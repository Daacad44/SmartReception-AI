import { Request, Response, NextFunction } from 'express';
import { routeParam } from '../../core/utils';
import { knowledgeService } from './knowledge.service';
import { createFaqSchema } from '@smartreception/shared';

export class KnowledgeController {
  async listBases(req: Request, res: Response, next: NextFunction) {
    try {
      const bases = await knowledgeService.listBases(req.user!.businessId!);
      res.json({ success: true, data: bases });
    } catch (error) {
      next(error);
    }
  }

  async getBase(req: Request, res: Response, next: NextFunction) {
    try {
      const base = await knowledgeService.getBase(req.user!.businessId!, routeParam(req.params.id));
      res.json({ success: true, data: base });
    } catch (error) {
      next(error);
    }
  }

  async uploadDocument(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, error: 'No file uploaded' });
        return;
      }
      const document = await knowledgeService.uploadDocument(
        req.user!.businessId!,
        req.file,
        req.body.title,
        req.body.knowledgeBaseId
      );
      res.status(201).json({ success: true, data: document });
    } catch (error) {
      next(error);
    }
  }

  async listFaqs(req: Request, res: Response, next: NextFunction) {
    try {
      const knowledgeBaseId = req.query.knowledgeBaseId as string | undefined;
      const faqs = await knowledgeService.listFaqs(req.user!.businessId!, knowledgeBaseId);
      res.json({ success: true, data: faqs });
    } catch (error) {
      next(error);
    }
  }

  async createFaq(req: Request, res: Response, next: NextFunction) {
    try {
      const input = createFaqSchema.parse(req.body);
      const faq = await knowledgeService.createFaq(
        req.user!.businessId!,
        input,
        req.user!.userId
      );
      res.status(201).json({ success: true, data: faq });
    } catch (error) {
      next(error);
    }
  }

  async updateFaq(req: Request, res: Response, next: NextFunction) {
    try {
      const input = createFaqSchema.partial().parse(req.body);
      const faq = await knowledgeService.updateFaq(
        req.user!.businessId!,
        routeParam(req.params.id),
        input,
        req.user!.userId
      );
      res.json({ success: true, data: faq });
    } catch (error) {
      next(error);
    }
  }

  async deleteFaq(req: Request, res: Response, next: NextFunction) {
    try {
      await knowledgeService.deleteFaq(req.user!.businessId!, routeParam(req.params.id), req.user!.userId);
      res.json({ success: true, message: 'FAQ deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  async deleteDocument(req: Request, res: Response, next: NextFunction) {
    try {
      await knowledgeService.deleteDocument(
        req.user!.businessId!,
        routeParam(req.params.id),
        req.user!.userId
      );
      res.json({ success: true, message: 'Document deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}

export const knowledgeController = new KnowledgeController();
