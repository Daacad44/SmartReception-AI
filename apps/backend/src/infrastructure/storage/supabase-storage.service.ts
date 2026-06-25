import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuid } from 'uuid';
import { config } from '../../config';
import { logger } from '../../core/logger';

const BUCKET = 'knowledge-documents';

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

export class SupabaseStorageService {
  async ensureBucket(): Promise<void> {
    const supabase = getClient();
    const { data: buckets } = await supabase.storage.listBuckets();
    const exists = buckets?.some((b) => b.name === BUCKET);
    if (!exists) {
      const { error } = await supabase.storage.createBucket(BUCKET, {
        public: false,
        fileSizeLimit: 10 * 1024 * 1024,
        allowedMimeTypes: [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/msword',
          'text/plain',
        ],
      });
      if (error && !error.message.includes('already exists')) {
        logger.warn('Could not create storage bucket:', error.message);
      }
    }
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

    const { error } = await supabase.storage.from(BUCKET).upload(key, file, {
      contentType: mimeType,
      upsert: false,
    });

    if (error) {
      throw new Error(`Storage upload failed: ${error.message}`);
    }

    const { data: signed } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(key, 60 * 60 * 24 * 365);

    return {
      key,
      url: signed?.signedUrl ?? `supabase://${BUCKET}/${key}`,
    };
  }

  async delete(keyOrUrl: string): Promise<void> {
    const supabase = getClient();
    const key = this.resolveKey(keyOrUrl);
    const { error } = await supabase.storage.from(BUCKET).remove([key]);
    if (error) {
      throw new Error(`Storage delete failed: ${error.message}`);
    }
  }

  async download(keyOrUrl: string): Promise<Buffer> {
    const supabase = getClient();
    const key = this.resolveKey(keyOrUrl);
    const { data, error } = await supabase.storage.from(BUCKET).download(key);
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

export const supabaseStorageService = new SupabaseStorageService();
