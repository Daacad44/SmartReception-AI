import { config } from '../../config';
import { r2StorageService, isR2Configured } from './r2.service';
import { supabaseStorageService, isSupabaseStorageConfigured } from './supabase-storage.service';

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
}

class UnifiedStorageService implements IStorageService {
  private get provider(): IStorageService {
    if (isSupabaseStorageConfigured()) {
      return supabaseStorageService;
    }
    if (isR2Configured()) {
      return r2StorageService;
    }
    throw new Error(
      'No storage provider configured. Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY or R2 credentials.'
    );
  }

  upload(file: Buffer, filename: string, mimeType: string, folder?: string) {
    return this.provider.upload(file, filename, mimeType, folder);
  }

  delete(keyOrUrl: string) {
    return this.provider.delete(keyOrUrl);
  }
}

export const storageService = new UnifiedStorageService();
export { isSupabaseStorageConfigured, isR2Configured };
