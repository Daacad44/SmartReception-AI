import { prisma } from '../../../infrastructure/database/prisma';
import { financialConfigService } from '../financial-config.service';
import type { BusinessCostBreakdown } from '../financial.types';
import type { CostProviderContext } from './cost-provider.interface';
import {
  AiCostProvider,
  BackupCostProvider,
  DatabaseCostProvider,
  EmailCostProvider,
  InfrastructureCostProvider,
  MonitoringCostProvider,
  RedisCostProvider,
  StorageCostProvider,
  WhatsAppCostProvider,
} from './providers/cost-providers';

const providers = [
  new AiCostProvider(),
  new WhatsAppCostProvider(),
  new EmailCostProvider(),
  new StorageCostProvider(),
  new InfrastructureCostProvider(),
  new DatabaseCostProvider(),
  new RedisCostProvider(),
  new MonitoringCostProvider(),
  new BackupCostProvider(),
];

export class CostEngineService {
  async computeBusinessAllocationWeights(): Promise<Map<string, number>> {
    const businesses = await prisma.business.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    const weights = new Map<string, number>();
    await Promise.all(
      businesses.map(async (business) => {
        const [conversations, docBytes] = await Promise.all([
          prisma.conversation.count({ where: { businessId: business.id } }),
          prisma.knowledgeDocument.aggregate({
            where: { knowledgeBase: { businessId: business.id } },
            _sum: { fileSize: true },
          }),
        ]);
        const storageMb = (docBytes._sum.fileSize ?? 0) / (1024 * 1024);
        weights.set(business.id, Math.max(1, conversations + storageMb / 100));
      })
    );
    return weights;
  }

  async calculateBusinessCosts(
    businessId: string,
    options?: { since?: Date }
  ): Promise<BusinessCostBreakdown> {
    const [config, activeBusinessCount] = await Promise.all([
      financialConfigService.getConfig(),
      prisma.business.count({ where: { isActive: true } }),
    ]);

    const rates = financialConfigService.configToRates(config);
    let allocationWeight = 1;
    if (rates.useWeightedInfrastructureAllocation) {
      const weights = await this.computeBusinessAllocationWeights();
      allocationWeight = weights.get(businessId) ?? 1;
    }

    const ctx: CostProviderContext = {
      businessId,
      period: 'monthly',
      since: options?.since,
      rates,
      activeBusinessCount: Math.max(1, activeBusinessCount),
      allocationWeight,
    };

    const results = await Promise.all(providers.map((provider) => provider.calculate(ctx)));

    const [ai, whatsapp, email, storage, infrastructure, database, redis, monitoring, backup] =
      results;

    const totalOperatingCostUsd = results.reduce(
      (sum: number, r: (typeof results)[number]) => sum + r.monthlyCostUsd,
      0
    );

    return {
      ai,
      whatsapp,
      email,
      storage,
      infrastructure,
      database,
      redis,
      monitoring,
      backup,
      totalOperatingCostUsd,
    };
  }
}

export const costEngineService = new CostEngineService();
