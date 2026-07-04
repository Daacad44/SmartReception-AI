import { config } from '../../../config';
import type { ScoredChunk } from './types';
import type { ConversationMemoryContext } from '../memory/conversation-memory.service';

export interface CompressionResult {
  knowledgeText: string;
  memoryText: string;
  knowledgeChars: number;
  contextChars: number;
  compressionPercent: number;
  citations: string[];
}

export function compressContextForPrompt(params: {
  chunks: ScoredChunk[];
  memory: ConversationMemoryContext;
  baselineCharEstimate: number;
  maxKnowledgeChars?: number;
}): CompressionResult {
  const maxChars = params.maxKnowledgeChars ?? config.ai.ragMaxKnowledgeChars;
  const citations: string[] = [];

  let knowledgeParts = params.chunks.map((chunk, i) => {
    citations.push(chunk.id);
    return `[${i + 1}|${chunk.id.slice(0, 8)}] ${chunk.title ?? chunk.category ?? 'Knowledge'} (score:${chunk.score.toFixed(2)})\n${chunk.content}`;
  });

  let knowledgeText = knowledgeParts.join('\n\n');
  if (knowledgeText.length > maxChars) {
    const ratio = maxChars / knowledgeText.length;
    knowledgeParts = params.chunks.map((chunk, i) => {
      const excerpt = chunk.content.slice(0, Math.floor(chunk.content.length * ratio));
      return `[${i + 1}] ${chunk.title ?? 'Knowledge'}\n${excerpt}…`;
    });
    knowledgeText = knowledgeParts.join('\n\n').slice(0, maxChars);
  }

  const memoryParts: string[] = [];
  if (params.memory.summary) {
    const summary =
      params.memory.summary.length > config.ai.summaryMaxChars
        ? params.memory.summary.slice(0, config.ai.summaryMaxChars)
        : params.memory.summary;
    memoryParts.push(`SUMMARY:\n${summary}`);
  }
  if (params.memory.recentExchanges) {
    const recent = params.memory.recentExchanges.slice(0, 2000);
    memoryParts.push(`RECENT:\n${recent}`);
  }
  const memoryText = memoryParts.join('\n\n') || 'No prior context.';

  const contextChars = knowledgeText.length + memoryText.length;
  const uncompressed = Math.max(params.baselineCharEstimate, contextChars, 1);
  const compressionPercent = Math.max(
    0,
    Math.min(95, ((uncompressed - contextChars) / uncompressed) * 100)
  );

  return {
    knowledgeText,
    memoryText,
    knowledgeChars: knowledgeText.length,
    contextChars,
    compressionPercent,
    citations,
  };
}
