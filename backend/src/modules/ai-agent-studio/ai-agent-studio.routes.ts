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
router.get('/', authorize(PERMISSIONS['knowledge:read']), aiAgentStudioController.listAgents);
router.get('/:agentId', authorize(PERMISSIONS['knowledge:read']), aiAgentStudioController.getAgent);
router.patch('/:agentId', authorize(PERMISSIONS['knowledge:write']), aiAgentStudioController.updateAgent);
router.put('/:agentId/draft', authorize(PERMISSIONS['knowledge:write']), aiAgentStudioController.updateDraft);
router.post('/:agentId/releases', authorize(PERMISSIONS['knowledge:write']), aiAgentStudioController.createRelease);
router.put('/:agentId/skills/:skillKey', authorize(PERMISSIONS['knowledge:write']), aiAgentStudioController.upsertSkill);

export default router;
