import { prisma } from '../database/prisma';
import { generateEmbedding, cosineSimilarity } from './embedding.service';
import { getCachedBusinessProfile } from './business-tenant-cache.service';
import { isSmartReceptionBusiness } from './smartreception-tenant';
import type { TrainingSnapshot, TrainingSnapshotDocument } from '../../modules/ai-training-mgmt/quality.service';

const KB_CACHE_TTL_MS = 60_000;
const kbDocumentCache = new Map<string, { docs: CachedDoc[]; loadedAt: number }>();
const versionCache = new Map<string, { docs: CachedDoc[]; loadedAt: number }>();

type CachedDoc = {
  title: string;
  type: string;
  question: string | null;
  answer: string | null;
  content: string | null;
  embedding: string | null;
};

function snapshotDocToCached(doc: TrainingSnapshotDocument): CachedDoc {
  return {
    title: doc.title,
    type: doc.type,
    question: doc.question,
    answer: doc.answer,
    content: doc.content,
    embedding: doc.embedding,
  };
}

async function loadProductionSnapshotDocuments(businessId: string): Promise<CachedDoc[] | null> {
  const workspace = await prisma.aiTrainingWorkspace.findUnique({
    where: { businessId },
    include: { productionVersion: { select: { snapshotData: true } } },
  });
  if (!workspace?.productionVersion?.snapshotData) return null;
  const snapshot = workspace.productionVersion.snapshotData as unknown as TrainingSnapshot;
  return (snapshot.documents ?? []).map(snapshotDocToCached);
}

async function loadVersionSnapshotDocuments(versionId: string): Promise<CachedDoc[]> {
  const cached = versionCache.get(versionId);
  const now = Date.now();
  if (cached && now - cached.loadedAt < KB_CACHE_TTL_MS) {
    return cached.docs;
  }

  const version = await prisma.aiTrainingVersion.findUnique({
    where: { id: versionId },
    select: { snapshotData: true },
  });
  const snapshot = version?.snapshotData as unknown as TrainingSnapshot | null;
  const docs = (snapshot?.documents ?? []).map(snapshotDocToCached);
  versionCache.set(versionId, { docs, loadedAt: now });
  return docs;
}

/** Somali/English service keywords → boost matching KB chunks (SmartReception platform only). */
const SMARTRECEPTION_KEYWORD_BOOSTS: Array<{ pattern: RegExp; terms: string[] }> = [
  { pattern: /adeeg|service|maxay/i, terms: ['adeeg', 'service', 'AI Receptionist', 'WhatsApp'] },
  { pattern: /website|web/i, terms: ['website', 'Website Development', 'samaysaan'] },
  { pattern: /app|mobile|dhistaan/i, terms: ['mobile', 'app', 'Android', 'iOS'] },
  { pattern: /whatsapp|automation|bixisaan|haysaan/i, terms: ['WhatsApp', 'automation'] },
  { pattern: /crm/i, terms: ['CRM', 'customer'] },
  { pattern: /software|saas/i, terms: ['software', 'SaaS', 'custom'] },
  { pattern: /smartreception|waa maxay/i, terms: ['SmartReception', 'Waa maxay'] },
  { pattern: /ballan|appointment/i, terms: ['appointment', 'ballan'] },
  { pattern: /qiimo|price|cost/i, terms: ['pricing', 'qiimo', 'cost'] },
];

const GENERIC_KEYWORD_BOOSTS: Array<{ pattern: RegExp; terms: string[] }> = [
  { pattern: /ballan|appointment/i, terms: ['appointment', 'ballan', 'booking'] },
  { pattern: /qiimo|price|cost|menu/i, terms: ['pricing', 'qiimo', 'price', 'menu'] },
  { pattern: /xiriir|contact|phone/i, terms: ['contact', 'phone', 'whatsapp'] },
];

async function loadIndexedDocuments(businessId: string): Promise<CachedDoc[]> {
  const cached = kbDocumentCache.get(businessId);
  const now = Date.now();
  if (cached && now - cached.loadedAt < KB_CACHE_TTL_MS) {
    return cached.docs;
  }

  const docs = await prisma.knowledgeDocument.findMany({
    where: { status: 'INDEXED', knowledgeBase: { businessId, isActive: true } },
    select: {
      title: true,
      type: true,
      question: true,
      answer: true,
      content: true,
      embedding: true,
    },
    take: 100,
  });

  kbDocumentCache.set(businessId, { docs, loadedAt: now });
  return docs;
}

export function invalidateKnowledgeCache(businessId: string): void {
  kbDocumentCache.delete(businessId);
}

export function invalidateVersionKnowledgeCache(versionId: string): void {
  versionCache.delete(versionId);
}

async function scoreDocuments(
  documents: CachedDoc[],
  query: string,
  businessId: string
): Promise<string> {
  const boosts = await resolveKeywordBoosts(businessId);
  const queryLower = query.toLowerCase();

  type Scored = { text: string; score: number; source: string };
  const scored: Scored[] = [];

  for (const doc of documents) {
    if (doc.type === 'FAQ' && doc.question) {
      const text = `Q: ${doc.question}\nA: ${doc.answer ?? ''}`;
      let score = text.toLowerCase().includes(queryLower) ? 0.65 : 0.25;
      if (doc.question.toLowerCase().includes(queryLower)) score = 0.92;
      score += keywordBoost(query, text, boosts);
      scored.push({ text, score, source: doc.title });
      continue;
    }

    if (doc.content) {
      const content = doc.content.slice(0, 900);
      const score = 0.3 + keywordBoost(query, content, boosts);
      if (content.toLowerCase().includes(queryLower)) {
        scored.push({ text: content, score: Math.max(score, 0.6), source: doc.title });
      } else if (score > 0.35) {
        scored.push({ text: content, score, source: doc.title });
      }
    }
  }

  const keywordTop = scored.sort((a, b) => b.score - a.score).slice(0, 8);
  if (keywordTop.length > 0 && keywordTop[0]!.score >= 0.65) {
    return keywordTop.map((s) => `[${s.source}]\n${s.text}`).join('\n\n');
  }

  const queryEmbedding = await generateEmbedding(query);

  for (const doc of documents) {
    if (doc.type === 'FAQ' && doc.question) continue;

    if (doc.embedding) {
      try {
        const parsed = JSON.parse(doc.embedding) as {
          chunks?: Array<{ text: string; embedding?: number[] | null } | string>;
        };
        for (const chunk of parsed.chunks ?? []) {
          const text = typeof chunk === 'string' ? chunk : chunk.text;
          const emb = typeof chunk === 'string' ? null : chunk.embedding;
          let score = text.toLowerCase().includes(queryLower) ? 0.55 : 0.1;
          if (queryEmbedding && emb?.length) {
            score = Math.max(score, cosineSimilarity(queryEmbedding, emb));
          }
          score += keywordBoost(query, text, boosts);
          if (score > 0.2) scored.push({ text: text.slice(0, 900), score, source: doc.title });
        }
      } catch {
        const content = doc.content?.slice(0, 900) ?? '';
        if (content) {
          scored.push({
            text: content,
            score: 0.35 + keywordBoost(query, content, boosts),
            source: doc.title,
          });
        }
      }
    } else if (doc.content) {
      const content = doc.content.slice(0, 900);
      scored.push({
        text: content,
        score: 0.3 + keywordBoost(query, content, boosts),
        source: doc.title,
      });
    }
  }

  const top = scored.sort((a, b) => b.score - a.score).slice(0, 8);
  if (!top.length) return '';
  return top.map((s) => `[${s.source}]\n${s.text}`).join('\n\n');
}

/** Search knowledge using a specific training version snapshot (sandbox). */
export async function searchVersionKnowledgeContext(versionId: string, query: string): Promise<string> {
  const documents = await loadVersionSnapshotDocuments(versionId);
  if (!documents.length) return '';
  const version = await prisma.aiTrainingVersion.findUnique({
    where: { id: versionId },
    select: { businessId: true },
  });
  if (!version) return '';
  return scoreDocuments(documents, query, version.businessId);
}

function keywordBoost(query: string, text: string, boosts: Array<{ pattern: RegExp; terms: string[] }>): number {
  let boost = 0;
  const textLower = text.toLowerCase();
  for (const { pattern, terms } of boosts) {
    if (pattern.test(query)) {
      for (const term of terms) {
        if (textLower.includes(term.toLowerCase())) {
          boost = Math.max(boost, 0.35);
        }
      }
    }
  }
  return boost;
}

async function resolveKeywordBoosts(businessId: string) {
  const { business } = await getCachedBusinessProfile(businessId);
  if (isSmartReceptionBusiness(business)) {
    return SMARTRECEPTION_KEYWORD_BOOSTS;
  }
  return GENERIC_KEYWORD_BOOSTS;
}

/** Retrieve relevant knowledge chunks for AI context (semantic + keyword fallback). */
export async function searchKnowledgeContext(businessId: string, query: string): Promise<string> {
  const productionDocs = await loadProductionSnapshotDocuments(businessId);
  const documents = productionDocs ?? (await loadIndexedDocuments(businessId));
  if (!documents.length) return '';
  return scoreDocuments(documents, query, businessId);
}

