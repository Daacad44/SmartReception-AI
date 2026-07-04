import type { Request, Response, NextFunction } from 'express';
import { financialIntelligenceService } from './financial-intelligence.service';
import { financialConfigService, financialAuditService } from './financial-config.service';
import { financialAlertService } from './alerts/financial-alert.service';
import { pricingSimulatorService } from './simulator/pricing-simulator.service';
import type { SimulatorPlanInput } from './financial.types';

export class FinancialIntelligenceController {
  async platformDashboard(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await financialIntelligenceService.getPlatformDashboard();
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async listBusinesses(req: Request, res: Response, next: NextFunction) {
    try {
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;
      const data = await financialIntelligenceService.listBusinessProfiles(search);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getBusiness(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = String(req.params.businessId);
      const data = await financialIntelligenceService.getBusinessFinancialProfile(businessId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async refreshBusiness(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = String(req.params.businessId);
      const data = await financialIntelligenceService.refreshBusinessProfile(businessId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async refreshAll(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await financialIntelligenceService.refreshAllBusinessProfiles();
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getConfig(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await financialConfigService.getConfig();
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async updateConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await financialConfigService.updateConfig(req.body, {
        userId: req.user?.userId,
        email: req.user?.email,
        ipAddress: req.ip,
      });
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async listAlerts(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId =
        typeof req.query.businessId === 'string' ? req.query.businessId : undefined;
      const data = await financialAlertService.listAlerts({ businessId });
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async acknowledgeAlert(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await financialAlertService.acknowledgeAlert(
        String(req.params.alertId),
        req.user!.userId
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async simulate(req: Request, res: Response, next: NextFunction) {
    try {
      const plans = req.body?.plans as SimulatorPlanInput[] | undefined;
      const data = await financialIntelligenceService.runSimulator(plans);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async breakEven(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await pricingSimulatorService.breakEvenAnalysis(req.body);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async forecast(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await financialIntelligenceService.getForecast();
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async auditLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId =
        typeof req.query.businessId === 'string' ? req.query.businessId : undefined;
      const data = await financialAuditService.list({ businessId });
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async tenantSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId!;
      const data = await financialIntelligenceService.getBusinessFinancialProfile(businessId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

export const financialIntelligenceController = new FinancialIntelligenceController();
