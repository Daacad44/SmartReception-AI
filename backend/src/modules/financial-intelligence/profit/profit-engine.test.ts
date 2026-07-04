import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { profitEngineService } from './profit-engine.service';
import type { BusinessCostBreakdown, BusinessRevenueBreakdown } from '../financial.types';

const baseRevenue: BusinessRevenueBreakdown = {
  monthlyRevenueUsd: 100,
  yearlyRevenueUsd: 1200,
  lifetimeRevenueUsd: 2400,
  mrrContributionUsd: 100,
  arrContributionUsd: 1200,
  failedPaymentsUsd: 0,
  refundsUsd: 5,
  outstandingInvoicesUsd: 0,
  recurringRevenueUsd: 100,
  revenuePerCustomerUsd: 50,
  revenueGrowthPercent: 10,
  revenueDeclinePercent: 0,
  byPlan: [],
  byCountry: [],
  byMonth: [],
};

const baseCosts = {
  totalOperatingCostUsd: 40,
  ai: { monthlyCostUsd: 20, provider: 'AI', dailyCostUsd: 0, weeklyCostUsd: 0, lifetimeCostUsd: 0, breakdown: {} },
  whatsapp: { monthlyCostUsd: 10, provider: 'WHATSAPP', dailyCostUsd: 0, weeklyCostUsd: 0, lifetimeCostUsd: 0, breakdown: {} },
  email: { monthlyCostUsd: 2, provider: 'EMAIL', dailyCostUsd: 0, weeklyCostUsd: 0, lifetimeCostUsd: 0, breakdown: {} },
  storage: { monthlyCostUsd: 3, provider: 'STORAGE', dailyCostUsd: 0, weeklyCostUsd: 0, lifetimeCostUsd: 0, breakdown: {} },
  infrastructure: { monthlyCostUsd: 2, provider: 'INFRASTRUCTURE', dailyCostUsd: 0, weeklyCostUsd: 0, lifetimeCostUsd: 0, breakdown: {} },
  database: { monthlyCostUsd: 1, provider: 'DATABASE', dailyCostUsd: 0, weeklyCostUsd: 0, lifetimeCostUsd: 0, breakdown: {} },
  redis: { monthlyCostUsd: 1, provider: 'REDIS', dailyCostUsd: 0, weeklyCostUsd: 0, lifetimeCostUsd: 0, breakdown: {} },
  monitoring: { monthlyCostUsd: 0.5, provider: 'MONITORING', dailyCostUsd: 0, weeklyCostUsd: 0, lifetimeCostUsd: 0, breakdown: {} },
  backup: { monthlyCostUsd: 0.5, provider: 'BACKUP', dailyCostUsd: 0, weeklyCostUsd: 0, lifetimeCostUsd: 0, breakdown: {} },
} as BusinessCostBreakdown;

describe('profitEngineService', () => {
  it('calculates gross and net profit from real revenue and cost inputs', () => {
    const profit = profitEngineService.calculateBusinessProfit(baseRevenue, baseCosts, {
      customers: 2,
      conversations: 10,
      totalTokens: 1000,
    });

    assert.equal(profit.grossProfitUsd, 60);
    assert.equal(profit.netProfitUsd, 55);
    assert.equal(profit.isProfitable, true);
    assert.equal(profit.isOperatingAtLoss, false);
    assert.ok(Math.abs(profit.profitMarginPercent - 55) < 0.01);
  });

  it('flags operating at loss when cost exceeds revenue', () => {
    const profit = profitEngineService.calculateBusinessProfit(
      { ...baseRevenue, monthlyRevenueUsd: 20 },
      { ...baseCosts, totalOperatingCostUsd: 50 },
      { customers: 1, conversations: 1, totalTokens: 100 }
    );

    assert.equal(profit.isOperatingAtLoss, true);
    assert.equal(profit.isProfitable, false);
  });
});
