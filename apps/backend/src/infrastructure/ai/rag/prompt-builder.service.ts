import type { ScoredChunk } from './types';
import type { CompressionResult } from './context-compression.service';

export interface EnterprisePromptInput {
  businessName: string;
  systemPrompt: string;
  compressed: CompressionResult;
  customerMessage: string;
  preferEnglish: boolean;
  route: 'knowledge_base' | 'business_profile';
  profileContext?: string;
  groundedConfidence: number;
}

function languageRule(preferEnglish: boolean): string {
  return preferEnglish
    ? 'Reply ONLY in English.'
    : 'Reply ONLY in Somali (Af-Soomaali) unless customer explicitly requested English.';
}

const HALLUCINATION_RULES = `
STRICT RULES:
- Answer ONLY using the retrieved knowledge provided below.
- NEVER invent pricing, services, products, policies, or facts not in the knowledge.
- If knowledge is insufficient, say politely that you do not have that information.
- Do NOT guess or assume missing facts.
- If records conflict, prefer the newest/highest-scored excerpt.
- Include source references in your reasoning but respond naturally to the customer.`;

export function buildEnterpriseKnowledgePrompt(input: EnterprisePromptInput): {
  systemPrompt: string;
  userPrompt: string;
  knowledgeChars: number;
  contextChars: number;
  compressionPercent: number;
  citations: string[];
} {
  const knowledgeText = input.compressed.knowledgeText || '(No matching knowledge found)';

  const systemPrompt = `${input.systemPrompt}

You are the operational assistant for ${input.businessName}.
${languageRule(input.preferEnglish)}
${HALLUCINATION_RULES}
Grounded confidence: ${(input.groundedConfidence * 100).toFixed(0)}%
Respond in JSON: {"content":"","intent":"","actions":[{"type":"none"}],"confidence":0.0,"language":"so|en","citations":[]}`;

  const userPrompt = `RETRIEVED KNOWLEDGE (${input.compressed.citations.length} chunks):
${knowledgeText}

${input.compressed.memoryText}

CUSTOMER MESSAGE:
${input.customerMessage}`;

  return {
    systemPrompt,
    userPrompt,
    knowledgeChars: input.compressed.knowledgeChars,
    contextChars: input.compressed.contextChars,
    compressionPercent: input.compressed.compressionPercent,
    citations: input.compressed.citations,
  };
}

export function buildEnterpriseProfilePrompt(input: EnterprisePromptInput): {
  systemPrompt: string;
  userPrompt: string;
  knowledgeChars: number;
  contextChars: number;
  compressionPercent: number;
  citations: string[];
} {
  const systemPrompt = `You are the company identity assistant for ${input.businessName}.
${languageRule(input.preferEnglish)}
Answer ONLY company identity questions from the business profile below. Do not invent facts.
Respond in JSON: {"content":"","intent":"company_intro|contact|general","actions":[{"type":"none"}],"confidence":0.0,"language":"so|en"}`;

  const userPrompt = `BUSINESS PROFILE:
${input.profileContext || '(Not configured)'}

${input.compressed.memoryText}

CUSTOMER MESSAGE:
${input.customerMessage}`;

  const chars = input.profileContext?.length ?? 0;
  return {
    systemPrompt,
    userPrompt,
    knowledgeChars: chars,
    contextChars: chars + input.compressed.memoryText.length,
    compressionPercent: 0,
    citations: [],
  };
}

export function estimateTokensFromChars(chars: number): number {
  return Math.ceil(chars / 4);
}

export function mapScoredToLegacy(chunks: ScoredChunk[]) {
  return chunks.map((c) => ({
    id: c.id,
    title: c.title,
    category: c.category,
    tags: c.tags,
    content: c.content,
    score: c.score,
    language: c.language,
  }));
}
