/**
 * Vercel serverless entry — loads pre-compiled backend from dist/
 * Prisma connects lazily on first query; avoid eager $connect() to prevent
 * holding a pool slot during idle warm invocations.
 */
const { createApp } = require('../backend/dist/app');
const { logWhatsAppConfig } = require('../backend/dist/config');

const app = createApp();

logWhatsAppConfig();

module.exports = app;
