const ENGLISH_HUMAN_PATTERNS: RegExp[] = [
  /\b(speak|talk)\s+(with|to)\s+(someone|a\s+person|a\s+human|support|an?\s+agent|staff|employee|manager|representative|operator)\b/i,
  /\b(connect|transfer)\s+me\s+(to|with)\s+(support|a\s+human|someone|an?\s+agent|staff|a\s+real\s+person)\b/i,
  /\b(i\s+)?(want|need)\s+(to\s+speak|a\s+human|an?\s+agent|customer\s+service|support|employee|manager|staff)\b/i,
  /\b(don'?t|do\s+not)\s+want\s+(the\s+)?ai\b/i,
  /\b(live\s+agent|customer\s+care|real\s+person|human\s+support)\b/i,
  /^(support|admin|operator|staff|employee|manager|owner|human|representative)\.?$/i,
  /\btransfer\s+me\b/i,
];

const SOMALI_HUMAN_PATTERNS: RegExp[] = [
  /\bwaxaan\s+rab(aa|o)\s+qof\b/i,
  /\bshaqaale\s+ayaan\s+rab(aa|o)\b/i,
  /\badmin\s+ayaan\s+rab(aa|o)\b/i,
  /\bma\s+doonayo\s+ai\b/i,
  /\bqof\s+ila\s+hadl(a|o)\b/i,
  /\bmanager\s+ii\s+yeer\b/i,
  /\bqof\s+dhab\s+ah\s+ayaan\s+rab(aa|o)\b/i,
  /\bfadlan\s+iigu\s+wareeji\s+shaqaale\b/i,
  /\bii\s+wareeji\s+(shaqaale|qof|taageero)\b/i,
  /\btaageero\s+shaqaale\b/i,
];

export function detectHumanHandoffRequest(message: string): boolean {
  const text = message.trim();
  if (!text) return false;

  return (
    ENGLISH_HUMAN_PATTERNS.some((pattern) => pattern.test(text)) ||
    SOMALI_HUMAN_PATTERNS.some((pattern) => pattern.test(text))
  );
}

export type FeedbackChoice = 'yes' | 'no' | 'human' | null;

const YES_PATTERNS = /^(✅\s*)?(yes|yep|yeah|yup|sure|ok|okay|haa|waaye|waa\s+hagaag|waa\s+fiican)\.?$/i;
const NO_PATTERNS = /^(❌\s*)?(no|nope|nah|maya|ma\s+aha)\.?$/i;
const HUMAN_PATTERNS =
  /^(👤\s*)?(talk\s+to\s+human|human|speak\s+to\s+human|qof|shaqaale|waxaan\s+rabaa\s+qof|human\s+representative)\.?$/i;

export function parseFeedbackResponse(message: string): FeedbackChoice {
  const text = message.trim();
  if (!text) return null;
  if (HUMAN_PATTERNS.test(text)) return 'human';
  if (YES_PATTERNS.test(text)) return 'yes';
  if (NO_PATTERNS.test(text)) return 'no';
  if (/\b(waxaan\s+rabaa\s+qof|shaqaale|human|representative)\b/i.test(text)) return 'human';
  if (/\b(maya|no|not\s+satisfied|unsatisfied)\b/i.test(text)) return 'no';
  if (/\b(haa|yes|satisfied|helped|caawiyay)\b/i.test(text)) return 'yes';
  return null;
}
