/**
 * Vercel serverless entry — CommonJS (api/package.json overrides parent ESM).
 */
const path = require('path');

const bundleDir = path.join(__dirname, '_bundle');
const { createApp } = require(path.join(bundleDir, 'dist/app'));
const { connectDatabase } = require(path.join(bundleDir, 'dist/infrastructure/database/prisma'));

const app = createApp();

connectDatabase().catch((err) => {
  console.error('Database connection failed:', err);
});

module.exports = app;
