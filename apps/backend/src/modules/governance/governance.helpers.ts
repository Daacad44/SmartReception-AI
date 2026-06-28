import { Response } from 'express';
import type { GovernanceActionType } from '@smartreception/shared';
import {
  buildGovernanceContext,
  governanceService,
} from './governance.service';

export function respondIfApprovalRequired(
  res: Response,
  guard: { proceed: true } | { proceed: false; request: unknown }
): guard is { proceed: false; request: unknown } {
  if (!guard.proceed) {
    res.status(202).json({
      success: true,
      approvalRequired: true,
      message: 'Administrator approval required',
      data: guard.request,
    });
    return true;
  }
  return false;
}

export async function withGovernanceGuard(
  req: Parameters<typeof buildGovernanceContext>[0],
  res: Response,
  actionType: GovernanceActionType,
  payload: Record<string, unknown>,
  options?: {
    previousData?: Record<string, unknown>;
    file?: Express.Multer.File;
  }
): Promise<boolean> {
  const guard = await governanceService.guardAction(buildGovernanceContext(req), {
    actionType,
    payload,
    previousData: options?.previousData,
    file: options?.file,
  });
  return respondIfApprovalRequired(res, guard);
}
