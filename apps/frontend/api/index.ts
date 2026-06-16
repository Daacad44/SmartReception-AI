import { createApp } from '../../backend/src/app';
import { connectDatabase } from '../../backend/src/infrastructure/database/prisma';

const app = createApp();

connectDatabase().catch((err) => {
  console.error('Database connection failed:', err);
});

export default app;
