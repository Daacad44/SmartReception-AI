import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../../config';
import { v4 as uuid } from 'uuid';

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function isR2Configured(): boolean {
  return Boolean(
    config.r2.accountId && config.r2.accessKeyId && config.r2.secretAccessKey
  );
}

function getS3Client(): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${config.r2.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.r2.accessKeyId,
      secretAccessKey: config.r2.secretAccessKey,
    },
  });
}

export interface R2BucketOptions {
  bucket: string;
  signedUrlTtl?: number;
}

export class R2StorageService {
  private readonly bucket: string;
  private readonly signedUrlTtl: number;

  constructor(options: R2BucketOptions) {
    this.bucket = options.bucket;
    this.signedUrlTtl = options.signedUrlTtl ?? ONE_YEAR_SECONDS;
  }

  async upload(
    file: Buffer,
    filename: string,
    mimeType: string,
    folder = 'uploads'
  ): Promise<{ key: string; url: string }> {
    const key = `${folder}/${uuid()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    await getS3Client().send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file,
        ContentType: mimeType,
      })
    );

    // Private-bucket signed URL is what the frontend will actually hit.
    // A public R2 URL is only used when R2_PUBLIC_URL is set explicitly
    // (which puts objects on a public custom domain).
    const url = config.r2.publicUrl
      ? `${config.r2.publicUrl}/${key}`
      : await this.getSignedUrl(key, this.signedUrlTtl);

    return { key, url };
  }

  async delete(keyOrUrl: string): Promise<void> {
    const key = this.resolveKey(keyOrUrl);
    await getS3Client().send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
    );
  }

  async download(keyOrUrl: string): Promise<Buffer> {
    const key = this.resolveKey(keyOrUrl);
    const response = await getS3Client().send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
    );

    if (!response.Body) {
      throw new Error('Storage download failed: empty response');
    }

    const bytes = await response.Body.transformToByteArray();
    return Buffer.from(bytes);
  }

  async getSignedUrl(key: string, expiresIn = this.signedUrlTtl): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    return getSignedUrl(getS3Client(), command, { expiresIn });
  }

  private resolveKey(keyOrUrl: string): string {
    // Strip our public-URL prefix if configured
    if (config.r2.publicUrl && keyOrUrl.startsWith(config.r2.publicUrl)) {
      return keyOrUrl.slice(config.r2.publicUrl.length + 1);
    }
    // Signed URLs are https://<account>.r2.cloudflarestorage.com/<bucket>/<key>?...
    if (keyOrUrl.startsWith('https://')) {
      try {
        const url = new URL(keyOrUrl);
        const parts = url.pathname.split('/').filter(Boolean);
        // parts: [bucket, ...keySegments]
        if (parts.length > 1) return decodeURIComponent(parts.slice(1).join('/'));
      } catch {
        // fall through to treating as bare key
      }
    }
    return keyOrUrl;
  }
}

/**
 * Default knowledge-documents R2 service (1-year signed URLs).
 * Kept as the exported singleton for backward compatibility with existing
 * callers; new callers should use `createR2StorageService` for other buckets.
 */
export const r2StorageService = new R2StorageService({
  bucket: config.r2.knowledgeBucket || config.r2.bucketName,
  signedUrlTtl: ONE_YEAR_SECONDS,
});

export function createR2StorageService(options: R2BucketOptions): R2StorageService {
  return new R2StorageService(options);
}
