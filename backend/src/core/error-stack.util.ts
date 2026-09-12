const SKIP_FRAME = /node_modules|node:internal|node:events/;

function normalizeFile(file: string): string {
  return file.replace(/\\/g, '/').replace(/^file:\/\//, '');
}

function toRelativeAppPath(file: string): string {
  const srcIdx = file.lastIndexOf('/src/');
  if (srcIdx >= 0) return file.slice(srcIdx + 1);
  const distIdx = file.lastIndexOf('/dist/');
  if (distIdx >= 0) return file.slice(distIdx + 1);
  const parts = file.split('/');
  return parts.slice(Math.max(0, parts.length - 3)).join('/');
}

function parseFrame(line: string): { file: string; line: string; column: string } | undefined {
  const paren = line.match(/\((?:file:\/\/)?(.+):(\d+):(\d+)\)/);
  const bare = paren ? null : line.match(/at (?:file:\/\/)?(.+):(\d+):(\d+)/);
  const match = paren ?? bare;
  if (!match) return undefined;
  return { file: normalizeFile(match[1]), line: match[2], column: match[3] };
}

function isHandlerFrame(file: string): boolean {
  return /core\/error-handler\.(ts|js)$/.test(file);
}

/**
 * First application frame (file:line:column), skipping Express / node_modules.
 * Prefers the throw site over the error middleware itself.
 */
export function extractAppFrame(stack?: string): string | undefined {
  if (!stack) return undefined;

  const appFrames: { file: string; location: string }[] = [];
  for (const line of stack.split('\n')) {
    if (SKIP_FRAME.test(line)) continue;
    const frame = parseFrame(line);
    if (!frame || frame.file.startsWith('node:')) continue;
    const relative = toRelativeAppPath(frame.file);
    appFrames.push({
      file: relative,
      location: `${relative}:${frame.line}:${frame.column}`,
    });
  }

  const throwSite = appFrames.find((frame) => !isHandlerFrame(frame.file));
  return throwSite?.location ?? appFrames[0]?.location;
}
