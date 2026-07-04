import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuid } from 'uuid';
import { config } from '../../config';
import { logger } from '../../core/logger';

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

const KNOWLEDGE_MIME_ALLOWLIST = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
];

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!client) {
    if (!config.supabase.url || !config.supabase.serviceRoleKey) {
      throw new Error('Supabase Storage is not configured');
    }
    client = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export function isSupabaseStorageConfigured(): boolean {
  return Boolean(config.supabase.url && config.supabase.serviceRoleKey);
}

export interface SupabaseBucketOptions {
  bucket: string;
  signedUrlTtl?: number;
  fileSizeLimit?: number;
  allowedMimeTypes?: string[];
}

export class SupabaseStorageService {
  private readonly bucket: string;
  private readonly signedUrlTtl: number;
  private readonly fileSizeLimit: number;
  private readonly allowedMimeTypes?: string[];
  private ensured = false;

  constructor(options: SupabaseBucketOptions) {
    this.bucket = options.bucket;
    this.signedUrlTtl = options.signedUrlTtl ?? ONE_YEAR_SECONDS;
    this.fileSizeLimit = options.fileSizeLimit ?? 10 * 1024 * 1024;
    this.allowedMimeTypes = options.allowedMimeTypes;
  }

  async ensureBucket(): Promise<void> {
    if (this.ensured) return;
    const supabase = getClient();
    const { data: buckets } = await supabase.storage.listBuckets();
    const exists = buckets?.some((b) => b.name === this.bucket);
    if (!exists) {
      const { error } = await supabase.storage.createBucket(this.bucket, {
        public: false,
        fileSizeLimit: this.fileSizeLimit,
        allowedMimeTypes: this.allowedMimeTypes,
      });
      if (error && !error.message.includes('already exists')) {
        logger.warn(`Could not create storage bucket ${this.bucket}:`, error.message);
      }
    }
    this.ensured = true;
  }

  async upload(
    file: Buffer,
    filename: string,
    mimeType: string,
    folder = 'uploads'
  ): Promise<{ key: string; url: string }> {
    await this.ensureBucket();
    const supabase = getClient();
    const key = `${folder}/${uuid()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    const { error } = await supabase.storage.from(this.bucket).upload(key, file, {
      contentType: mimeType,
      upsert: false,
    });

    if (error) {
      throw new Error(`Storage upload failed: ${error.message}`);
    }

    const { data: signed } = await supabase.storage
      .from(this.bucket)
      .createSignedUrl(key, this.signedUrlTtl);

    return {
      key,
      url: signed?.signedUrl ?? `supabase://${this.bucket}/${key}`,
    };
  }

  async delete(keyOrUrl: string): Promise<void> {
    const supabase = getClient();
    const key = this.resolveKey(keyOrUrl);
    const { error } = await supabase.storage.from(this.bucket).remove([key]);
    if (error) {
      throw new Error(`Storage delete failed: ${error.message}`);
    }
  }

  async download(keyOrUrl: string): Promise<Buffer> {
    const supabase = getClient();
    const key = this.resolveKey(keyOrUrl);
    const { data, error } = await supabase.storage.from(this.bucket).download(key);
    if (error || !data) {
      throw new Error(`Storage download failed: ${error?.message ?? 'No data'}`);
    }
    return Buffer.from(await data.arrayBuffer());
  }

  private resolveKey(keyOrUrl: string): string {
    if (keyOrUrl.startsWith('supabase://')) {
      const parts = keyOrUrl.replace('supabase://', '').split('/');
      return parts.slice(1).join('/');
    }
    if (keyOrUrl.startsWith('http')) {
      try {
        const url = new URL(keyOrUrl);
        const match = url.pathname.match(/\/object\/sign\/[^/]+\/(.+)/);
        if (match) return decodeURIComponent(match[1]);
        const publicMatch = url.pathname.match(/\/object\/public\/[^/]+\/(.+)/);
        if (publicMatch) return decodeURIComponent(publicMatch[1]);
      } catch {
        // fall through
      }
    }
    return keyOrUrl;
  }
}

/**
 * Default knowledge-documents Supabase service. Kept as an exported singleton
 * for reading legacy `supabase://knowledge-documents/…` URLs during the R2
 * cutover.
 */
export const supabaseStorageService = new SupabaseStorageService({
  bucket: 'knowledge-documents',
  signedUrlTtl: ONE_YEAR_SECONDS,
  fileSizeLimit: 10 * 1024 * 1024,
  allowedMimeTypes: KNOWLEDGE_MIME_ALLOWLIST,
});

export function createSupabaseStorageService(
  options: SupabaseBucketOptions
): SupabaseStorageService {
  return new SupabaseStorageService(options);
}
