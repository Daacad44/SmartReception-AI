import { Router, type NextFunction, type Request, type Response } from 'express';
import { PERMISSIONS } from '@smartreception/shared';
import { config } from '../../config';
import { authorize } from '../../core/middleware/authorize.middleware';
import { aiAgentStudioController } from './ai-agent-studio.controller';

const router = Router();

function requireAgentStudioV2(_req: Request, res: Response, next: NextFunction) {
  if (!config.features.agentStudioV2) {
    res.status(404).json({
      success: false,
      error: {
        code: 'AGENT_STUDIO_DISABLED',
        message: 'AI Agent Studio is not enabled for this deployment',
      },
    });
    return;
  }
  next();
}

router.use(requireAgentStudioV2);
router.get('/discovery/templates', authorize(PERMISSIONS['knowledge:read']), aiAgentStudioController.listDiscoveryTemplates);
router.get('/routing-rules', authorize(PERMISSIONS['knowledge:read']), aiAgentStudioController.listRoutingRules);
router.post('/routing-rules', authorize(PERMISSIONS['knowledge:write']), aiAgentStudioController.createRoutingRule);
router.put('/routing-rules/:ruleId', authorize(PERMISSIONS['knowledge:write']), aiAgentStudioController.updateRoutingRule);
router.delete('/routing-rules/:ruleId', authorize(PERMISSIONS['knowledge:write']), aiAgentStudioController.deleteRoutingRule);
router.get('/', authorize(PERMISSIONS['knowledge:read']), aiAgentStudioController.listAgents);
router.post('/', authorize(PERMISSIONS['knowledge:write']), aiAgentStudioController.createAgent);
router.get('/:agentId', authorize(PERMISSIONS['knowledge:read']), aiAgentStudioController.getAgent);
router.patch('/:agentId', authorize(PERMISSIONS['knowledge:write']), aiAgentStudioController.updateAgent);
router.put('/:agentId/draft', authorize(PERMISSIONS['knowledge:write']), aiAgentStudioController.updateDraft);
router.post('/:agentId/releases', authorize(PERMISSIONS['knowledge:write']), aiAgentStudioController.createRelease);
router.put('/:agentId/skills/:skillKey', authorize(PERMISSIONS['knowledge:write']), aiAgentStudioController.upsertSkill);
router.get('/:agentId/discovery', authorize(PERMISSIONS['knowledge:read']), aiAgentStudioController.getDiscovery);
router.post('/:agentId/discovery/apply', authorize(PERMISSIONS['knowledge:write']), aiAgentStudioController.applyDiscovery);
router.get('/:agentId/knowledge', authorize(PERMISSIONS['knowledge:read']), aiAgentStudioController.listKnowledge);
router.post('/:agentId/knowledge', authorize(PERMISSIONS['knowledge:write']), aiAgentStudioController.attachKnowledge);
router.post('/:agentId/knowledge/:sourceId/review', authorize(PERMISSIONS['knowledge:write']), aiAgentStudioController.reviewKnowledge);
router.get('/:agentId/evaluations', authorize(PERMISSIONS['knowledge:read']), aiAgentStudioController.listEvaluations);
router.post('/:agentId/releases/:releaseId/evaluate', authorize(PERMISSIONS['knowledge:write']), aiAgentStudioController.evaluateRelease);
router.get('/:agentId/analytics', authorize(PERMISSIONS['analytics:read']), aiAgentStudioController.getAnalytics);
router.get('/:agentId/governance', authorize(PERMISSIONS['knowledge:read']), aiAgentStudioController.getGovernance);
router.put('/:agentId/governance', authorize(PERMISSIONS['knowledge:write']), aiAgentStudioController.updateGovernance);
router.get('/:agentId/governance/export', authorize(PERMISSIONS['analytics:read']), aiAgentStudioController.exportGovernance);
router.post('/:agentId/releases/:releaseId/approval', authorize(PERMISSIONS['knowledge:write']), aiAgentStudioController.requestReleaseApproval);
router.post('/:agentId/releases/:releaseId/review', authorize(PERMISSIONS['knowledge:write']), aiAgentStudioController.reviewRelease);
router.post('/:agentId/releases/:releaseId/activate', authorize(PERMISSIONS['knowledge:write']), aiAgentStudioController.activateRelease);
router.get('/:agentId/rollout', authorize(PERMISSIONS['analytics:read']), aiAgentStudioController.getRollout);
router.put('/:agentId/rollout', authorize(PERMISSIONS['knowledge:write']), aiAgentStudioController.updateRollout);

export default router;
