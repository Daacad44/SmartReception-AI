import { Request, Response, NextFunction } from 'express';
import { routeParam } from '../../core/utils';
import { knowledgeService } from './knowledge.service';
import { createFaqSchema, knowledgeSearchSchema } from '@smartreception/shared';
import { withGovernanceGuard } from '../governance/governance.helpers';

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
      if (
        await withGovernanceGuard(req, res, 'AI_UPLOAD_DOCUMENT', {
          title: req.body.title,
          knowledgeBaseId: req.body.knowledgeBaseId,
        }, { file: req.file })
      ) {
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
      if (await withGovernanceGuard(req, res, 'AI_CREATE_FAQ', input)) {
        return;
      }
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
      if (
        await withGovernanceGuard(req, res, 'AI_UPDATE_FAQ', {
          documentId: routeParam(req.params.id),
          ...input,
        })
      ) {
        return;
      }
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
      if (
        await withGovernanceGuard(req, res, 'AI_DELETE_FAQ', {
          documentId: routeParam(req.params.id),
        })
      ) {
        return;
      }
      await knowledgeService.deleteFaq(req.user!.businessId!, routeParam(req.params.id), req.user!.userId);
      res.json({ success: true, message: 'FAQ deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  async processDocument(req: Request, res: Response, next: NextFunction) {
    try {
      const document = await knowledgeService.processDocument(
        req.user!.businessId!,
        routeParam(req.params.id)
      );
      res.json({ success: true, data: document });
    } catch (error) {
      next(error);
    }
  }

  async getDocumentStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const status = await knowledgeService.getDocumentStatus(
        req.user!.businessId!,
        routeParam(req.params.id)
      );
      res.json({ success: true, data: status });
    } catch (error) {
      next(error);
    }
  }

  async deleteDocument(req: Request, res: Response, next: NextFunction) {
    try {
      if (
        await withGovernanceGuard(req, res, 'AI_DELETE_DOCUMENT', {
          documentId: routeParam(req.params.id),
        })
      ) {
        return;
      }
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

  async search(req: Request, res: Response, next: NextFunction) {
    try {
      const { q, limit } = knowledgeSearchSchema.parse(req.query);
      const results = await knowledgeService.searchDocuments(req.user!.businessId!, q, limit);
      res.json({ success: true, data: results });
    } catch (error) {
      next(error);
    }
  }

  async clearKnowledgeBase(req: Request, res: Response, next: NextFunction) {
    try {
      if (await withGovernanceGuard(req, res, 'AI_CLEAR_KNOWLEDGE', {})) {
        return;
      }
      const data = await knowledgeService.clearKnowledgeBase(
        req.user!.businessId!,
        req.user!.userId
      );
      res.json({ success: true, data, message: 'Knowledge base cleared successfully' });
    } catch (error) {
      next(error);
    }
  }
}

export const knowledgeController = new KnowledgeController();
