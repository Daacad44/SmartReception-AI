import {
  r2StorageService,
  createR2StorageService,
  isR2Configured,
} from './r2.service';
import {
  supabaseStorageService,
  createSupabaseStorageService,
  isSupabaseStorageConfigured,
} from './supabase-storage.service';
import { config } from '../../config';
import { ServiceUnavailableError } from '../../core/errors';

const SEVEN_DAYS_SECONDS = 60 * 60 * 24 * 7;

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

function looksLikeSupabaseUrl(keyOrUrl: string): boolean {
  return (
    keyOrUrl.startsWith('supabase://') ||
    (keyOrUrl.startsWith('http') && keyOrUrl.includes('/storage/v1/object/'))
  );
}

/**
 * Bucket-scoped unified provider.
 *
 * Post-migration wiring (planToNode.md §4 step 2):
 *   - **Writes go to R2 when configured** (falls back to Supabase only if R2
 *     isn't set up, so a partially-migrated deployment still works).
 *   - **Reads and deletes route by URL scheme.** A `supabase://…` URL or a
 *     Supabase `/storage/v1/object/…` URL routes back to Supabase so existing
 *     objects stay accessible during the backfill window; everything else
 *     goes to R2. Once every legacy URL has been backfilled, `SUPABASE_URL`
 *     and `SUPABASE_SERVICE_ROLE_KEY` can be dropped from backend env.
 */
class UnifiedStorageService implements IStorageService {
  constructor(
    private readonly r2Provider: IStorageService,
    private readonly supabaseProvider: IStorageService
  ) {}

  private get writeProvider(): IStorageService {
    if (isR2Configured()) return this.r2Provider;
    if (isSupabaseStorageConfigured()) return this.supabaseProvider;
    throw new ServiceUnavailableError(
      'File storage is not configured. Set R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY (preferred), or SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY as a legacy fallback.'
    );
  }

  private readProvider(keyOrUrl: string): IStorageService {
    if (looksLikeSupabaseUrl(keyOrUrl) && isSupabaseStorageConfigured()) {
      return this.supabaseProvider;
    }
    return this.writeProvider;
  }

  upload(file: Buffer, filename: string, mimeType: string, folder?: string) {
    return this.writeProvider.upload(file, filename, mimeType, folder);
  }

  delete(keyOrUrl: string) {
    return this.readProvider(keyOrUrl).delete(keyOrUrl);
  }

  download(keyOrUrl: string) {
    return this.readProvider(keyOrUrl).download(keyOrUrl);
  }
}

/** Knowledge-documents bucket (PDFs / DOCX uploads, 1-year signed URLs). */
export const storageService: IStorageService = new UnifiedStorageService(
  r2StorageService,
  supabaseStorageService
);

/** WhatsApp media bucket (inbound images/audio/video/documents, 7-day URLs). */
export const whatsappMediaStorage: IStorageService = new UnifiedStorageService(
  createR2StorageService({
    bucket: config.r2.whatsappMediaBucket,
    signedUrlTtl: SEVEN_DAYS_SECONDS,
  }),
  createSupabaseStorageService({
    bucket: 'whatsapp-media',
    signedUrlTtl: SEVEN_DAYS_SECONDS,
    fileSizeLimit: 16 * 1024 * 1024,
  })
);

export { isSupabaseStorageConfigured, isR2Configured };
