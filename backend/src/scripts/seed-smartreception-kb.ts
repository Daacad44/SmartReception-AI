/**
 * Seed SmartReception AI knowledge base for a business.
 * Usage: BUSINESS_ID=<uuid> npx tsx src/scripts/seed-smartreception-kb.ts
 */
import { PrismaClient } from '@prisma/client';
import {
  SMARTRECEPTION_KB_FAQS,
  SMARTRECEPTION_SYSTEM_PROMPT,
  SMARTRECEPTION_WELCOME_SO,
} from '../infrastructure/ai/smartreception-knowledge';
import { MENU_OPTIONS } from '../infrastructure/ai/somali-menu';

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
      greetingMessage: SMARTRECEPTION_WELCOME_SO,
      enableAutoReply: true,
      enableBooking: true,
      enableLeadQualification: true,
    },
    create: {
      businessId,
      systemPrompt: SMARTRECEPTION_SYSTEM_PROMPT,
      greetingMessage: SMARTRECEPTION_WELCOME_SO,
      enableAutoReply: true,
      enableBooking: true,
      enableLeadQualification: true,
      languages: ['so', 'en'],
    },
  });

  const kb =
    (await prisma.knowledgeBase.findFirst({ where: { businessId, isActive: true } })) ??
    (await prisma.knowledgeBase.create({
      data: {
        businessId,
        name: 'SmartReception AI Knowledge',
        description: 'Company services, FAQs, and product information (Somali + English)',
        isActive: true,
      },
    }));

  for (const faq of SMARTRECEPTION_KB_FAQS) {
    const existing = await prisma.knowledgeDocument.findFirst({
      where: { knowledgeBaseId: kb.id, title: faq.title },
    });

    const questionSo = faq.questionSo || faq.question;
    const answerSo = faq.answerSo || faq.answer;
    const content = [
      `EN Q: ${faq.question}`,
      `EN A: ${faq.answer}`,
      `SO Q: ${questionSo}`,
      `SO A: ${answerSo}`,
    ].join('\n');

    if (existing) {
      await prisma.knowledgeDocument.update({
        where: { id: existing.id },
        data: {
          question: `${faq.question} / ${questionSo}`,
          answer: `${faq.answer}\n\n${answerSo}`,
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
          question: `${faq.question} / ${questionSo}`,
          answer: `${faq.answer}\n\n${answerSo}`,
          content,
          category: faq.category,
        },
      });
    }
  }

  for (const [num, option] of Object.entries(MENU_OPTIONS)) {
    const title = `Menu Option ${num}: ${option.title}`;
    const existing = await prisma.knowledgeDocument.findFirst({
      where: { knowledgeBaseId: kb.id, title },
    });
    const content = `Menu ${num} — ${option.title}\n\n${option.content}`;
    if (existing) {
      await prisma.knowledgeDocument.update({
        where: { id: existing.id },
        data: { content, category: 'Services', status: 'INDEXED' },
      });
    } else {
      await prisma.knowledgeDocument.create({
        data: {
          knowledgeBaseId: kb.id,
          title,
          type: 'FAQ',
          status: 'INDEXED',
          question: `Dooro ${num} — ${option.title}`,
          answer: option.content,
          content,
          category: 'Services',
        },
      });
    }
  }

  console.log(
    `SmartReception KB seeded for business ${businessId} (${SMARTRECEPTION_KB_FAQS.length} FAQs + ${Object.keys(MENU_OPTIONS).length} menu options)`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
