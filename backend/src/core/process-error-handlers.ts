import { logger } from './logger';
import { extractAppFrame } from './error-stack.util';

let registered = false;

function asError(reason: unknown): Error {
  return reason instanceof Error ? reason : new Error(String(reason));
}

export function registerProcessErrorHandlers(): void {
  if (registered) return;
  registered = true;

  process.on('unhandledRejection', (reason) => {
    const err = asError(reason);
    logger.error(`Unhandled promise rejection: ${err.message}`, {
      name: err.name,
      stack: err.stack,
      at: extractAppFrame(err.stack),
    });
  });

  process.on('uncaughtException', (err) => {
    logger.error(`Uncaught exception: ${err.message}`, {
      name: err.name,
      stack: err.stack,
      at: extractAppFrame(err.stack),
    });
    process.exit(1);
  });
}
