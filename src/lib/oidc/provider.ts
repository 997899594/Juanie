import {
  createHmac,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  randomUUID,
  sign,
} from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';

export interface OidcUserClaims {
  sub: string;
  email: string | null;
  name: string | null;
  picture: string | null;
}

interface SignedPayload {
  [key: string]: unknown;
  exp: number;
}

const OIDC_CODE_TTL_SECONDS = 90;
const OIDC_ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const OIDC_ID_TOKEN_TTL_SECONDS = 15 * 60;
const generatedKeyPair = generateKeyPairSync('rsa', { modulusLength: 2048 });

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function jsonBase64url(input: unknown): string {
  return base64url(JSON.stringify(input));
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function getBaseUrl(): string {
  return (process.env.NEXTAUTH_URL || process.env.JUANIE_PUBLIC_URL || 'http://localhost:3001')
    .trim()
    .replace(/\/+$/, '');
}

function getClientId(): string {
  return process.env.BYTEBASE_OIDC_CLIENT_ID?.trim() || 'bytebase';
}

function getClientSecret(): string {
  return (
    process.env.BYTEBASE_OIDC_CLIENT_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET ||
    'development-secret'
  );
}

function getSigningSecret(): string {
  return (
    process.env.OIDC_TOKEN_SECRET?.trim() || process.env.NEXTAUTH_SECRET || 'development-secret'
  );
}

function getPrivateKey() {
  const configuredKey = process.env.OIDC_JWT_PRIVATE_KEY?.trim();
  return configuredKey
    ? createPrivateKey(configuredKey.replace(/\\n/g, '\n'))
    : generatedKeyPair.privateKey;
}

function getPublicKey() {
  const configuredKey = process.env.OIDC_JWT_PRIVATE_KEY?.trim();
  return configuredKey
    ? createPublicKey(createPrivateKey(configuredKey.replace(/\\n/g, '\n')))
    : generatedKeyPair.publicKey;
}

function signServiceToken(payload: SignedPayload): string {
  const body = jsonBase64url(payload);
  const signature = createHmac('sha256', getSigningSecret()).update(body).digest('base64url');
  return `${body}.${signature}`;
}

function verifyServiceToken<T extends SignedPayload>(token: string): T {
  const [body, signature] = token.split('.');
  if (!body || !signature) {
    throw new Error('Invalid token');
  }

  const expected = createHmac('sha256', getSigningSecret()).update(body).digest('base64url');
  if (signature !== expected) {
    throw new Error('Invalid token signature');
  }

  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T;
  if (payload.exp < nowSeconds()) {
    throw new Error('Token expired');
  }

  return payload;
}

function signJwt(payload: Record<string, unknown>): string {
  const header = {
    alg: 'RS256',
    typ: 'JWT',
    kid: 'juanie-oidc',
  };
  const encodedHeader = jsonBase64url(header);
  const encodedPayload = jsonBase64url(payload);
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = sign('RSA-SHA256', Buffer.from(signingInput), getPrivateKey()).toString(
    'base64url'
  );
  return `${signingInput}.${signature}`;
}

export function getOidcIssuer(): string {
  return getBaseUrl();
}

export function getOidcClientConfig() {
  return {
    clientId: getClientId(),
    clientSecret: getClientSecret(),
  };
}

export function getOidcDiscovery() {
  const issuer = getOidcIssuer();

  return {
    issuer,
    authorization_endpoint: `${issuer}/api/oidc/authorize`,
    token_endpoint: `${issuer}/api/oidc/token`,
    userinfo_endpoint: `${issuer}/api/oidc/userinfo`,
    jwks_uri: `${issuer}/api/oidc/jwks`,
    response_types_supported: ['code'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
    scopes_supported: ['openid', 'email', 'profile'],
    token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
    claims_supported: ['sub', 'email', 'name', 'picture'],
  };
}

export function getOidcJwks() {
  const jwk = getPublicKey().export({ format: 'jwk' }) as JsonWebKey;

  return {
    keys: [
      {
        ...jwk,
        kid: 'juanie-oidc',
        alg: 'RS256',
        use: 'sig',
      },
    ],
  };
}

export function assertOidcClient(input: {
  clientId?: string | null;
  clientSecret?: string | null;
}) {
  const config = getOidcClientConfig();

  if (input.clientId !== config.clientId || input.clientSecret !== config.clientSecret) {
    throw new Error('Invalid OIDC client');
  }
}

export function createAuthorizationCode(input: {
  userId: string;
  clientId: string;
  redirectUri: string;
  scope: string;
  nonce?: string | null;
}): string {
  return signServiceToken({
    kind: 'authorization_code',
    userId: input.userId,
    clientId: input.clientId,
    redirectUri: input.redirectUri,
    scope: input.scope,
    nonce: input.nonce ?? null,
    exp: nowSeconds() + OIDC_CODE_TTL_SECONDS,
  });
}

export function consumeAuthorizationCode(input: {
  code: string;
  clientId: string;
  redirectUri: string;
}) {
  const payload = verifyServiceToken<{
    kind: string;
    userId: string;
    clientId: string;
    redirectUri: string;
    scope: string;
    nonce: string | null;
    exp: number;
  }>(input.code);

  if (
    payload.kind !== 'authorization_code' ||
    payload.clientId !== input.clientId ||
    payload.redirectUri !== input.redirectUri
  ) {
    throw new Error('Invalid authorization code');
  }

  return payload;
}

export function createAccessToken(input: { userId: string; scope: string }): string {
  return signServiceToken({
    kind: 'access_token',
    userId: input.userId,
    scope: input.scope,
    exp: nowSeconds() + OIDC_ACCESS_TOKEN_TTL_SECONDS,
  });
}

export function consumeAccessToken(token: string) {
  const payload = verifyServiceToken<{
    kind: string;
    userId: string;
    scope: string;
    exp: number;
  }>(token);

  if (payload.kind !== 'access_token') {
    throw new Error('Invalid access token');
  }

  return payload;
}

export async function getUserClaims(userId: string): Promise<OidcUserClaims> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    throw new Error('User not found');
  }

  return {
    sub: user.id,
    email: user.email ?? null,
    name: user.name ?? user.email ?? null,
    picture: user.image ?? null,
  };
}

export async function createIdToken(input: {
  userId: string;
  clientId: string;
  nonce?: string | null;
}) {
  const issuer = getOidcIssuer();
  const issuedAt = nowSeconds();
  const claims = await getUserClaims(input.userId);

  return signJwt({
    iss: issuer,
    sub: claims.sub,
    aud: input.clientId,
    exp: issuedAt + OIDC_ID_TOKEN_TTL_SECONDS,
    iat: issuedAt,
    nonce: input.nonce ?? undefined,
    jti: randomUUID(),
    email: claims.email,
    email_verified: Boolean(claims.email),
    name: claims.name,
    picture: claims.picture,
  });
}
