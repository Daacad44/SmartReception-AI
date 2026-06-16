import OpenAI from 'openai';
import { config } from '../../config';
import { prisma } from '../database/prisma';
import { logger } from '../../core/logger';

export interface AIResponse {
  content: string;
  intent: string;
  actions: AIAction[];
  confidence: number;
}

export interface AIAction {
  type: 'book_appointment' | 'qualify_lead' | 'escalate' | 'none';
  data?: Record<string, unknown>;
}

export class AIService {
  private client: OpenAI | null = null;

  private getClient(): OpenAI {
    if (!this.client) {
      if (!config.openai.apiKey) {
        throw new Error('OpenAI API key not configured');
      }
      this.client = new OpenAI({ apiKey: config.openai.apiKey });
    }
    return this.client;
  }

  async generateResponse(
    businessId: string,
    conversationId: string,
    customerMessage: string
  ): Promise<AIResponse> {
    const aiConfig = await prisma.aIConfiguration.findUnique({
      where: { businessId },
    });

    const knowledgeBase = await prisma.knowledgeBase.findFirst({
      where: { businessId, isActive: true },
      include: {
        documents: {
          where: { status: 'INDEXED' },
          take: 20,
        },
      },
    });

    const conversationHistory = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const knowledgeContext = knowledgeBase?.documents
      .map((doc) => {
        if (doc.type === 'FAQ') {
          return `Q: ${doc.question}\nA: ${doc.answer}`;
        }
        return doc.content?.slice(0, 1000) || '';
      })
      .filter(Boolean)
      .join('\n\n');

    const systemPrompt = aiConfig?.systemPrompt || this.getDefaultSystemPrompt();
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: `${systemPrompt}

Knowledge Base:
${knowledgeContext || 'No knowledge base content available.'}

Instructions:
- Detect customer intent (support, booking, lead, general)
- Use knowledge base to answer questions accurately
- If booking is requested and enabled, collect date/time preferences
- Respond in a professional, helpful tone
- If you cannot help, suggest human assistance

Respond in JSON format:
{
  "content": "your response message",
  "intent": "support|booking|lead|general",
  "actions": [{"type": "none"}],
  "confidence": 0.0-1.0
}`,
      },
      ...conversationHistory.reverse().map((msg) => ({
        role: (msg.direction === 'INBOUND' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user', content: customerMessage },
    ];

    try {
      const completion = await this.getClient().chat.completions.create({
        model: config.openai.model,
        messages,
        temperature: aiConfig?.temperature ?? 0.7,
        max_tokens: aiConfig?.maxTokens ?? 500,
        response_format: { type: 'json_object' },
      });

      const responseText = completion.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(responseText) as AIResponse;

      return {
        content: parsed.content || aiConfig?.fallbackMessage || 'I apologize, I could not process your request.',
        intent: parsed.intent || 'general',
        actions: parsed.actions || [{ type: 'none' }],
        confidence: parsed.confidence ?? 0.5,
      };
    } catch (error) {
      logger.error('AI generation failed:', error);
      return {
        content: aiConfig?.fallbackMessage || 'I apologize, I am having trouble right now. A team member will assist you shortly.',
        intent: 'general',
        actions: [{ type: 'escalate' }],
        confidence: 0,
      };
    }
  }

  async detectIntent(message: string): Promise<string> {
    try {
      const completion = await this.getClient().chat.completions.create({
        model: config.openai.model,
        messages: [
          {
            role: 'system',
            content: 'Classify the customer message intent. Respond with one word: support, booking, lead, or general.',
          },
          { role: 'user', content: message },
        ],
        max_tokens: 10,
        temperature: 0,
      });
      return completion.choices[0]?.message?.content?.toLowerCase().trim() || 'general';
    } catch {
      return 'general';
    }
  }

  private getDefaultSystemPrompt(): string {
    return `You are SmartReception AI, an intelligent virtual assistant for businesses.
You help with customer support, appointment booking, and lead qualification via WhatsApp.
Be professional, concise, and helpful. Always prioritize customer satisfaction.`;
  }
}

export const aiService = new AIService();
