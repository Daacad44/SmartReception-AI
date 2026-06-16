import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const passwordHash = await bcrypt.hash('Demo1234!', 12);

  const user = await prisma.user.upsert({
    where: { email: 'demo@smartreception.ai' },
    update: {},
    create: {
      email: 'demo@smartreception.ai',
      passwordHash,
      firstName: 'Demo',
      lastName: 'Owner',
      isEmailVerified: true,
    },
  });

  const business = await prisma.business.upsert({
    where: { slug: 'demo-clinic' },
    update: {},
    create: {
      name: 'Demo Wellness Clinic',
      slug: 'demo-clinic',
      description: 'A demo business for SmartReception AI',
      industry: 'CLINIC',
      phone: '+15551234567',
      email: 'contact@democlinic.com',
      website: 'https://democlinic.com',
      address: '123 Health Street, Medical City',
      timezone: 'America/New_York',
    },
  });

  await prisma.businessMember.upsert({
    where: { businessId_userId: { businessId: business.id, userId: user.id } },
    update: {},
    create: {
      businessId: business.id,
      userId: user.id,
      role: 'OWNER',
    },
  });

  await prisma.subscription.upsert({
    where: { businessId: business.id },
    update: {},
    create: {
      businessId: business.id,
      plan: 'PROFESSIONAL',
      status: 'TRIALING',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.aIConfiguration.upsert({
    where: { businessId: business.id },
    update: {},
    create: {
      businessId: business.id,
      systemPrompt:
        'You are a friendly receptionist for Demo Wellness Clinic. Help patients book appointments and answer common questions.',
      greetingMessage: 'Hello! Welcome to Demo Wellness Clinic. How can I help you today?',
      fallbackMessage:
        'I apologize, I could not find an answer. Let me connect you with our team.',
      enableAutoReply: true,
      enableBooking: true,
      enableLeadQualification: true,
      languages: ['en'],
    },
  });

  const knowledgeBase = await prisma.knowledgeBase.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      businessId: business.id,
      name: 'Default Knowledge Base',
      description: 'Clinic FAQs and policies',
    },
  });

  await prisma.knowledgeDocument.createMany({
    data: [
      {
        knowledgeBaseId: knowledgeBase.id,
        title: 'Office Hours',
        type: 'FAQ',
        status: 'INDEXED',
        question: 'What are your office hours?',
        answer: 'We are open Monday to Friday, 8 AM to 6 PM, and Saturday 9 AM to 1 PM.',
        content:
          'Q: What are your office hours?\nA: We are open Monday to Friday, 8 AM to 6 PM, and Saturday 9 AM to 1 PM.',
        category: 'General',
      },
      {
        knowledgeBaseId: knowledgeBase.id,
        title: 'Insurance',
        type: 'FAQ',
        status: 'INDEXED',
        question: 'Do you accept insurance?',
        answer: 'Yes, we accept most major insurance plans. Please bring your insurance card to your appointment.',
        content:
          'Q: Do you accept insurance?\nA: Yes, we accept most major insurance plans. Please bring your insurance card to your appointment.',
        category: 'Billing',
      },
    ],
    skipDuplicates: true,
  });

  const services = await Promise.all([
    prisma.service.upsert({
      where: { id: '00000000-0000-0000-0000-000000000010' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000010',
        businessId: business.id,
        name: 'General Consultation',
        description: '30-minute general health consultation',
        duration: 30,
        price: 75.0,
      },
    }),
    prisma.service.upsert({
      where: { id: '00000000-0000-0000-0000-000000000011' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000011',
        businessId: business.id,
        name: 'Follow-up Visit',
        description: '15-minute follow-up appointment',
        duration: 15,
        price: 45.0,
      },
    }),
  ]);

  const tags = await Promise.all([
    prisma.customerTag.upsert({
      where: { businessId_name: { businessId: business.id, name: 'VIP' } },
      update: {},
      create: { businessId: business.id, name: 'VIP', color: '#651147' },
    }),
    prisma.customerTag.upsert({
      where: { businessId_name: { businessId: business.id, name: 'New Lead' } },
      update: {},
      create: { businessId: business.id, name: 'New Lead', color: '#2563eb' },
    }),
  ]);

  const customers = await Promise.all([
    prisma.customer.upsert({
      where: { businessId_phone: { businessId: business.id, phone: '15559876543' } },
      update: {},
      create: {
        businessId: business.id,
        name: 'Jane Smith',
        phone: '15559876543',
        email: 'jane.smith@example.com',
        source: 'whatsapp',
        leadScore: 80,
      },
    }),
    prisma.customer.upsert({
      where: { businessId_phone: { businessId: business.id, phone: '15558765432' } },
      update: {},
      create: {
        businessId: business.id,
        name: 'John Doe',
        phone: '15558765432',
        email: 'john.doe@example.com',
        source: 'referral',
        leadScore: 60,
      },
    }),
  ]);

  await prisma.customerTagAssignment.upsert({
    where: { customerId_tagId: { customerId: customers[0].id, tagId: tags[0].id } },
    update: {},
    create: { customerId: customers[0].id, tagId: tags[0].id },
  });

  await prisma.customerNote.createMany({
    data: [
      {
        customerId: customers[0].id,
        content: 'Prefers morning appointments. Has insurance with BlueCross.',
        createdBy: user.id,
      },
    ],
    skipDuplicates: true,
  });

  const whatsappAccount = await prisma.whatsAppAccount.upsert({
    where: { phoneNumberId: 'demo-phone-number-id' },
    update: {},
    create: {
      businessId: business.id,
      phoneNumberId: 'demo-phone-number-id',
      phoneNumber: '+15551234567',
      displayName: 'Demo Wellness Clinic',
      webhookVerified: true,
      isActive: true,
    },
  });

  const conversation = await prisma.conversation.upsert({
    where: { id: '00000000-0000-0000-0000-000000000020' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000020',
      businessId: business.id,
      customerId: customers[0].id,
      whatsappAccountId: whatsappAccount.id,
      status: 'OPEN',
      isAiEnabled: true,
      lastMessageAt: new Date(),
    },
  });

  await prisma.message.createMany({
    data: [
      {
        conversationId: conversation.id,
        direction: 'INBOUND',
        content: 'Hi, I would like to book an appointment for next week.',
        type: 'TEXT',
        status: 'DELIVERED',
      },
      {
        conversationId: conversation.id,
        direction: 'OUTBOUND',
        content:
          'Hello Jane! I would be happy to help you book an appointment. What day works best for you?',
        type: 'TEXT',
        status: 'SENT',
        isAiGenerated: true,
      },
    ],
    skipDuplicates: true,
  });

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);

  const tomorrowEnd = new Date(tomorrow);
  tomorrowEnd.setMinutes(tomorrowEnd.getMinutes() + 30);

  await prisma.appointment.upsert({
    where: { id: '00000000-0000-0000-0000-000000000030' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000030',
      businessId: business.id,
      customerId: customers[0].id,
      serviceId: services[0].id,
      title: 'General Consultation - Jane Smith',
      startTime: tomorrow,
      endTime: tomorrowEnd,
      status: 'CONFIRMED',
    },
  });

  console.log('Seed completed successfully');
  console.log('');
  console.log('Demo credentials:');
  console.log('  Email:    demo@smartreception.ai');
  console.log('  Password: Demo1234!');
  console.log('  Business: Demo Wellness Clinic (demo-clinic)');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
