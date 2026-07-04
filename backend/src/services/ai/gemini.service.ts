/**
 * Unified AI service layer — re-exports Gemini implementation.
 * @see infrastructure/ai/gemini.service.ts
 */
export {
  geminiService,
  generateResponse,
  summarizeDocument,
  extractKnowledge,
  answerQuestion,
  generateEmbedding,
  generateEmbeddings,
  cosineSimilarity,
  detectIntent,
} from '../../infrastructure/ai/gemini.service';
