import type { NextFunction, Request, Response } from 'express';
import { aiAgentStudioService } from './ai-agent-studio.service';
import {
  createAgentReleaseSchema,
  updateAgentDraftSchema,
  updateAgentSchema,
  upsertAgentSkillSchema,
} from './ai-agent-studio.schemas';

export class AiAgentStudioController {
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
