/**
 * Seed SmartReception AI knowledge base for a business.
 * Usage: BUSINESS_ID=<uuid> npx tsx src/scripts/seed-smartreception-kb.ts
 */
import { PrismaClient } from '@prisma/client';
import {
  SMARTRECEPTION_KB_FAQS,
  SMARTRECEPTION_SYSTEM_PROMPT,
  SMARTRECEPTION_WELCOME_MESSAGE,
} from '../infrastructure/ai/smartreception-knowledge';

const prisma = new PrismaClient();

async function main() {
  const businessId = process.env.BUSINESS_ID;
  if (!businessId) {
    console.error('Set BUSINESS_ID environment variable');
    process.exit(1);
  }

  await prisma.aIConfiguration.upsert({
    where: { businessId },
    update: {
      systemPrompt: SMARTRECEPTION_SYSTEM_PROMPT,
      greetingMessage: SMARTRECEPTION_WELCOME_MESSAGE,
      enableAutoReply: true,
      enableBooking: true,
      enableLeadQualification: true,
    },
    create: {
      businessId,
      systemPrompt: SMARTRECEPTION_SYSTEM_PROMPT,
      greetingMessage: SMARTRECEPTION_WELCOME_MESSAGE,
      enableAutoReply: true,
      enableBooking: true,
      enableLeadQualification: true,
      languages: ['en'],
    },
  });

  const kb =
    (await prisma.knowledgeBase.findFirst({ where: { businessId, isActive: true } })) ??
    (await prisma.knowledgeBase.create({
      data: {
        businessId,
        name: 'SmartReception AI Knowledge',
        description: 'Company services, FAQs, and product information',
        isActive: true,
      },
    }));

  for (const faq of SMARTRECEPTION_KB_FAQS) {
    const existing = await prisma.knowledgeDocument.findFirst({
      where: { knowledgeBaseId: kb.id, title: faq.title },
    });
    const content = `Q: ${faq.question}\nA: ${faq.answer}`;
    if (existing) {
      await prisma.knowledgeDocument.update({
        where: { id: existing.id },
        data: {
          question: faq.question,
          answer: faq.answer,
          content,
          category: faq.category,
          status: 'INDEXED',
        },
      });
    } else {
      await prisma.knowledgeDocument.create({
        data: {
          knowledgeBaseId: kb.id,
          title: faq.title,
          type: 'FAQ',
          status: 'INDEXED',
          question: faq.question,
          answer: faq.answer,
          content,
          category: faq.category,
        },
      });
    }
  }

  console.log(`SmartReception KB seeded for business ${businessId} (${SMARTRECEPTION_KB_FAQS.length} FAQs)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
