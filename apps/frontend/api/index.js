/**
 * Vercel serverless entry — CommonJS (api/package.json overrides parent ESM).
 * Prisma connects lazily on first query.
 */
const path = require('path');

const bundleDir = path.join(__dirname, '_bundle');
const { createApp } = require(path.join(bundleDir, 'dist/app'));

const app = createApp();

module.exports = app;
