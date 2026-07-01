import { config } from '../../config';
import { r2StorageService, isR2Configured } from './r2.service';
import { supabaseStorageService, isSupabaseStorageConfigured } from './supabase-storage.service';
import { ServiceUnavailableError } from '../../core/errors';

export interface StorageUploadResult {
  key: string;
  url: string;
}

// Content-type is derived from the filename extension rather than trusting
// the client-supplied multipart Content-Type — otherwise an upload named
// "logo.png" with a spoofed "text/html" part would be stored and later
// served back with that same header, letting a browser render it as HTML.
const SAFE_CONTENT_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.csv': 'text/csv',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.markdown': 'text/markdown',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

function resolveSafeContentType(filename: string): string {
  const ext = filename.toLowerCase().match(/\.[^.]+$/)?.[0] ?? '';
  return SAFE_CONTENT_TYPES[ext] ?? 'application/octet-stream';
}

export interface IStorageService {
  upload(
    file: Buffer,
    filename: string,
    mimeType: string,
    folder?: string
  ): Promise<StorageUploadResult>;
  delete(keyOrUrl: string): Promise<void>;
  download(keyOrUrl: string): Promise<Buffer>;
}

class UnifiedStorageService implements IStorageService {
  private get provider(): IStorageService {
    if (isSupabaseStorageConfigured()) {
      return supabaseStorageService;
    }
    if (isR2Configured()) {
      return r2StorageService;
    }
    throw new ServiceUnavailableError(
      'File storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel environment variables.'
    );
  }

  upload(file: Buffer, filename: string, _mimeType: string, folder?: string) {
    return this.provider.upload(file, filename, resolveSafeContentType(filename), folder);
  }

  delete(keyOrUrl: string) {
    return this.provider.delete(keyOrUrl);
  }

  download(keyOrUrl: string) {
    const provider = this.provider as IStorageService & { download?: (k: string) => Promise<Buffer> };
    if (provider.download) {
      return provider.download(keyOrUrl);
    }
    throw new ServiceUnavailableError('Storage download is not supported by the configured provider');
  }
}

export const storageService = new UnifiedStorageService();
export { isSupabaseStorageConfigured, isR2Configured };
