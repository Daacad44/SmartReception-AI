import { Router } from 'express';
import { teamController } from './team.controller';
import { authenticate } from '../../core/middleware/auth.middleware';
import { authorize, requireBusiness } from '../../core/middleware/authorize.middleware';
import { PERMISSIONS } from '@smartreception/shared';

const router = Router();

router.use(authenticate, requireBusiness);

router.get('/', authorize(PERMISSIONS['team:read']), (req, res, next) =>
  teamController.listMembers(req, res, next)
);
router.post('/invite', authorize(PERMISSIONS['team:write']), (req, res, next) =>
  teamController.invite(req, res, next)
);
router.get('/invitations', authorize(PERMISSIONS['team:read']), (req, res, next) =>
  teamController.listInvitations(req, res, next)
);
router.patch('/:memberId', authorize(PERMISSIONS['team:write']), (req, res, next) =>
  teamController.updateRole(req, res, next)
);
router.delete('/:memberId', authorize(PERMISSIONS['team:write']), (req, res, next) =>
  teamController.removeMember(req, res, next)
);

export default router;
