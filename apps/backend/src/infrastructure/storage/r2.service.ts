import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../../config';
import { v4 as uuid } from 'uuid';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${config.r2.accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: config.r2.accessKeyId,
    secretAccessKey: config.r2.secretAccessKey,
  },
});

export class StorageService {
  async upload(
    file: Buffer,
    filename: string,
    mimeType: string,
    folder = 'uploads'
  ): Promise<{ key: string; url: string }> {
    const key = `${folder}/${uuid()}-${filename}`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: config.r2.bucketName,
        Key: key,
        Body: file,
        ContentType: mimeType,
      })
    );

    const url = config.r2.publicUrl
      ? `${config.r2.publicUrl}/${key}`
      : key;

    return { key, url };
  }

  async delete(key: string): Promise<void> {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: config.r2.bucketName,
        Key: key,
      })
    );
  }

  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: config.r2.bucketName,
      Key: key,
    });
    return getSignedUrl(s3Client, command, { expiresIn });
  }
}

export const storageService = new StorageService();
