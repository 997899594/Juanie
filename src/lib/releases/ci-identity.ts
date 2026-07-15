import { hkdfSync, randomUUID } from 'node:crypto';
import { decodeJwt, type JWTPayload, jwtVerify, SignJWT } from 'jose';
import type { CiWorkloadIdentity } from '@/lib/ci/workload-identity';
import { getMasterKey } from '@/lib/crypto';

const juanieCiIssuer = 'https://juanie.art';
const juanieCiAudience = 'juanie-ci-api';
const ciTokenTtlSeconds = 5 * 60;

export interface CiReleaseScope {
  repository: string;
  ref: string;
  sha: string;
  externalRunId: string;
}

interface JuanieCiClaims extends JWTPayload {
  token_type?: string;
  provider?: string;
  repository?: string;
  ref?: string;
  sha?: string;
  external_run_id?: string;
  workflow_ref?: string;
}

async function getCiSigningKey(): Promise<Uint8Array> {
  const masterKey = await getMasterKey();
  return new Uint8Array(
    hkdfSync('sha256', masterKey, 'juanie-ci-workload-token-v1', 'HS256 signing key', 32)
  );
}

function validateScope(scope: CiReleaseScope): void {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(scope.repository)) {
    throw new Error('Invalid repository scope');
  }
  if (!scope.ref.startsWith('refs/') || scope.ref.length > 500) {
    throw new Error('Invalid release ref scope');
  }
  if (!/^[a-f0-9]{40}$/iu.test(scope.sha)) {
    throw new Error('Invalid release SHA scope');
  }
  if (!/^[A-Za-z0-9_.:-]+$/u.test(scope.externalRunId)) {
    throw new Error('Invalid CI run scope');
  }
}

export async function issueJuanieCiToken(
  identity: CiWorkloadIdentity,
  requestedScope: CiReleaseScope
): Promise<{ token: string; expiresIn: number }> {
  validateScope(requestedScope);
  const now = Math.floor(Date.now() / 1000);
  const token = await new SignJWT({
    token_type: 'juanie_ci_workload',
    provider: identity.provider,
    repository: requestedScope.repository.toLowerCase(),
    ref: requestedScope.ref,
    sha: requestedScope.sha.toLowerCase(),
    external_run_id: requestedScope.externalRunId,
    workflow_ref: identity.workflowRef,
  } satisfies JuanieCiClaims)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(juanieCiIssuer)
    .setAudience(juanieCiAudience)
    .setSubject(identity.subject)
    .setJti(randomUUID())
    .setIssuedAt(now)
    .setExpirationTime(now + ciTokenTtlSeconds)
    .sign(await getCiSigningKey());

  return { token, expiresIn: ciTokenTtlSeconds };
}

export function isJuanieCiToken(token: string): boolean {
  try {
    const claims = decodeJwt(token) as JuanieCiClaims;
    return claims.iss === juanieCiIssuer && claims.token_type === 'juanie_ci_workload';
  } catch {
    return false;
  }
}

export async function verifyJuanieCiToken(
  token: string,
  expected: {
    repository: string;
    ref?: string | null;
    sha?: string | null;
    externalRunId?: string | null;
  }
): Promise<void> {
  const { payload } = await jwtVerify<JuanieCiClaims>(token, await getCiSigningKey(), {
    issuer: juanieCiIssuer,
    audience: juanieCiAudience,
    algorithms: ['HS256'],
  });

  if (
    payload.token_type !== 'juanie_ci_workload' ||
    payload.repository?.toLowerCase() !== expected.repository.toLowerCase() ||
    (expected.ref && payload.ref !== expected.ref) ||
    (expected.sha && payload.sha?.toLowerCase() !== expected.sha.toLowerCase()) ||
    (expected.externalRunId && payload.external_run_id !== expected.externalRunId)
  ) {
    throw new Error('CI workload token scope mismatch');
  }
}
