import { config } from '../../config';
import { whatsappMediaStorage } from '../storage';

/**
 * WhatsApp inbound-media handler.
 *
 * Storage is delegated to `whatsappMediaStorage` (a unified R2-primary /
 * Supabase-fallback provider — see infrastructure/storage/index.ts). This
 * service owns just the WhatsApp-specific bits: fetching the media from
 * Meta's Graph API and shaping the storage key + return value the caller
 * (incoming-message.service) expects.
 */
export class WhatsAppMediaService {
  async downloadFromMeta(
    mediaId: string,
    accessToken: string
  ): Promise<{ buffer: Buffer; mimeType: string }> {
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
      mimeType:
        meta.mime_type ??
        fileRes.headers.get('content-type') ??
        'application/octet-stream',
    };
  }

  async storeInboundMedia(
    buffer: Buffer,
    mimeType: string,
    businessId: string,
    conversationId: string,
    _filename?: string
  ): Promise<{ url: string; key: string; fileSize: number }> {
    const ext = mimeType.split('/')[1]?.split(';')[0] ?? 'bin';
    // Preserve the {businessId}/{conversationId}/<uuid>.<ext> layout the
    // existing DB rows and Supabase migration doc reference.
    const filename = `inbound.${ext}`;
    const folder = `${businessId}/${conversationId}`;
    const { key, url } = await whatsappMediaStorage.upload(
      buffer,
      filename,
      mimeType,
      folder
    );
    return { key, url, fileSize: buffer.length };
  }
}

export const whatsappMediaService = new WhatsAppMediaService();
