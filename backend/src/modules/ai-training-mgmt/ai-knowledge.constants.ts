// Canonical zero-hallucination fallback + handover copy.
//
// These are used by BOTH the production RAG pipeline and the Sandbox so that a
// missing-knowledge answer reads identically to what a live customer would see.
// The AI must never invent an answer: when the knowledge base has no grounded
// match, it responds with the professional handover script and the platform
// opens a human escalation / knowledge-gap record.

/** Professional Somali handover reply shown when the knowledge base has no answer. */
export const HANDOVER_REPLY_SO =
  'Waan ka xumahay. Macluumaadkaas kuma jiro xogta shirkaddan. ' +
  'Waxaan ku wareejin doonaa mid ka mid ah shaqaalaha shirkadda si uu kuu caawiyo.';

/** Professional English handover reply shown when the knowledge base has no answer. */
export const HANDOVER_REPLY_EN =
  "This information is not currently available in the company's knowledge base. " +
  'I will forward your request to one of our team members.';

/** Resolve the handover reply for the customer's language. */
export function handoverReply(preferEnglish: boolean): string {
  return preferEnglish ? HANDOVER_REPLY_EN : HANDOVER_REPLY_SO;
}

/**
 * Legacy alias retained for existing imports. Points at the English handover
 * copy so any surface still referencing it stays consistent with the new policy.
 */
export const NO_KNOWLEDGE_REPLY = HANDOVER_REPLY_EN;

/** Minimum grounded-confidence percentage a version must clear to pass evaluation. */
export const VALIDATION_THRESHOLD = 70;

/**
 * Below this grounded confidence a sandbox answer is treated as "not grounded":
 * the AI must not answer from model assumptions, so we hand over instead.
 */
export const GROUNDING_MIN_CONFIDENCE = 0.35;
