/**
 * Vercel serverless entry — loads pre-compiled backend from dist/
 * Prisma connects lazily on first query; avoid eager $connect() to prevent
 * holding a pool slot during idle warm invocations.
 */
const { createApp } = require('../apps/backend/dist/app');
const { logWhatsAppConfig } = require('../apps/backend/dist/config');

const app = createApp();

logWhatsAppConfig();

module.exports = app;
