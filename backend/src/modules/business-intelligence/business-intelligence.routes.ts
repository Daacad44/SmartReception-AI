import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../../core/middleware/auth.middleware';
import { requireBusiness } from '../../core/middleware/authorize.middleware';
import { requireSuperAdmin } from '../../core/middleware/super-admin.middleware';
import { requirePlatformFeature } from '../../core/middleware/platform-feature.middleware';
import { businessIntelligenceService } from './business-intelligence.service';

function parseFilters(query: Request['query']) {
  return {
    businessId: typeof query.businessId === 'string' ? query.businessId : undefined,
    provider: typeof query.provider === 'string' ? query.provider : undefined,
    plan: typeof query.plan === 'string' ? query.plan : undefined,
    country: typeof query.country === 'string' ? query.country : undefined,
    status: typeof query.status === 'string' ? query.status : undefined,
    from: typeof query.from === 'string' ? new Date(query.from) : undefined,
    to: typeof query.to === 'string' ? new Date(query.to) : undefined,
  };
}

const tenantRouter = Router();
const adminRouter = Router();

tenantRouter.use(authenticate, requireBusiness, requirePlatformFeature('business-intelligence'));

tenantRouter.get('/dashboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await businessIntelligenceService.getTenantDashboard(
      req.user!.businessId!,
      parseFilters(req.query)
    );
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

adminRouter.use(authenticate, requireSuperAdmin, requirePlatformFeature('business-intelligence-admin'));

adminRouter.get('/dashboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await businessIntelligenceService.getAdminDashboard(parseFilters(req.query));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/businesses', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const data = await businessIntelligenceService.listBusinesses(
      page,
      limit,
      search,
      parseFilters(req.query)
    );
    res.json({ success: true, data: data.data, meta: data.meta });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/businesses/:businessId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await businessIntelligenceService.getBusinessDetail(
      String(req.params.businessId),
      parseFilters(req.query)
    );
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

export {
  tenantRouter as businessIntelligenceRoutes,
  adminRouter as businessIntelligenceAdminRoutes,
};
