export type CustomerIntent =
  | 'general'
  | 'pricing'
  | 'services'
  | 'products'
  | 'support'
  | 'booking'
  | 'lead'
  | 'company_intro'
  | 'contact'
  | 'menu'
  | 'policy';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface ScoredChunk {
  id: string;
  title: string | null;
  category: string | null;
  tags: string[];
  content: string;
  score: number;
  confidence: ConfidenceLevel;
  language: string;
  documentId?: string | null;
  priority: number;
  updatedAt?: Date;
}

export interface EnterpriseRetrievalResult {
  chunks: ScoredChunk[];
  categories: string[];
  intent: CustomerIntent;
  route: 'business_profile' | 'knowledge_base';
  searchSuccess: boolean;
  usedFallback: boolean;
  cacheHit: boolean;
  retrievalMs: number;
  validationMs: number;
  rankingMs: number;
  baselineCharEstimate: number;
  maxScore: number;
  avgScore: number;
  groundedConfidence: number;
  hallucinationRisk: number;
  secondaryRetrievalUsed: boolean;
  knowledgeIds: string[];
}

export interface PromptBuildResult {
  systemPrompt: string;
  userPrompt: string;
  knowledgeChars: number;
  contextChars: number;
  compressionPercent: number;
  citations: string[];
}
