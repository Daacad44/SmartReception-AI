import { config } from '../../config';
import { r2StorageService, isR2Configured } from './r2.service';
import { supabaseStorageService, isSupabaseStorageConfigured } from './supabase-storage.service';
import { ServiceUnavailableError } from '../../core/errors';

export interface StorageUploadResult {
  key: string;
  url: string;
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

  upload(file: Buffer, filename: string, mimeType: string, folder?: string) {
    return this.provider.upload(file, filename, mimeType, folder);
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
