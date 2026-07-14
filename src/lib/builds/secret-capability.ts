import { createHmac, timingSafeEqual } from 'node:crypto';

const capabilityVersion = 1 as const;
const capabilityLifetimeSeconds = 6 * 60 * 60;
const signatureDomain = 'juanie-build-secret-v1';

interface BuildSecretCapabilityPayload {
  version: typeof capabilityVersion;
  buildRunId: string;
  expiresAt: number;
}

function getCapabilitySecret(): string {
  const secret = process.env.BUILD_SECRET_CAPABILITY_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('BUILD_SECRET_CAPABILITY_SECRET or NEXTAUTH_SECRET is required');
  }
  return secret;
}

function signPayload(encodedPayload: string): Buffer {
  return createHmac('sha256', getCapabilitySecret())
    .update(`${signatureDomain}.${encodedPayload}`)
    .digest();
}

export function issueBuildSecretCapability(buildRunId: string, now = Date.now()): string {
  const payload: BuildSecretCapabilityPayload = {
    version: capabilityVersion,
    buildRunId,
    expiresAt: Math.floor(now / 1000) + capabilityLifetimeSeconds,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${encodedPayload}.${signPayload(encodedPayload).toString('base64url')}`;
}

export function verifyBuildSecretCapability(input: {
  token: string;
  buildRunId: string;
  now?: number;
}): boolean {
  const [encodedPayload, encodedSignature, extra] = input.token.split('.');
  if (!encodedPayload || !encodedSignature || extra) return false;

  let providedSignature: Buffer;
  let payload: BuildSecretCapabilityPayload;
  try {
    providedSignature = Buffer.from(encodedSignature, 'base64url');
    payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8')
    ) as BuildSecretCapabilityPayload;
  } catch {
    return false;
  }
  const expectedSignature = signPayload(encodedPayload);
  if (
    providedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(providedSignature, expectedSignature)
  ) {
    return false;
  }

  const nowSeconds = Math.floor((input.now ?? Date.now()) / 1000);
  return (
    payload.version === capabilityVersion &&
    payload.buildRunId === input.buildRunId &&
    Number.isSafeInteger(payload.expiresAt) &&
    payload.expiresAt >= nowSeconds
  );
}
