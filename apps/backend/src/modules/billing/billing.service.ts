import Stripe from 'stripe';
import { billingRepository } from './billing.repository';
import { SubscriptionPlan, SubscriptionStatus } from '@prisma/client';
import { ChangePlanInput } from '@smartreception/shared';
import { prisma } from '../../infrastructure/database/prisma';
import { ForbiddenError, ValidationError } from '../../core/errors';
import {
  stripeService,
  isStripeConfigured,
  getStripePriceId,
  planFromPriceId,
} from '../../infrastructure/stripe/stripe.service';
import { config } from '../../config';
import { notifyBilling } from '../../infrastructure/notifications/notification-helper';
import { logger } from '../../core/logger';

const STATUS_MAP: Record<string, string> = {
  ACTIVE: 'active',
  TRIALING: 'trialing',
  PAST_DUE: 'past_due',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
};

const INVOICE_STATUS_MAP: Record<string, string> = {
  DRAFT: 'draft',
  OPEN: 'open',
  PAID: 'paid',
  VOID: 'void',
  UNCOLLECTIBLE: 'uncollectible',
};

const STRIPE_STATUS_MAP: Record<string, SubscriptionStatus> = {
  active: 'ACTIVE',
  trialing: 'TRIALING',
  past_due: 'PAST_DUE',
  canceled: 'CANCELLED',
  unpaid: 'PAST_DUE',
  incomplete: 'TRIALING',
  incomplete_expired: 'EXPIRED',
};

export class BillingService {
  async getBillingOverview(businessId: string) {
    const [subscription, invoices, usageCounts, business] = await Promise.all([
      billingRepository.getSubscription(businessId),
      billingRepository.getInvoices(businessId),
      billingRepository.getUsageCounts(businessId),
      prisma.business.findUnique({ where: { id: businessId }, select: { name: true } }),
    ]);

    const plan = subscription?.plan ?? SubscriptionPlan.FREE;
    const limits = billingRepository.getPlanLimits(plan);
    const price = billingRepository.getPlanPrice(plan);

    return {
      plan,
      status: STATUS_MAP[subscription?.status ?? 'TRIALING'] || 'trialing',
      price,
      billingCycle: 'monthly',
      nextBillingDate: subscription?.currentPeriodEnd?.toISOString().split('T')[0] ?? null,
      hasPaymentMethod: Boolean(subscription?.stripeCustomerId),
      stripeEnabled: isStripeConfigured(),
      businessName: business?.name,
      usage: {
        conversations: { used: usageCounts.conversations, limit: limits.conversations },
        customers: { used: usageCounts.customers, limit: limits.customers },
        teamMembers: { used: usageCounts.teamMembers, limit: limits.teamMembers },
      },
      invoices: invoices.map((inv) => ({
        id: inv.id,
        date: inv.createdAt.toISOString().split('T')[0],
        amount: Number(inv.amount),
        status: INVOICE_STATUS_MAP[inv.status] || inv.status.toLowerCase(),
        stripeInvoiceId: inv.stripeInvoiceId,
      })),
    };
  }

  async createCheckoutSession(businessId: string, plan: SubscriptionPlan, userEmail: string) {
    if (!isStripeConfigured()) {
      throw new ValidationError('Stripe is not configured. Use change-plan for admin upgrades.');
    }

    const priceId = getStripePriceId(plan);
    if (!priceId) {
      throw new ValidationError(`No Stripe price configured for plan ${plan}`);
    }

    const [subscription, business] = await Promise.all([
      billingRepository.getSubscription(businessId),
      prisma.business.findUnique({ where: { id: businessId } }),
    ]);

    if (!business) throw new ValidationError('Business not found');

    const customerId = await stripeService.getOrCreateCustomer(
      businessId,
      userEmail,
      business.name,
      subscription?.stripeCustomerId
    );

    if (!subscription?.stripeCustomerId) {
      await prisma.subscription.upsert({
        where: { businessId },
        create: { businessId, plan: 'FREE', stripeCustomerId: customerId },
        update: { stripeCustomerId: customerId },
      });
    }

    const baseUrl = config.frontendUrl;
    const url = await stripeService.createCheckoutSession({
      customerId,
      priceId,
      businessId,
      plan,
      successUrl: `${baseUrl}/billing?checkout=success`,
      cancelUrl: `${baseUrl}/billing?checkout=cancelled`,
    });

    return { url };
  }

  async createPortalSession(businessId: string) {
    if (!isStripeConfigured()) {
      throw new ValidationError('Stripe is not configured');
    }

    const subscription = await billingRepository.getSubscription(businessId);
    if (!subscription?.stripeCustomerId) {
      throw new ValidationError('No Stripe customer on file. Subscribe to a plan first.');
    }

    const url = await stripeService.createPortalSession(
      subscription.stripeCustomerId,
      `${config.frontendUrl}/billing`
    );

    return { url };
  }

  async handleStripeWebhook(event: Stripe.Event) {
    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.updated':
      case 'customer.subscription.created':
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.paid':
        await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      default:
        logger.debug(`Unhandled Stripe event: ${event.type}`);
    }
  }

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const businessId = session.metadata?.businessId;
    const plan = session.metadata?.plan as SubscriptionPlan | undefined;
    if (!businessId) return;

    await prisma.subscription.upsert({
      where: { businessId },
      create: {
        businessId,
        plan: plan ?? 'STARTER',
        status: 'ACTIVE',
        stripeCustomerId: typeof session.customer === 'string' ? session.customer : undefined,
        stripeSubscriptionId:
          typeof session.subscription === 'string' ? session.subscription : undefined,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      update: {
        plan: plan ?? undefined,
        status: 'ACTIVE',
        stripeSubscriptionId:
          typeof session.subscription === 'string' ? session.subscription : undefined,
      },
    });

    await notifyBilling(businessId, 'Subscription activated', `Your ${plan ?? 'new'} plan is now active.`);
  }

  private async handleSubscriptionUpdated(stripeSubscription: Stripe.Subscription) {
    const businessId = stripeSubscription.metadata?.businessId;
    if (!businessId) return;

    const priceId = stripeSubscription.items.data[0]?.price?.id;
    const plan = priceId ? planFromPriceId(priceId) : null;
    const status = STRIPE_STATUS_MAP[stripeSubscription.status] ?? 'ACTIVE';
    const periodStart = stripeSubscription['current_period_start' as keyof Stripe.Subscription] as number;
    const periodEnd = stripeSubscription['current_period_end' as keyof Stripe.Subscription] as number;

    await prisma.subscription.update({
      where: { businessId },
      data: {
        ...(plan ? { plan } : {}),
        status,
        stripeSubscriptionId: stripeSubscription.id,
        currentPeriodStart: new Date(periodStart * 1000),
        currentPeriodEnd: new Date(periodEnd * 1000),
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      },
    });

    if (status === 'PAST_DUE') {
      await notifyBilling(
        businessId,
        'Payment failed',
        'Your subscription payment failed. Please update your billing details.'
      );
    }
  }

  private async handleSubscriptionDeleted(stripeSubscription: Stripe.Subscription) {
    const businessId = stripeSubscription.metadata?.businessId;
    if (!businessId) return;

    await prisma.subscription.update({
      where: { businessId },
      data: {
        plan: 'FREE',
        status: 'CANCELLED',
        stripeSubscriptionId: null,
        cancelAtPeriodEnd: false,
      },
    });

    await notifyBilling(businessId, 'Subscription cancelled', 'Your subscription has been cancelled.');
  }

  private async handleInvoicePaid(invoice: Stripe.Invoice) {
    const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
    if (!customerId) return;

    const sub = await prisma.subscription.findFirst({
      where: { stripeCustomerId: customerId },
    });
    if (!sub) return;

    const invoiceNumber = invoice.number || `INV-${Date.now()}`;
    await prisma.invoice.upsert({
      where: { invoiceNumber },
      create: {
        businessId: sub.businessId,
        invoiceNumber,
        amount: (invoice.amount_paid ?? 0) / 100,
        currency: (invoice.currency ?? 'usd').toUpperCase(),
        status: 'PAID',
        stripeInvoiceId: invoice.id,
        paidAt: new Date(),
        dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : null,
      },
      update: {
        status: 'PAID',
        stripeInvoiceId: invoice.id,
        paidAt: new Date(),
      },
    });

    await notifyBilling(
      sub.businessId,
      'Invoice paid',
      `Payment received for invoice ${invoiceNumber}.`
    );
  }

  async changePlan(businessId: string, input: ChangePlanInput, userId: string) {
    const plan = input.plan as SubscriptionPlan;
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const subscription = await prisma.subscription.upsert({
      where: { businessId },
      create: {
        businessId,
        plan,
        status: 'ACTIVE',
        currentPeriodStart: new Date(),
        currentPeriodEnd: periodEnd,
      },
      update: {
        plan,
        status: 'ACTIVE',
        currentPeriodStart: new Date(),
        currentPeriodEnd: periodEnd,
      },
    });

    await prisma.auditLog.create({
      data: {
        businessId,
        userId,
        action: 'UPDATE',
        entity: 'Subscription',
        entityId: subscription.id,
        newData: { plan },
      },
    });

    return this.getBillingOverview(businessId);
  }

  async assertWithinLimit(
    businessId: string,
    resource: 'conversations' | 'customers' | 'teamMembers'
  ) {
    await this.assertActiveSubscription(businessId);

    const [subscription, usageCounts] = await Promise.all([
      billingRepository.getSubscription(businessId),
      billingRepository.getUsageCounts(businessId),
    ]);

    const plan = subscription?.plan ?? SubscriptionPlan.FREE;
    const limits = billingRepository.getPlanLimits(plan);
    const used = usageCounts[resource];
    const limit = limits[resource];

    if (used >= limit) {
      throw new ForbiddenError(
        `${resource} limit reached for your ${plan} plan (${used}/${limit}). Please upgrade.`
      );
    }
  }

  async assertActiveSubscription(businessId: string) {
    const subscription = await billingRepository.getSubscription(businessId);
    const status = subscription?.status ?? 'TRIALING';

    if (status === 'PAST_DUE' || status === 'CANCELLED' || status === 'EXPIRED') {
      throw new ForbiddenError(
        `Subscription is ${status.toLowerCase().replace('_', ' ')}. Please update billing to continue.`
      );
    }
  }
}

export const billingService = new BillingService();
