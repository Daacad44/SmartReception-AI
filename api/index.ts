import { createApp } from '../apps/backend/src/app';
import { connectDatabase } from '../apps/backend/src/infrastructure/database/prisma';

const app = createApp();

connectDatabase().catch((err) => {
  console.error('Database connection failed:', err);
});

export default app;
