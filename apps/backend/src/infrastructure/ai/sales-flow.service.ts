import { prisma } from '../database/prisma';
import { logger } from '../../core/logger';
import type { SalesFlowContext, SalesFlowResult, SalesFlowState } from './sales-flow.types';
import {
  APPOINTMENT_OFFER,
  APPOINTMENT_QUESTIONS,
  CUSTOM_SOFTWARE_TYPE_MENU,
  CUSTOM_SOFTWARE_TYPES,
  PORTFOLIO_MESSAGE,
  SERVICE_INTROS,
  SERVICE_QUESTIONS,
  WEBSITE_TYPE_MENU,
  WEBSITE_TYPES,
  buildAppointmentSummary,
  buildLeadSummary,
} from './sales-flow-content';
import { MENU_OPTIONS } from './somali-menu';

const FLOW_META_TYPE = 'sales_flow';

/** Load active sales flow from latest outbound message metadata. */
export async function getActiveSalesFlow(conversationId: string): Promise<SalesFlowState | null> {
  const messages = await prisma.message.findMany({
    where: { conversationId, direction: 'OUTBOUND', isAiGenerated: true },
    orderBy: { createdAt: 'desc' },
    take: 15,
    select: { metadata: true },
  });

  for (const msg of messages) {
    const meta = msg.metadata as { type?: string; salesFlow?: SalesFlowState } | null;
    if (meta?.type === FLOW_META_TYPE && meta.salesFlow && meta.salesFlow.phase !== 'completed') {
      return meta.salesFlow;
    }
  }
  return null;
}

export function createSalesFlow(serviceOption: number): SalesFlowResult {
  const serviceName = MENU_OPTIONS[serviceOption]?.title ?? `Adeeg ${serviceOption}`;
  const intro = SERVICE_INTROS[serviceOption] ?? SERVICE_INTROS[1]!;

  if (serviceOption === 5) {
    const state: SalesFlowState = {
      serviceOption: 5,
      serviceName,
      phase: 'website_type',
      questionIndex: 0,
      questionKeys: [],
      answers: {},
      startedAt: new Date().toISOString(),
    };
    return {
      handled: true,
      reply: `${intro}\n\n${WEBSITE_TYPE_MENU}`,
      nextState: state,
    };
  }

  if (serviceOption === 7) {
    const state: SalesFlowState = {
      serviceOption: 7,
      serviceName,
      phase: 'website_type',
      questionIndex: 0,
      questionKeys: [],
      answers: {},
      startedAt: new Date().toISOString(),
    };
    return {
      handled: true,
      reply: `${intro}\n\n${CUSTOM_SOFTWARE_TYPE_MENU}`,
      nextState: state,
    };
  }

  if (serviceOption === 9) {
    return {
      handled: true,
      reply: intro,
      nextState: null,
    };
  }

  const questions = SERVICE_QUESTIONS[serviceOption] ?? SERVICE_QUESTIONS[1]!;
  const state: SalesFlowState = {
    serviceOption,
    serviceName,
    phase: 'questions',
    questionIndex: 0,
    questionKeys: questions.map((q) => q.key),
    answers: {},
    startedAt: new Date().toISOString(),
  };

  const firstQ = questions[0];
  return {
    handled: true,
    reply: `${intro}\n\n${firstQ?.text ?? 'Magacaaga?'}`,
    nextState: state,
  };
}

function parseYesNo(text: string): 'yes' | 'no' | null {
  const t = text.trim().toLowerCase();
  if (/^(1|haa|yes|y|h)$/i.test(t)) return 'yes';
  if (/^(2|maya|no|m)$/i.test(t)) return 'no';
  if (/\bhaa\b/i.test(t)) return 'yes';
  if (/\bmaya\b/i.test(t)) return 'no';
  return null;
}

function parseSubMenuSelection(text: string, max: number): number | null {
  const trimmed = text.trim();
  const m = trimmed.match(/^([1-9])(?:[\.\)\s]|$)/);
  if (m) {
    const n = Number(m[1]);
    if (n >= 1 && n <= max) return n;
  }
  if (/^[1-9]$/.test(trimmed)) {
    const n = Number(trimmed);
    if (n <= max) return n;
  }
  return null;
}

function getQuestionsForState(state: SalesFlowState) {
  return SERVICE_QUESTIONS[state.serviceOption] ?? [];
}

function advanceToPortfolio(state: SalesFlowState): SalesFlowResult {
  return {
    handled: true,
    reply: `${PORTFOLIO_MESSAGE}\n\n${APPOINTMENT_OFFER}`,
    nextState: { ...state, phase: 'appointment_offer', questionIndex: 0 },
  };
}

function advanceToAppointmentOffer(state: SalesFlowState): SalesFlowResult {
  return {
    handled: true,
    reply: APPOINTMENT_OFFER,
    nextState: { ...state, phase: 'appointment_offer', questionIndex: 0 },
  };
}

function startAppointmentCollect(state: SalesFlowState): SalesFlowResult {
  const first = APPOINTMENT_QUESTIONS[0]!;
  return {
    handled: true,
    reply: first.text,
    nextState: {
      ...state,
      phase: 'appointment_collect',
      questionIndex: 0,
      questionKeys: APPOINTMENT_QUESTIONS.map((q) => q.key),
    },
  };
}

/** Process inbound message when a sales flow is active. */
export async function processSalesFlowMessage(
  message: string,
  state: SalesFlowState,
  ctx: SalesFlowContext
): Promise<SalesFlowResult> {
  const trimmed = message.trim();
  if (!trimmed) return { handled: false };

  if (/^(menu|adeegyada|bilow|start)$/i.test(trimmed)) {
    return { handled: false };
  }

  // Website type selection (option 5)
  if (state.phase === 'website_type' && state.serviceOption === 5) {
    const pick = parseSubMenuSelection(trimmed, 9);
    if (!pick) {
      return {
        handled: true,
        reply: `Fadlan dooro lambarka 1-9.\n\n${WEBSITE_TYPE_MENU}`,
        nextState: state,
      };
    }
    const websiteType = WEBSITE_TYPES[pick] ?? 'Other';
    const questions = SERVICE_QUESTIONS[5]!;
    const next: SalesFlowState = {
      ...state,
      phase: 'questions',
      websiteType,
      questionIndex: 0,
      questionKeys: questions.map((q) => q.key),
      answers: { ...state.answers, websiteType },
    };
    return {
      handled: true,
      reply: `Aad baad u mahadsantahay! Waxaad dooratay: ${websiteType}\n\n${questions[0]!.text}`,
      nextState: next,
    };
  }

  // Custom software type selection (option 7)
  if (state.phase === 'website_type' && state.serviceOption === 7) {
    const pick = parseSubMenuSelection(trimmed, 7);
    if (!pick) {
      return {
        handled: true,
        reply: `Fadlan dooro lambarka 1-7.\n\n${CUSTOM_SOFTWARE_TYPE_MENU}`,
        nextState: state,
      };
    }
    const systemType = CUSTOM_SOFTWARE_TYPES[pick] ?? 'Other';
    const questions = SERVICE_QUESTIONS[7]!;
    const next: SalesFlowState = {
      ...state,
      phase: 'questions',
      customSystemType: systemType,
      questionIndex: 0,
      questionKeys: questions.map((q) => q.key),
      answers: { ...state.answers, systemType },
    };
    return {
      handled: true,
      reply: `Waxaad dooratay: ${systemType}\n\n${questions[0]!.text}`,
      nextState: next,
    };
  }

  // Portfolio phase → auto-send appointment offer on next message
  if (state.phase === 'portfolio') {
    return advanceToAppointmentOffer(state);
  }

  // Appointment yes/no
  if (state.phase === 'appointment_offer') {
    const yn = parseYesNo(trimmed);
    if (yn === 'yes') return startAppointmentCollect(state);
    if (yn === 'no') {
      await persistSalesLead(ctx, state);
      return {
        handled: true,
        reply: buildLeadSummary(state.answers, state.serviceName),
        nextState: { ...state, phase: 'completed' },
      };
    }
    return {
      handled: true,
      reply: `Fadlan dooro:\n\n${APPOINTMENT_OFFER}`,
      nextState: state,
    };
  }

  // Appointment data collection
  if (state.phase === 'appointment_collect') {
    const key = APPOINTMENT_QUESTIONS[state.questionIndex]?.key;
    if (!key) return { handled: false };

    const answers = { ...state.answers, [key]: trimmed };
    const nextIndex = state.questionIndex + 1;

    if (nextIndex < APPOINTMENT_QUESTIONS.length) {
      return {
        handled: true,
        reply: APPOINTMENT_QUESTIONS[nextIndex]!.text,
        nextState: { ...state, answers, questionIndex: nextIndex },
      };
    }

    await persistSalesLead(ctx, { ...state, answers });
    await createAppointmentFromFlow(ctx, { ...state, answers });

    return {
      handled: true,
      reply: buildAppointmentSummary(answers, state.serviceName),
      nextState: { ...state, answers, phase: 'completed' },
    };
  }

  // Question collection phase
  if (state.phase === 'questions') {
    const questions = getQuestionsForState(state);
    const currentKey = questions[state.questionIndex]?.key ?? state.questionKeys[state.questionIndex];
    if (!currentKey) {
      return advanceToPortfolio(state);
    }

    const answers = { ...state.answers, [currentKey]: trimmed };
    const nextIndex = state.questionIndex + 1;

    if (nextIndex < questions.length) {
      return {
        handled: true,
        reply: questions[nextIndex]!.text,
        nextState: { ...state, answers, questionIndex: nextIndex },
      };
    }

    await persistSalesLead(ctx, { ...state, answers });

    const portfolioResult = advanceToPortfolio({ ...state, answers, questionIndex: nextIndex });
    return portfolioResult;
  }

  return { handled: false };
}

async function persistSalesLead(ctx: SalesFlowContext, state: SalesFlowState): Promise<void> {
  try {
    const customer = await prisma.customer.findFirst({
      where: { id: ctx.customerId, businessId: ctx.businessId },
    });
    if (!customer) return;

    const name = state.answers.fullName || state.answers.apptName || customer.name;
    const email = state.answers.email || state.answers.apptEmail || customer.email;
    const phone = state.answers.apptPhone || customer.phone;

    const noteLines = [
      `Sales Flow — ${state.serviceName}`,
      state.websiteType && `Website Type: ${state.websiteType}`,
      state.customSystemType && `System: ${state.customSystemType}`,
      ...Object.entries(state.answers).map(([k, v]) => `${k}: ${v}`),
    ].filter(Boolean);

    await prisma.customer.update({
      where: { id: ctx.customerId },
      data: {
        name,
        email: email || undefined,
        phone,
        leadScore: Math.max(customer.leadScore, 85),
        lastContactAt: new Date(),
        notes: [customer.notes, noteLines.join('\n')].filter(Boolean).join('\n\n'),
      },
    });

    await prisma.customerNote.create({
      data: {
        customerId: ctx.customerId,
        content: noteLines.join('\n'),
      },
    });
  } catch (err) {
    logger.warn('Failed to persist sales lead', { err, customerId: ctx.customerId });
  }
}

async function createAppointmentFromFlow(
  ctx: SalesFlowContext,
  state: SalesFlowState
): Promise<void> {
  try {
    const dateStr = state.answers.apptDate ?? '';
    const timeStr = state.answers.apptTime ?? '10:00';
    const start = parseAppointmentStart(dateStr, timeStr);
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    await prisma.appointment.create({
      data: {
        businessId: ctx.businessId,
        customerId: ctx.customerId,
        title: `Kulan: ${state.serviceName}`,
        description: Object.entries(state.answers)
          .map(([k, v]) => `${k}: ${v}`)
          .join('\n'),
        startTime: start,
        endTime: end,
        status: 'SCHEDULED',
        notes: 'WhatsApp Sales Flow',
      },
    });
  } catch (err) {
    logger.warn('Failed to create appointment from sales flow', { err });
  }
}

function parseAppointmentStart(dateStr: string, timeStr: string): Date {
  const combined = `${dateStr} ${timeStr}`.trim();
  const parsed = new Date(combined);
  if (!isNaN(parsed.getTime()) && parsed > new Date()) return parsed;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);
  return tomorrow;
}

export function salesFlowMetadata(state: SalesFlowState | null): Record<string, unknown> {
  return {
    type: FLOW_META_TYPE,
    language: 'so',
    salesFlow: state,
  };
}
