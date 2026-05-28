import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface ArtifactStorageReference {
  uri: string;
  filename?: string | null;
}

export interface SignedArtifactDownload {
  url: string;
  expiresInSeconds: number;
}

export interface SignedArtifactUpload {
  uploadUrl: string;
  uri: string;
  expiresInSeconds: number;
}

interface S3ArtifactLocation {
  bucket: string;
  key: string;
}

const defaultSignedUrlTtlSeconds = 5 * 60;
const defaultUploadTtlSeconds = 10 * 60;

function getArtifactStorageEndpoint() {
  return process.env.ARTIFACT_STORAGE_ENDPOINT || process.env.S3_ENDPOINT || undefined;
}

function getArtifactStorageRegion() {
  return process.env.ARTIFACT_STORAGE_REGION || process.env.AWS_REGION || 'auto';
}

function getArtifactStorageCredentials() {
  const accessKeyId = process.env.ARTIFACT_STORAGE_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey =
    process.env.ARTIFACT_STORAGE_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;

  if (!accessKeyId || !secretAccessKey) {
    return undefined;
  }

  return {
    accessKeyId,
    secretAccessKey,
  };
}

function getSignedUrlTtlSeconds() {
  const value = Number(process.env.ARTIFACT_DOWNLOAD_TTL_SECONDS);
  if (!Number.isFinite(value) || value <= 0) {
    return defaultSignedUrlTtlSeconds;
  }

  return Math.min(Math.floor(value), 60 * 60);
}

function getUploadTtlSeconds() {
  const value = Number(process.env.ARTIFACT_UPLOAD_TTL_SECONDS);
  if (!Number.isFinite(value) || value <= 0) {
    return defaultUploadTtlSeconds;
  }

  return Math.min(Math.floor(value), 60 * 60);
}

function getArtifactStorageBucket() {
  return process.env.ARTIFACT_STORAGE_BUCKET || process.env.S3_BUCKET || '';
}

function parseS3Uri(uri: string): S3ArtifactLocation | null {
  if (!uri.startsWith('s3://')) {
    return null;
  }

  const parsed = new URL(uri);
  const bucket = parsed.hostname;
  const key = parsed.pathname.replace(/^\/+/, '');

  if (!bucket || !key) {
    return null;
  }

  return { bucket, key };
}

function normalizeS3KeyPart(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9_.=-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180);
}

function createS3Client() {
  const endpoint = getArtifactStorageEndpoint();

  return new S3Client({
    region: getArtifactStorageRegion(),
    endpoint,
    forcePathStyle: process.env.ARTIFACT_STORAGE_FORCE_PATH_STYLE === 'true',
    credentials: getArtifactStorageCredentials(),
  });
}

export function isManagedArtifactReference(uri: string | null | undefined): uri is string {
  return Boolean(uri?.startsWith('s3://'));
}

export async function createSignedArtifactDownload(
  reference: ArtifactStorageReference
): Promise<SignedArtifactDownload> {
  const location = parseS3Uri(reference.uri);

  if (!location) {
    throw new Error('Artifact is not stored in managed object storage');
  }

  const expiresInSeconds = getSignedUrlTtlSeconds();
  const command = new GetObjectCommand({
    Bucket: location.bucket,
    Key: location.key,
    ...(reference.filename
      ? {
          ResponseContentDisposition: `attachment; filename="${reference.filename.replace(/"/g, '')}"`,
        }
      : {}),
  });

  return {
    url: await getSignedUrl(createS3Client(), command, { expiresIn: expiresInSeconds }),
    expiresInSeconds,
  };
}

export async function createSignedArtifactUpload(input: {
  projectId: string;
  releaseId: string;
  name: string;
  variant?: string | null;
  platform?: string | null;
  format?: string | null;
  contentType?: string | null;
}): Promise<SignedArtifactUpload> {
  const bucket = getArtifactStorageBucket();
  if (!bucket) {
    throw new Error('ARTIFACT_STORAGE_BUCKET is required for managed delivery artifacts');
  }

  const expiresInSeconds = getUploadTtlSeconds();
  const safeName = normalizeS3KeyPart(input.name) || 'artifact';
  const safeVariant = normalizeS3KeyPart(input.variant ?? 'default') || 'default';
  const safePlatform = normalizeS3KeyPart(input.platform ?? 'any') || 'any';
  const safeFormat = normalizeS3KeyPart(input.format ?? 'tgz') || 'tgz';
  const extension = safeFormat === 'tar.gz' ? 'tar.gz' : safeFormat;
  const key = [
    'releases',
    input.projectId,
    input.releaseId,
    `${safeName}-${safeVariant}-${safePlatform}.${extension}`,
  ].join('/');

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: input.contentType ?? 'application/octet-stream',
  });

  return {
    uploadUrl: await getSignedUrl(createS3Client(), command, { expiresIn: expiresInSeconds }),
    uri: `s3://${bucket}/${key}`,
    expiresInSeconds,
  };
}
