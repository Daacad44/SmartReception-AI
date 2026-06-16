import { Request, Response, NextFunction } from 'express';
import { routeParam } from '../../core/utils';
import { teamService } from './team.service';
import { inviteTeamMemberSchema, updateTeamMemberSchema } from '@smartreception/shared';

export class TeamController {
  async listMembers(req: Request, res: Response, next: NextFunction) {
    try {
      const members = await teamService.listMembers(req.user!.businessId!);
      res.json({ success: true, data: members });
    } catch (error) {
      next(error);
    }
  }

  async invite(req: Request, res: Response, next: NextFunction) {
    try {
      const input = inviteTeamMemberSchema.parse(req.body);
      const invitation = await teamService.inviteMember(
        req.user!.businessId!,
        input,
        req.user!.userId
      );
      res.status(201).json({ success: true, data: invitation });
    } catch (error) {
      next(error);
    }
  }

  async updateRole(req: Request, res: Response, next: NextFunction) {
    try {
      const input = updateTeamMemberSchema.parse(req.body);
      const member = await teamService.updateRole(
        req.user!.businessId!,
        routeParam(req.params.memberId),
        input,
        req.user!.userId,
        req.user!.role
      );
      res.json({ success: true, data: member });
    } catch (error) {
      next(error);
    }
  }

  async removeMember(req: Request, res: Response, next: NextFunction) {
    try {
      await teamService.removeMember(
        req.user!.businessId!,
        routeParam(req.params.memberId),
        req.user!.userId,
        req.user!.role
      );
      res.json({ success: true, message: 'Team member removed successfully' });
    } catch (error) {
      next(error);
    }
  }

  async listInvitations(req: Request, res: Response, next: NextFunction) {
    try {
      const invitations = await teamService.listInvitations(req.user!.businessId!);
      res.json({ success: true, data: invitations });
    } catch (error) {
      next(error);
    }
  }
}

export const teamController = new TeamController();
