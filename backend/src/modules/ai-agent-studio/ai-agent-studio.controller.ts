import type { NextFunction, Request, Response } from 'express';
import { aiAgentStudioService } from './ai-agent-studio.service';
import {
  applyAgentDiscoverySchema,
  attachAgentKnowledgeSchema,
  reviewAgentKnowledgeSchema,
  agentAnalyticsQuerySchema,
  createAgentSchema,
  reviewAgentReleaseSchema,
  updateAgentGovernanceSchema,
  updateAgentRolloutSchema,
  upsertAgentRoutingRuleSchema,
  saveWorkflowSchema,
  runSimulationSchema,
  resolveIncidentSchema,
  upsertChannelBindingSchema,
  createAgentReleaseSchema,
  updateAgentDraftSchema,
  updateAgentSchema,
  upsertAgentSkillSchema,
} from './ai-agent-studio.schemas';
import { agentDiscoveryService } from './agent-discovery.service';
import { agentKnowledgeService } from './agent-knowledge.service';
import { agentEvaluationService } from './agent-evaluation.service';
import { agentAnalyticsService } from './agent-analytics.service';
import { agentGovernanceService } from './agent-governance.service';
import { agentRolloutService } from './agent-rollout.service';
import { agentRoutingService } from './agent-routing.service';
import { agentWorkflowService } from './agent-workflow.service';
import { agentSimulationService } from './agent-simulation.service';
import { agentOperationsService } from './agent-operations.service';

export class AiAgentStudioController {
  listWorkflows = async (req: Request, res: Response, next: NextFunction) => { try { res.json({ success: true, data: await agentWorkflowService.list(req.user!.businessId!, String(req.params.agentId)) }); } catch (error) { next(error); } };
  createWorkflow = async (req: Request, res: Response, next: NextFunction) => { try { res.status(201).json({ success: true, data: await agentWorkflowService.save(req.user!.businessId!, String(req.params.agentId), undefined, saveWorkflowSchema.parse(req.body), req.user!.userId) }); } catch (error) { next(error); } };
  updateWorkflow = async (req: Request, res: Response, next: NextFunction) => { try { res.json({ success: true, data: await agentWorkflowService.save(req.user!.businessId!, String(req.params.agentId), String(req.params.workflowId), saveWorkflowSchema.parse(req.body), req.user!.userId) }); } catch (error) { next(error); } };
  listSimulations = async (req: Request, res: Response, next: NextFunction) => { try { res.json({ success: true, data: await agentSimulationService.list(req.user!.businessId!, String(req.params.agentId)) }); } catch (error) { next(error); } };
  runSimulation = async (req: Request, res: Response, next: NextFunction) => { try { res.status(201).json({ success: true, data: await agentSimulationService.run(req.user!.businessId!, String(req.params.agentId), runSimulationSchema.parse(req.body), req.user!.userId) }); } catch (error) { next(error); } };
  listIncidents = async (req: Request, res: Response, next: NextFunction) => { try { res.json({ success: true, data: await agentOperationsService.listIncidents(req.user!.businessId!, String(req.params.agentId)) }); } catch (error) { next(error); } };
  scanOperations = async (req: Request, res: Response, next: NextFunction) => { try { res.json({ success: true, data: await agentOperationsService.scan(req.user!.businessId!, String(req.params.agentId), req.user!.userId) }); } catch (error) { next(error); } };
  resolveIncident = async (req: Request, res: Response, next: NextFunction) => { try { res.json({ success: true, data: await agentOperationsService.resolveIncident(req.user!.businessId!, String(req.params.incidentId), resolveIncidentSchema.parse(req.body), req.user!.userId) }); } catch (error) { next(error); } };
  listChannels = async (req: Request, res: Response, next: NextFunction) => { try { res.json({ success: true, data: await agentOperationsService.listChannels(req.user!.businessId!, String(req.params.agentId)) }); } catch (error) { next(error); } };
  upsertChannel = async (req: Request, res: Response, next: NextFunction) => { try { res.json({ success: true, data: await agentOperationsService.upsertChannel(req.user!.businessId!, String(req.params.agentId), upsertChannelBindingSchema.parse(req.body), req.user!.userId) }); } catch (error) { next(error); } };
  createAgent = async (req: Request, res: Response, next: NextFunction) => {
    try { res.status(201).json({ success: true, data: await aiAgentStudioService.createAgent(req.user!.businessId!, createAgentSchema.parse(req.body), req.user!.userId) }); } catch (error) { next(error); }
  };
  getGovernance = async (req: Request, res: Response, next: NextFunction) => {
    try { res.json({ success: true, data: await agentGovernanceService.get(req.user!.businessId!, String(req.params.agentId)) }); } catch (error) { next(error); }
  };
  updateGovernance = async (req: Request, res: Response, next: NextFunction) => {
    try { res.json({ success: true, data: await agentGovernanceService.update(req.user!.businessId!, String(req.params.agentId), updateAgentGovernanceSchema.parse(req.body), req.user!.userId) }); } catch (error) { next(error); }
  };
  requestReleaseApproval = async (req: Request, res: Response, next: NextFunction) => {
    try { res.status(201).json({ success: true, data: await agentGovernanceService.requestReleaseApproval(req.user!.businessId!, String(req.params.agentId), String(req.params.releaseId), req.user!.userId) }); } catch (error) { next(error); }
  };
  reviewRelease = async (req: Request, res: Response, next: NextFunction) => {
    try { res.json({ success: true, data: await agentGovernanceService.reviewRelease(req.user!.businessId!, String(req.params.agentId), String(req.params.releaseId), reviewAgentReleaseSchema.parse(req.body), req.user!.userId) }); } catch (error) { next(error); }
  };
  activateRelease = async (req: Request, res: Response, next: NextFunction) => {
    try { res.json({ success: true, data: await agentGovernanceService.activateRelease(req.user!.businessId!, String(req.params.agentId), String(req.params.releaseId), req.user!.userId) }); } catch (error) { next(error); }
  };
  exportGovernance = async (req: Request, res: Response, next: NextFunction) => {
    try { res.setHeader('Content-Disposition', `attachment; filename="agent-${String(req.params.agentId)}-governance.json"`); res.json({ success: true, data: await agentGovernanceService.exportEvidence(req.user!.businessId!, String(req.params.agentId)) }); } catch (error) { next(error); }
  };
  getRollout = async (req: Request, res: Response, next: NextFunction) => {
    try { res.json({ success: true, data: await agentRolloutService.get(req.user!.businessId!, String(req.params.agentId)) }); } catch (error) { next(error); }
  };
  updateRollout = async (req: Request, res: Response, next: NextFunction) => {
    try { res.json({ success: true, data: await agentRolloutService.update(req.user!.businessId!, String(req.params.agentId), updateAgentRolloutSchema.parse(req.body), req.user!.userId) }); } catch (error) { next(error); }
  };
  listRoutingRules = async (req: Request, res: Response, next: NextFunction) => {
    try { res.json({ success: true, data: await agentRoutingService.list(req.user!.businessId!) }); } catch (error) { next(error); }
  };
  createRoutingRule = async (req: Request, res: Response, next: NextFunction) => {
    try { res.status(201).json({ success: true, data: await agentRoutingService.upsert(req.user!.businessId!, undefined, upsertAgentRoutingRuleSchema.parse(req.body), req.user!.userId) }); } catch (error) { next(error); }
  };
  updateRoutingRule = async (req: Request, res: Response, next: NextFunction) => {
    try { res.json({ success: true, data: await agentRoutingService.upsert(req.user!.businessId!, String(req.params.ruleId), upsertAgentRoutingRuleSchema.parse(req.body), req.user!.userId) }); } catch (error) { next(error); }
  };
  deleteRoutingRule = async (req: Request, res: Response, next: NextFunction) => {
    try { res.json({ success: true, data: await agentRoutingService.remove(req.user!.businessId!, String(req.params.ruleId), req.user!.userId) }); } catch (error) { next(error); }
  };

  getAnalytics = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { days } = agentAnalyticsQuerySchema.parse(req.query);
      res.json({ success: true, data: await agentAnalyticsService.get(req.user!.businessId!, String(req.params.agentId), days) });
    } catch (error) { next(error); }
  };

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
