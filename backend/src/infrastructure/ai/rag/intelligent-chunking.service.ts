import { config } from '../../../config';

const CHARS_PER_TOKEN = 4;

export function tokensToChars(tokens: number): number {
  return tokens * CHARS_PER_TOKEN;
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Sentence-aware chunking with configurable token size and overlap.
 * Default: ~450 tokens (1800 chars) with ~75 token overlap.
 */
export function intelligentChunkText(
  text: string,
  tokenSize = config.ai.ragChunkTokenSize,
  overlapTokens = config.ai.ragChunkOverlapTokens
): string[] {
  const maxChars = tokensToChars(tokenSize);
  const overlapChars = tokensToChars(overlapTokens);
  const sentences = splitSentences(text);

  if (!sentences.length) {
    return text.trim() ? [text.slice(0, maxChars)] : [];
  }

  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    const candidate = current ? `${current} ${sentence}` : sentence;

    if (candidate.length > maxChars && current) {
      chunks.push(current.trim());
      const words = current.split(/\s+/);
      const overlapWordCount = Math.max(1, Math.floor(overlapChars / 6));
      const tail = words.slice(-overlapWordCount).join(' ');
      current = tail ? `${tail} ${sentence}` : sentence;
    } else {
      current = candidate;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks.length ? chunks : [text.slice(0, maxChars)];
}
