/**
 * Dedicated Vercel serverless entry for WhatsApp webhooks.
 * Isolated from api/index.js so Meta traffic does not share Prisma pool
 * slots with dashboard/auth API requests.
 */
const { createApp } = require('../apps/backend/dist/app');

module.exports = createApp();
