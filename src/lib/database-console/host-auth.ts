import { createHmac, timingSafeEqual } from 'node:crypto';
import { buildDbGateConsoleSlug } from '@/lib/database-console/dbgate';

export const DBGATE_CONSOLE_COOKIE_NAME = 'juanie_dbgate_console';

export interface DbGateConsoleTokenPayload {
  kind: 'dbgate-console';
  projectId: string;
  environmentId: string;
  databaseId: string;
  databaseSlug: string;
  actorEmail: string | null;
  actorName: string | null;
  expiresAt: string;
}

function getTokenSecret(): string {
  const secret = process.env.DATABASE_CONSOLE_TOKEN_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret?.trim()) {
    throw new Error('Missing database console token secret');
  }

  return secret;
}

function encodePayload(payload: DbGateConsoleTokenPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function signPayload(encodedPayload: string): string {
  return createHmac('sha256', getTokenSecret()).update(encodedPayload).digest('base64url');
}

function signaturesMatch(providedSignature: string, expectedSignature: string): boolean {
  const provided = Buffer.from(providedSignature);
  const expected = Buffer.from(expectedSignature);

  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export function createDbGateConsoleToken(input: {
  projectId: string;
  environmentId: string;
  databaseId: string;
  databaseSlug: string;
  actorEmail: string | null;
  actorName: string | null;
  expiresAt: Date;
}): string {
  const payload: DbGateConsoleTokenPayload = {
    kind: 'dbgate-console',
    projectId: input.projectId,
    environmentId: input.environmentId,
    databaseId: input.databaseId,
    databaseSlug: input.databaseSlug,
    actorEmail: input.actorEmail,
    actorName: input.actorName,
    expiresAt: input.expiresAt.toISOString(),
  };
  const encodedPayload = encodePayload(payload);

  return `${encodedPayload}.${signPayload(encodedPayload)}`;
}

export function verifyDbGateConsoleToken(input: {
  token: string | null | undefined;
  databaseSlug: string;
  now?: Date;
}): DbGateConsoleTokenPayload | null {
  if (!input.token) {
    return null;
  }

  const [encodedPayload, providedSignature] = input.token.split('.');
  if (!encodedPayload || !providedSignature) {
    return null;
  }

  if (!signaturesMatch(providedSignature, signPayload(encodedPayload))) {
    return null;
  }

  let payload: DbGateConsoleTokenPayload;
  try {
    payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8')
    ) as DbGateConsoleTokenPayload;
  } catch {
    return null;
  }

  const expiresAt = new Date(payload.expiresAt);
  if (
    payload.kind !== 'dbgate-console' ||
    payload.databaseSlug !== input.databaseSlug ||
    payload.databaseSlug !== buildDbGateConsoleSlug(payload.databaseId) ||
    Number.isNaN(expiresAt.getTime()) ||
    expiresAt.getTime() <= (input.now ?? new Date()).getTime()
  ) {
    return null;
  }

  return payload;
}
