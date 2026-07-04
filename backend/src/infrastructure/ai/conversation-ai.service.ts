import { geminiService, generateResponse } from './gemini.service';

/** @deprecated Use geminiService — kept for backward-compatible imports */
export const aiService = {
  generateResponse,
  detectIntent: geminiService.detectIntent,
};

export { geminiService };
export type { AIResponse, AIAction, LeadData } from './ai.types';
