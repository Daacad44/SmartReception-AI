import { prisma } from '../database/prisma';
import { generateEmbedding, cosineSimilarity } from './embedding.service';

/** Retrieve relevant knowledge chunks for AI context (semantic + keyword fallback). */
export async function searchKnowledgeContext(businessId: string, query: string): Promise<string> {
  const documents = await prisma.knowledgeDocument.findMany({
    where: { status: 'INDEXED', knowledgeBase: { businessId, isActive: true } },
    select: {
      title: true,
      type: true,
      question: true,
      answer: true,
      content: true,
      embedding: true,
    },
    take: 50,
  });

  if (!documents.length) return '';

  const queryLower = query.toLowerCase();
  const queryEmbedding = await generateEmbedding(query);

  type Scored = { text: string; score: number };
  const scored: Scored[] = [];

  for (const doc of documents) {
    if (doc.type === 'FAQ' && doc.question) {
      const text = `Q: ${doc.question}\nA: ${doc.answer ?? ''}`;
      let score = text.toLowerCase().includes(queryLower) ? 0.6 : 0.2;
      if (doc.question.toLowerCase().includes(queryLower)) score = 0.9;
      scored.push({ text, score });
      continue;
    }

    if (doc.embedding) {
      try {
        const parsed = JSON.parse(doc.embedding) as {
          chunks?: Array<{ text: string; embedding?: number[] | null } | string>;
        };
        for (const chunk of parsed.chunks ?? []) {
          const text = typeof chunk === 'string' ? chunk : chunk.text;
          const emb = typeof chunk === 'string' ? null : chunk.embedding;
          let score = text.toLowerCase().includes(queryLower) ? 0.5 : 0;
          if (queryEmbedding && emb?.length) {
            score = Math.max(score, cosineSimilarity(queryEmbedding, emb));
          }
          if (score > 0.25) scored.push({ text: text.slice(0, 800), score });
        }
      } catch {
        const content = doc.content?.slice(0, 800) ?? '';
        if (content) scored.push({ text: content, score: 0.3 });
      }
    } else if (doc.content) {
      scored.push({ text: doc.content.slice(0, 800), score: 0.25 });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((s) => s.text)
    .join('\n\n');
}
