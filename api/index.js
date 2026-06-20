/**
 * Vercel serverless entry — loads pre-compiled backend from dist/
 */
const { createApp } = require('../apps/backend/dist/app');
const { connectDatabase } = require('../apps/backend/dist/infrastructure/database/prisma');
const { logWhatsAppConfig } = require('../apps/backend/dist/config');

const app = createApp();

logWhatsAppConfig();

connectDatabase().catch((err) => {
  console.error('Database connection failed:', err);
});

module.exports = app;
