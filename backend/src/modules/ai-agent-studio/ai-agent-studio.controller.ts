import type { NextFunction, Request, Response } from 'express';
import { aiAgentStudioService } from './ai-agent-studio.service';
import {
  applyAgentDiscoverySchema,
  attachAgentKnowledgeSchema,
  reviewAgentKnowledgeSchema,
  createAgentReleaseSchema,
  updateAgentDraftSchema,
  updateAgentSchema,
  upsertAgentSkillSchema,
} from './ai-agent-studio.schemas';
import { agentDiscoveryService } from './agent-discovery.service';
import { agentKnowledgeService } from './agent-knowledge.service';
import { agentEvaluationService } from './agent-evaluation.service';

export class AiAgentStudioController {
  listKnowledge = async (req: Request, res: Response, next: NextFunction) => {
    try { res.json({ success: true, data: await agentKnowledgeService.list(req.user!.businessId!, String(req.params.agentId)) }); }
    catch (error) { next(error); }
  };

  attachKnowledge = async (req: Request, res: Response, next: NextFunction) => {
    try { const input = attachAgentKnowledgeSchema.parse(req.body); res.status(201).json({ success: true, data: await agentKnowledgeService.attach(req.user!.businessId!, String(req.params.agentId), input, req.user!.userId) }); }
    catch (error) { next(error); }
  };

  reviewKnowledge = async (req: Request, res: Response, next: NextFunction) => {
    try { const input = reviewAgentKnowledgeSchema.parse(req.body); res.json({ success: true, data: await agentKnowledgeService.review(req.user!.businessId!, String(req.params.agentId), String(req.params.sourceId), input, req.user!.userId) }); }
    catch (error) { next(error); }
  };

  evaluateRelease = async (req: Request, res: Response, next: NextFunction) => {
    try { res.status(201).json({ success: true, data: await agentEvaluationService.evaluate(req.user!.businessId!, String(req.params.agentId), String(req.params.releaseId), req.user!.userId) }); }
    catch (error) { next(error); }
  };

  listEvaluations = async (req: Request, res: Response, next: NextFunction) => {
    try { res.json({ success: true, data: await agentEvaluationService.list(req.user!.businessId!, String(req.params.agentId)) }); }
    catch (error) { next(error); }
  };

  listDiscoveryTemplates = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ success: true, data: agentDiscoveryService.listTemplates() });
    } catch (error) { next(error); }
  };

  getDiscovery = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await agentDiscoveryService.getDiscovery(req.user!.businessId!, String(req.params.agentId));
      res.json({ success: true, data });
    } catch (error) { next(error); }
  };

  applyDiscovery = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = applyAgentDiscoverySchema.parse(req.body);
      const data = await agentDiscoveryService.apply(
        req.user!.businessId!, String(req.params.agentId), input, req.user!.userId
      );
      res.json({ success: true, data });
    } catch (error) { next(error); }
  };

  listAgents = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await aiAgentStudioService.listAgents(req.user!.businessId!, req.user!.userId);
      res.json({ success: true, data });
    } catch (error) { next(error); }
  };

  getAgent = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await aiAgentStudioService.getAgent(
        req.user!.businessId!,
        String(req.params.agentId)
      );
      res.json({ success: true, data });
    } catch (error) { next(error); }
  };

  updateAgent = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = updateAgentSchema.parse(req.body);
      const data = await aiAgentStudioService.updateAgent(
        req.user!.businessId!,
        String(req.params.agentId),
        input,
        req.user!.userId
      );
      res.json({ success: true, data });
    } catch (error) { next(error); }
  };

  updateDraft = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = updateAgentDraftSchema.parse(req.body);
      const data = await aiAgentStudioService.updateDraft(
        req.user!.businessId!,
        String(req.params.agentId),
        input,
        req.user!.userId
      );
      res.json({ success: true, data });
    } catch (error) { next(error); }
  };

  createRelease = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = createAgentReleaseSchema.parse(req.body);
      const data = await aiAgentStudioService.createRelease(
        req.user!.businessId!,
        String(req.params.agentId),
        input,
        req.user!.userId
      );
      res.status(201).json({ success: true, data });
    } catch (error) { next(error); }
  };

  upsertSkill = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = upsertAgentSkillSchema.parse(req.body);
      const data = await aiAgentStudioService.upsertSkill(
        req.user!.businessId!,
        String(req.params.agentId),
        String(req.params.skillKey),
        input,
        req.user!.userId
      );
      res.json({ success: true, data });
    } catch (error) { next(error); }
  };
}

export const aiAgentStudioController = new AiAgentStudioController();
