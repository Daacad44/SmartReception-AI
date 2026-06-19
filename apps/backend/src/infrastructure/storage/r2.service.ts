import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../../config';
import { v4 as uuid } from 'uuid';

export function isR2Configured(): boolean {
  return Boolean(
    config.r2.accountId &&
      config.r2.accessKeyId &&
      config.r2.secretAccessKey &&
      config.r2.bucketName
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

export class R2StorageService {
  async upload(
    file: Buffer,
    filename: string,
    mimeType: string,
    folder = 'uploads'
  ): Promise<{ key: string; url: string }> {
    const key = `${folder}/${uuid()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    await getS3Client().send(
      new PutObjectCommand({
        Bucket: config.r2.bucketName,
        Key: key,
        Body: file,
        ContentType: mimeType,
      })
    );

    const url = config.r2.publicUrl ? `${config.r2.publicUrl}/${key}` : key;

    return { key, url };
  }

  async delete(keyOrUrl: string): Promise<void> {
    const key = this.resolveKey(keyOrUrl);
    await getS3Client().send(
      new DeleteObjectCommand({
        Bucket: config.r2.bucketName,
        Key: key,
      })
    );
  }

  async download(keyOrUrl: string): Promise<Buffer> {
    const key = this.resolveKey(keyOrUrl);
    const response = await getS3Client().send(
      new GetObjectCommand({
        Bucket: config.r2.bucketName,
        Key: key,
      })
    );

    if (!response.Body) {
      throw new Error('Storage download failed: empty response');
    }

    const bytes = await response.Body.transformToByteArray();
    return Buffer.from(bytes);
  }

  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: config.r2.bucketName,
      Key: key,
    });
    return getSignedUrl(getS3Client(), command, { expiresIn });
  }

  private resolveKey(keyOrUrl: string): string {
    if (config.r2.publicUrl && keyOrUrl.startsWith(config.r2.publicUrl)) {
      return keyOrUrl.slice(config.r2.publicUrl.length + 1);
    }
    return keyOrUrl;
  }
}

export const r2StorageService = new R2StorageService();
