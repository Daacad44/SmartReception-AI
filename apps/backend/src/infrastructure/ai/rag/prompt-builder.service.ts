import type { RetrievedChunk } from './retrieval.service';

export interface OptimizedPromptInput {
  businessName: string;
  systemPrompt: string;
  knowledgeChunks: RetrievedChunk[];
  memoryContext: string;
  customerMessage: string;
  preferEnglish: boolean;
  route: 'knowledge_base' | 'business_profile';
  profileContext?: string;
}

function languageRule(preferEnglish: boolean): string {
  return preferEnglish
    ? 'Reply ONLY in English.'
    : 'Reply ONLY in Somali (Af-Soomaali) unless customer explicitly requested English.';
}

export function buildOptimizedKnowledgePrompt(input: OptimizedPromptInput): {
  systemPrompt: string;
  userPrompt: string;
  knowledgeChars: number;
} {
  const knowledgeText = input.knowledgeChunks.length
    ? input.knowledgeChunks
        .map((c, i) => `[${i + 1}] ${c.title ?? c.category ?? 'Info'}\n${c.content}`)
        .join('\n\n')
    : '(No matching knowledge found)';

  const systemPrompt = `${input.systemPrompt}

You are the operational assistant for ${input.businessName}.
${languageRule(input.preferEnglish)}
Use ONLY the retrieved knowledge excerpts below. Do not invent facts.
Respond in JSON: {"content":"","intent":"","actions":[{"type":"none"}],"confidence":0.0,"language":"so|en"}`;

  const userPrompt = `RETRIEVED KNOWLEDGE (${input.knowledgeChunks.length} chunks):
${knowledgeText}

${input.memoryContext}

CUSTOMER MESSAGE:
${input.customerMessage}`;

  return { systemPrompt, userPrompt, knowledgeChars: knowledgeText.length };
}

export function buildOptimizedProfilePrompt(input: OptimizedPromptInput): {
  systemPrompt: string;
  userPrompt: string;
  knowledgeChars: number;
} {
  const systemPrompt = `You are the company identity assistant for ${input.businessName}.
${languageRule(input.preferEnglish)}
Answer ONLY company identity questions from the business profile below.
Respond in JSON: {"content":"","intent":"company_intro|contact|general","actions":[{"type":"none"}],"confidence":0.0,"language":"so|en"}`;

  const userPrompt = `BUSINESS PROFILE:
${input.profileContext || '(Not configured)'}

${input.memoryContext}

CUSTOMER MESSAGE:
${input.customerMessage}`;

  return { systemPrompt, userPrompt, knowledgeChars: input.profileContext?.length ?? 0 };
}

export function estimateTokensFromChars(chars: number): number {
  return Math.ceil(chars / 4);
}
