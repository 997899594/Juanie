import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function positiveInteger(name: string, fallback: number): number {
  const value = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function createClient(): S3Client {
  const accessKeyId = required('ARTIFACT_STORAGE_ACCESS_KEY_ID');
  const secretAccessKey = required('ARTIFACT_STORAGE_SECRET_ACCESS_KEY');
  return new S3Client({
    endpoint: process.env.ARTIFACT_STORAGE_ENDPOINT?.trim() || undefined,
    region: process.env.ARTIFACT_STORAGE_REGION?.trim() || 'auto',
    forcePathStyle: process.env.ARTIFACT_STORAGE_FORCE_PATH_STYLE === 'true',
    credentials: { accessKeyId, secretAccessKey },
  });
}

async function removeExpiredBackups(input: {
  client: S3Client;
  bucket: string;
  prefix: string;
  retentionDays: number;
}): Promise<number> {
  const cutoff = Date.now() - input.retentionDays * 24 * 60 * 60 * 1000;
  let continuationToken: string | undefined;
  let deleted = 0;

  do {
    const page = await input.client.send(
      new ListObjectsV2Command({
        Bucket: input.bucket,
        Prefix: input.prefix,
        ContinuationToken: continuationToken,
      })
    );
    const expired = (page.Contents ?? [])
      .filter(
        (object) => object.Key && object.LastModified && object.LastModified.getTime() < cutoff
      )
      .map((object) => ({ Key: object.Key as string }));
    if (expired.length > 0) {
      await input.client.send(
        new DeleteObjectsCommand({
          Bucket: input.bucket,
          Delete: { Objects: expired, Quiet: true },
        })
      );
      deleted += expired.length;
    }
    continuationToken = page.NextContinuationToken;
  } while (continuationToken);

  return deleted;
}

async function run(): Promise<void> {
  const filePath = required('CONTROL_PLANE_BACKUP_FILE');
  const bucket =
    process.env.CONTROL_PLANE_BACKUP_BUCKET?.trim() || required('ARTIFACT_STORAGE_BUCKET');
  const prefix = (
    process.env.CONTROL_PLANE_BACKUP_PREFIX?.trim() || 'backups/control-plane'
  ).replace(/^\/+|\/+$/gu, '');
  const retentionDays = positiveInteger('CONTROL_PLANE_BACKUP_RETENTION_DAYS', 30);
  const timestamp = new Date().toISOString().replaceAll(':', '-');
  const key = `${prefix}/${timestamp}.dump`;
  const metadata = await stat(filePath);
  if (metadata.size === 0) throw new Error('Control-plane backup file is empty');

  const client = createClient();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: createReadStream(filePath),
      ContentLength: metadata.size,
      ContentType: 'application/vnd.postgresql.custom-dump',
      Metadata: { createdAt: new Date().toISOString(), source: 'juanie-control-plane' },
    })
  );
  const deleted = await removeExpiredBackups({ client, bucket, prefix, retentionDays });
  console.log(JSON.stringify({ backup: `s3://${bucket}/${key}`, bytes: metadata.size, deleted }));
}

await run();
