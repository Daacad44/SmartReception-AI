import Stripe from 'stripe';
import { SubscriptionPlan } from '@prisma/client';
import { config } from '../../config';
import { logger } from '../../core/logger';

const PLAN_PRICE_ENV: Record<Exclude<SubscriptionPlan, 'FREE' | 'CUSTOM'>, string> = {
  STARTER: 'STRIPE_PRICE_STARTER',
  BUSINESS: 'STRIPE_PRICE_BUSINESS',
  PROFESSIONAL: 'STRIPE_PRICE_PROFESSIONAL',
  ENTERPRISE: 'STRIPE_PRICE_ENTERPRISE',
};

let stripeClient: Stripe | null = null;

function getStripe(): Stripe | null {
  if (!config.stripe.secretKey) return null;
  if (!stripeClient) {
    stripeClient = new Stripe(config.stripe.secretKey);
  }
  return stripeClient;
}

export function isStripeConfigured(): boolean {
  return Boolean(config.stripe.secretKey);
}

export function getStripePriceId(plan: SubscriptionPlan): string | null {
  if (plan === 'FREE' || plan === 'CUSTOM') return null;
  const envKey = PLAN_PRICE_ENV[plan];
  return process.env[envKey] || null;
}

export function planFromPriceId(priceId: string): SubscriptionPlan | null {
  for (const plan of Object.keys(PLAN_PRICE_ENV) as Array<
    Exclude<SubscriptionPlan, 'FREE' | 'CUSTOM'>
  >) {
    const envKey = PLAN_PRICE_ENV[plan];
    if (process.env[envKey] === priceId) return plan;
  }
  return null;
}

export class StripeService {
  async getOrCreateCustomer(
    businessId: string,
    email: string,
    businessName: string,
    existingCustomerId?: string | null
  ): Promise<string> {
    const stripe = getStripe();
    if (!stripe) throw new Error('Stripe is not configured');

    if (existingCustomerId) {
      try {
        await stripe.customers.retrieve(existingCustomerId);
        return existingCustomerId;
      } catch {
        logger.warn(`Stripe customer ${existingCustomerId} not found, creating new`);
      }
    }

    const customer = await stripe.customers.create({
      email,
      name: businessName,
      metadata: { businessId },
    });

    return customer.id;
  }

  async createCheckoutSession(params: {
    customerId: string;
    priceId: string;
    businessId: string;
    plan: SubscriptionPlan;
    successUrl: string;
    cancelUrl: string;
  }): Promise<string> {
    const stripe = getStripe();
    if (!stripe) throw new Error('Stripe is not configured');

    const session = await stripe.checkout.sessions.create({
      customer: params.customerId,
      mode: 'subscription',
      line_items: [{ price: params.priceId, quantity: 1 }],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: {
        businessId: params.businessId,
        plan: params.plan,
      },
      subscription_data: {
        metadata: {
          businessId: params.businessId,
          plan: params.plan,
        },
      },
    });

    if (!session.url) throw new Error('Failed to create checkout session');
    return session.url;
  }

  async createPortalSession(customerId: string, returnUrl: string): Promise<string> {
    const stripe = getStripe();
    if (!stripe) throw new Error('Stripe is not configured');

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return session.url;
  }

  constructWebhookEvent(payload: Buffer, signature: string): Stripe.Event {
    const stripe = getStripe();
    if (!stripe || !config.stripe.webhookSecret) {
      throw new Error('Stripe webhook is not configured');
    }
    return stripe.webhooks.constructEvent(payload, signature, config.stripe.webhookSecret);
  }
}

export const stripeService = new StripeService();
