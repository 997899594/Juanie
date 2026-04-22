import { createHmac, timingSafeEqual } from 'node:crypto';

interface MigrationApprovalTokenPayload {
  kind: 'migration-approval';
  action: 'approve';
  teamId: string;
  projectId: string;
  environmentId: string;
  runId: string;
  actorUserId: string;
}

function getApprovalTokenSecret(): string {
  const secret = process.env.AI_APPROVAL_TOKEN_SECRET ?? process.env.NEXTAUTH_SECRET;

  if (!secret || secret.trim().length === 0) {
    throw new Error('Missing AI approval token secret');
  }

  return secret;
}

function encodePayload(payload: MigrationApprovalTokenPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function signPayload(encodedPayload: string): string {
  return createHmac('sha256', getApprovalTokenSecret()).update(encodedPayload).digest('base64url');
}

export function createMigrationApprovalToken(
  payload: Omit<MigrationApprovalTokenPayload, 'kind' | 'action'>
): string {
  const normalizedPayload: MigrationApprovalTokenPayload = {
    kind: 'migration-approval',
    action: 'approve',
    ...payload,
  };
  const encodedPayload = encodePayload(normalizedPayload);
  const signature = signPayload(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export function verifyMigrationApprovalToken(input: {
  token: string;
  teamId: string;
  projectId: string;
  environmentId: string;
  runId: string;
  actorUserId: string;
}): boolean {
  const [encodedPayload, providedSignature] = input.token.split('.');

  if (!encodedPayload || !providedSignature) {
    return false;
  }

  const expectedSignature = signPayload(encodedPayload);
  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  if (!timingSafeEqual(providedBuffer, expectedBuffer)) {
    return false;
  }

  let parsed: MigrationApprovalTokenPayload;
  try {
    parsed = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8')
    ) as MigrationApprovalTokenPayload;
  } catch {
    return false;
  }

  return (
    parsed.kind === 'migration-approval' &&
    parsed.action === 'approve' &&
    parsed.teamId === input.teamId &&
    parsed.projectId === input.projectId &&
    parsed.environmentId === input.environmentId &&
    parsed.runId === input.runId &&
    parsed.actorUserId === input.actorUserId
  );
}
