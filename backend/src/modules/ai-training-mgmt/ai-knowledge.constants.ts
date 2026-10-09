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

/** Recognize both the canonical handover copy and its legacy safe fallback. */
export function isNoKnowledgeAnswer(answer: string): boolean {
  const normalized = answer.toLowerCase();
  return answer === NO_KNOWLEDGE_REPLY ||
    normalized.includes("don't have verified information") ||
    normalized.includes('not currently available in the company');
}

function factualTokens(value: string): Set<string> {
  const matches = value.toLowerCase().match(
    /(?:https?:\/\/|www\.)[^\s]+|[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:[$€£]|usd|eur|gbp)\s*\d[\d.,]*|\+?\d[\d\s()./-]{2,}\d/gi
  );
  return new Set((matches ?? []).map((token) => token.replace(/[\s(),.-]/g, '')));
}

/**
 * Deterministic hallucination guard for validation responses.
 *
 * Natural-language word overlap is not safe for a multilingual product: a
 * grounded Somali fact translated into English can have almost no shared
 * words with its source. Instead, reject newly invented high-risk factual
 * tokens (amounts, dates/numbers, phone numbers, emails and URLs).
 */
export function hasUnsupportedFactualClaims(answer: string, context: string): boolean {
  if (isNoKnowledgeAnswer(answer)) return false;
  const contextFacts = factualTokens(context);
  return [...factualTokens(answer)].some((fact) => !contextFacts.has(fact));
}

/** Minimum grounded-confidence percentage a version must clear to pass evaluation. */
export const VALIDATION_THRESHOLD = 70;

/**
 * Below this grounded confidence a sandbox answer is treated as "not grounded":
 * the AI must not answer from model assumptions, so we hand over instead.
 */
export const GROUNDING_MIN_CONFIDENCE = 0.35;
