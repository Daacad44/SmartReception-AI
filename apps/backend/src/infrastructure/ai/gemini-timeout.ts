import { config } from '../../config';

export async function withAiTimeout<T>(
  promise: Promise<T>,
  fallback: T,
  label = 'AI'
): Promise<T> {
  const timeoutMs = config.aiReply.timeoutMs;

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => {
          console.warn(`[AI] ${label} timed out after ${timeoutMs}ms`);
          resolve(fallback);
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
