/**
 * Vercel serverless entry — loads pre-compiled backend from dist/
 * to avoid Vercel re-typechecking the entire backend source tree.
 */
const { createApp } = require('../../backend/dist/app');
const { connectDatabase } = require('../../backend/dist/infrastructure/database/prisma');

const app = createApp();

connectDatabase().catch((err) => {
  console.error('Database connection failed:', err);
});

module.exports = app;
