import { Router } from 'express';
import { PERMISSIONS } from '@smartreception/shared';
import { authorize } from '../../core/middleware/authorize.middleware';
import { requireSuperAdmin } from '../../core/middleware/super-admin.middleware';
import { aiTrainingMgmtController } from './ai-training-mgmt.controller';

const router = Router();

router.get('/', authorize(PERMISSIONS['knowledge:read']), aiTrainingMgmtController.getDashboard);
router.get('/analytics', authorize(PERMISSIONS['knowledge:read']), aiTrainingMgmtController.getAnalytics);
router.get('/audit-logs', authorize(PERMISSIONS['audit:read']), aiTrainingMgmtController.getAuditLogs);
router.get('/insights', authorize(PERMISSIONS['knowledge:read']), aiTrainingMgmtController.listInsights);
router.post('/insights/:insightId/resolve', authorize(PERMISSIONS['knowledge:write']), aiTrainingMgmtController.resolveInsight);

router.post('/train', authorize(PERMISSIONS['knowledge:write']), aiTrainingMgmtController.startTraining);
router.get('/jobs', authorize(PERMISSIONS['knowledge:read']), aiTrainingMgmtController.listJobs);
router.get('/jobs/:jobId', authorize(PERMISSIONS['knowledge:read']), aiTrainingMgmtController.getJob);
router.post('/jobs/:jobId/cancel', authorize(PERMISSIONS['knowledge:write']), aiTrainingMgmtController.cancelJob);

router.get('/versions', authorize(PERMISSIONS['knowledge:read']), aiTrainingMgmtController.listVersions);
router.get('/versions/compare', authorize(PERMISSIONS['knowledge:read']), aiTrainingMgmtController.compareVersions);
router.get('/versions/:versionId', authorize(PERMISSIONS['knowledge:read']), aiTrainingMgmtController.getVersion);
router.post('/versions/:versionId/rollback', requireSuperAdmin, aiTrainingMgmtController.rollbackVersion);

router.post('/sandbox/sessions', authorize(PERMISSIONS['knowledge:write']), aiTrainingMgmtController.createSandboxSession);
router.get('/sandbox/sessions', authorize(PERMISSIONS['knowledge:read']), aiTrainingMgmtController.listSandboxSessions);
router.get('/sandbox/sessions/:sessionId', authorize(PERMISSIONS['knowledge:read']), aiTrainingMgmtController.getSandboxSession);
router.post('/sandbox/sessions/:sessionId/messages', authorize(PERMISSIONS['knowledge:write']), aiTrainingMgmtController.sendSandboxMessage);
router.get('/sandbox/sessions/:sessionId/report', authorize(PERMISSIONS['knowledge:read']), aiTrainingMgmtController.getSandboxReport);

router.post('/deployments/request', authorize(PERMISSIONS['knowledge:write']), aiTrainingMgmtController.requestDeployment);
router.get('/deployments', authorize(PERMISSIONS['knowledge:read']), aiTrainingMgmtController.listDeploymentRequests);

export default router;
