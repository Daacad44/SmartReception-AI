import OpenAI from 'openai';
import { config } from '../../config';
import { prisma } from '../database/prisma';
import { logger } from '../../core/logger';
import { loadBusinessAIContext } from './business-ai-context.service';

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
    const businessContext = await loadBusinessAIContext(businessId);
    const { aiConfiguration } = businessContext;

    const conversationHistory = await prisma.message.findMany({
      where: { conversationId, conversation: { businessId } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const bookingEnabled = aiConfiguration.enableBooking ? 'enabled' : 'disabled';
    const leadEnabled = aiConfiguration.enableLeadQualification ? 'enabled' : 'disabled';

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: `${businessContext.systemPrompt}

Business: ${businessContext.businessName}

Knowledge Base (${businessContext.businessName}):
${businessContext.knowledgeContext}

Capabilities:
- Appointment booking: ${bookingEnabled}
- Lead qualification: ${leadEnabled}

Instructions:
- Answer ONLY using the knowledge base and business context above
- Detect customer intent (support, booking, lead, general)
- If booking is requested and enabled, collect date/time preferences
- If you cannot help, suggest human assistance
- Never reference SmartReception or any other business

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
        temperature: aiConfiguration.temperature ?? 0.7,
        max_tokens: aiConfiguration.maxTokens ?? 500,
        response_format: { type: 'json_object' },
      });

      const responseText = completion.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(responseText) as AIResponse;

      return {
        content: parsed.content || businessContext.fallbackMessage,
        intent: parsed.intent || 'general',
        actions: parsed.actions || [{ type: 'none' }],
        confidence: parsed.confidence ?? 0.5,
      };
    } catch (error) {
      logger.error('AI generation failed:', { error, businessId, conversationId });
      return {
        content: businessContext.fallbackMessage,
        intent: 'general',
        actions: [{ type: 'escalate' }],
        confidence: 0,
      };
    }
  }

  async detectIntent(message: string, businessId: string): Promise<string> {
    const businessContext = await loadBusinessAIContext(businessId);

    try {
      const completion = await this.getClient().chat.completions.create({
        model: config.openai.model,
        messages: [
          {
            role: 'system',
            content: `Classify the customer message intent for ${businessContext.businessName}. Respond with one word: support, booking, lead, or general.`,
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
}

export const aiService = new AIService();
