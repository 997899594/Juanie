import { hkdfSync, randomUUID } from 'node:crypto';
import { decodeJwt, type JWTPayload, jwtVerify, SignJWT } from 'jose';
import {
  assertWorkloadIdentityMatchesRequest,
  type CiWorkloadIdentity,
  type CiWorkloadProvider,
  isCiWorkloadProvider,
  isPlatformDeliveryIdentity,
} from '@/lib/ci/workload-identity';
import { getMasterKey } from '@/lib/crypto';

const juanieCiIssuer = 'https://juanie.art';
const juanieCiAudience = 'juanie-ci-api';
const ciTokenTtlSeconds = 5 * 60;

export interface CiReleaseScope {
  projectId: string;
  repositoryId: string;
  provider: CiWorkloadProvider;
  repository: string;
  ref: string;
  sha: string;
  externalRunId: string;
}

interface JuanieCiClaims extends JWTPayload {
  token_type?: string;
  provider?: string;
  project_id?: string;
  repository_id?: string;
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
  const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu;
  if (!uuidPattern.test(scope.projectId) || !uuidPattern.test(scope.repositoryId)) {
    throw new Error('Invalid Juanie project or repository scope');
  }
  if (!isCiWorkloadProvider(scope.provider)) {
    throw new Error('Invalid CI provider scope');
  }
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
  if (identity.provider !== requestedScope.provider && !isPlatformDeliveryIdentity(identity)) {
    throw new Error('CI workload provider does not match the requested scope');
  }
  assertWorkloadIdentityMatchesRequest(identity, {
    repository: requestedScope.repository,
    sourceRef: requestedScope.ref,
    sourceCommitSha: requestedScope.sha,
    externalRunId: requestedScope.externalRunId,
  });
  const now = Math.floor(Date.now() / 1000);
  const token = await new SignJWT({
    token_type: 'juanie_ci_workload',
    provider: requestedScope.provider,
    project_id: requestedScope.projectId,
    repository_id: requestedScope.repositoryId,
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
    projectId?: string | null;
    repositoryId?: string | null;
    provider?: CiWorkloadProvider | null;
    repository: string;
    ref?: string | null;
    sha?: string | null;
    externalRunId?: string | null;
  }
): Promise<{
  projectId: string;
  repositoryId: string;
  provider: CiWorkloadProvider;
}> {
  const { payload } = await jwtVerify<JuanieCiClaims>(token, await getCiSigningKey(), {
    issuer: juanieCiIssuer,
    audience: juanieCiAudience,
    algorithms: ['HS256'],
  });

  const provider = payload.provider;
  const projectId = payload.project_id;
  const repositoryId = payload.repository_id;
  if (
    payload.token_type !== 'juanie_ci_workload' ||
    !isCiWorkloadProvider(provider) ||
    typeof projectId !== 'string' ||
    typeof repositoryId !== 'string' ||
    (expected.projectId && projectId !== expected.projectId) ||
    (expected.repositoryId && repositoryId !== expected.repositoryId) ||
    (expected.provider && provider !== expected.provider) ||
    payload.repository?.toLowerCase() !== expected.repository.toLowerCase() ||
    (expected.ref && payload.ref !== expected.ref) ||
    (expected.sha && payload.sha?.toLowerCase() !== expected.sha.toLowerCase()) ||
    (expected.externalRunId && payload.external_run_id !== expected.externalRunId)
  ) {
    throw new Error('CI workload token scope mismatch');
  }

  return { projectId, repositoryId, provider };
}
