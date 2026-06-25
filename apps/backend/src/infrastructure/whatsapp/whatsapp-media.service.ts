import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuid } from 'uuid';
import { config } from '../../config';
import { logger } from '../../core/logger';

const BUCKET = 'whatsapp-media';

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!client) {
    if (!config.supabase.url || !config.supabase.serviceRoleKey) {
      throw new Error('Supabase Storage is not configured for WhatsApp media');
    }
    client = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export class WhatsAppMediaService {
  async ensureBucket(): Promise<void> {
    const supabase = getClient();
    const { data: buckets } = await supabase.storage.listBuckets();
    if (!buckets?.some((b) => b.name === BUCKET)) {
      const { error } = await supabase.storage.createBucket(BUCKET, {
        public: false,
        fileSizeLimit: 16 * 1024 * 1024,
      });
      if (error && !error.message.includes('already exists')) {
        logger.warn('Could not create whatsapp-media bucket:', error.message);
      }
    }
  }

  async downloadFromMeta(mediaId: string, accessToken: string): Promise<{
    buffer: Buffer;
    mimeType: string;
  }> {
    const metaRes = await fetch(`${config.whatsapp.apiUrl}/${mediaId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!metaRes.ok) {
      throw new Error(`Failed to fetch media metadata: ${metaRes.status}`);
    }
    const meta = (await metaRes.json()) as { url: string; mime_type?: string };
    const fileRes = await fetch(meta.url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!fileRes.ok) {
      throw new Error(`Failed to download media file: ${fileRes.status}`);
    }
    const buffer = Buffer.from(await fileRes.arrayBuffer());
    return {
      buffer,
      mimeType: meta.mime_type ?? fileRes.headers.get('content-type') ?? 'application/octet-stream',
    };
  }

  async storeInboundMedia(
    buffer: Buffer,
    mimeType: string,
    businessId: string,
    conversationId: string,
    filename?: string
  ): Promise<{ url: string; key: string; fileSize: number }> {
    await this.ensureBucket();
    const supabase = getClient();
    const ext = mimeType.split('/')[1]?.split(';')[0] ?? 'bin';
    const key = `${businessId}/${conversationId}/${uuid()}.${ext}`;

    const { error } = await supabase.storage.from(BUCKET).upload(key, buffer, {
      contentType: mimeType,
      upsert: false,
    });
    if (error) {
      throw new Error(`WhatsApp media upload failed: ${error.message}`);
    }

    const { data: signed } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(key, 60 * 60 * 24 * 7);

    return {
      key,
      url: signed?.signedUrl ?? `supabase://${BUCKET}/${key}`,
      fileSize: buffer.length,
    };
  }
}

export const whatsappMediaService = new WhatsAppMediaService();
