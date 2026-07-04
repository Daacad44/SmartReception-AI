import type { AIResponse } from './ai.types';

function unescapeJsonString(value: string): string {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}

function normalizeParsedResponse(
  parsed: Partial<AIResponse>,
  fallbackLanguage: 'so' | 'en'
): AIResponse | null {
  const content = typeof parsed.content === 'string' ? parsed.content.trim() : '';
  if (!content) return null;

  return {
    content,
    intent: typeof parsed.intent === 'string' ? parsed.intent : 'general',
    actions: Array.isArray(parsed.actions) ? parsed.actions : [{ type: 'none' }],
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.7,
    language: parsed.language || fallbackLanguage,
  };
}

function stripMarkdownFence(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced?.[1] ?? text).trim();
}

function extractContentField(text: string): string | null {
  const complete = text.match(/"content"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (complete?.[1]) return unescapeJsonString(complete[1]).trim();

  const truncated = text.match(/"content"\s*:\s*"([\s\S]*?)$/);
  if (truncated?.[1]) return unescapeJsonString(truncated[1]).trim();

  return null;
}

function looksLikeJsonPayload(text: string): boolean {
  const t = text.trim();
  return t.startsWith('{') && /"content"\s*:/.test(t);
}

/**
 * Parse Gemini JSON-mode replies without leaking raw JSON to WhatsApp when
 * the model returns truncated or slightly malformed JSON.
 */
export function parseGeminiAiResponse(
  responseText: string,
  fallbackLanguage: 'so' | 'en'
): AIResponse | null {
  const text = stripMarkdownFence(responseText.trim());
  if (!text) return null;

  const candidates = [text];
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    candidates.push(text.slice(start, end + 1));
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as Partial<AIResponse>;
      const normalized = normalizeParsedResponse(parsed, fallbackLanguage);
      if (normalized) return normalized;
    } catch {
      // try next strategy
    }
  }

  const extractedContent = extractContentField(text);
  if (extractedContent) {
    return {
      content: extractedContent,
      intent: 'general',
      actions: [{ type: 'none' }],
      confidence: 0.5,
      language: fallbackLanguage,
    };
  }

  if (looksLikeJsonPayload(text)) {
    return null;
  }

  return {
    content: text.slice(0, 2000),
    intent: 'general',
    actions: [{ type: 'none' }],
    confidence: 0.5,
    language: fallbackLanguage,
  };
}
