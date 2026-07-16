import { createRemoteJWKSet, type JWTPayload, jwtVerify } from 'jose';
import { getCiRuntimeDescriptor } from '@/lib/ci/runtime-assets';

const githubIssuer = 'https://token.actions.githubusercontent.com';
const ciOidcAudience = 'juanie-ci';
const githubWorkflowPath = '.github/workflows/application-delivery.yml';

export type CiWorkloadProvider = 'github' | 'gitlab' | 'gitlab-self-hosted';

export function isCiWorkloadProvider(value: unknown): value is CiWorkloadProvider {
  return value === 'github' || value === 'gitlab' || value === 'gitlab-self-hosted';
}

export interface CiWorkloadIdentity {
  provider: CiWorkloadProvider;
  issuer: string;
  subject: string;
  repository: string;
  ref: string;
  sha: string | null;
  runId: string;
  runAttempt: string;
  externalRunId: string;
  workflowRef: string;
  workflowSha: string;
  eventName: string | null;
}

export interface WorkloadIdentityRequestScope {
  repository: string;
  sourceRef?: string | null;
  sourceCommitSha?: string | null;
  externalRunId?: string | null;
}

export class CiWorkloadIdentityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CiWorkloadIdentityError';
  }
}

function requireClaim(payload: JWTPayload, name: string): string {
  const value = payload[name];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new CiWorkloadIdentityError(`CI workload identity is missing ${name}`);
  }
  return value.trim();
}

function normalizeRef(value: string): string {
  const normalized = value.trim();
  if (normalized.startsWith('refs/')) return normalized;
  return `refs/heads/${normalized}`;
}

function matchesManagedWorkflow(workflowRef: string, repository: string, path: string): boolean {
  return workflowRef.startsWith(`${repository}/${path}@`);
}

export function isPlatformDeliveryIdentity(identity: CiWorkloadIdentity): boolean {
  return (
    identity.provider === 'github' &&
    identity.eventName === 'workflow_dispatch' &&
    matchesManagedWorkflow(identity.workflowRef, identity.repository, githubWorkflowPath)
  );
}

function getTrustedGitHubWorkflow(): { repository: string; revision: string } {
  const runtime = getCiRuntimeDescriptor();
  return { repository: runtime.githubRepository, revision: runtime.githubRevision };
}

export function normalizeGitHubWorkloadIdentity(
  payload: JWTPayload,
  trustedWorkflow = getTrustedGitHubWorkflow()
): CiWorkloadIdentity {
  const issuer = requireClaim(payload, 'iss').replace(/\/$/u, '');
  if (issuer !== githubIssuer) {
    throw new CiWorkloadIdentityError('GitHub workload identity issuer is not trusted');
  }

  const repository = requireClaim(payload, 'repository');
  if (repository !== trustedWorkflow.repository) {
    throw new CiWorkloadIdentityError('GitHub workload identity executor is not Juanie');
  }
  const workflowRef = requireClaim(payload, 'workflow_ref');
  if (!matchesManagedWorkflow(workflowRef, repository, githubWorkflowPath)) {
    throw new CiWorkloadIdentityError('GitHub workload identity workflow is not managed by Juanie');
  }
  const workflowSha = requireClaim(payload, 'workflow_sha').toLowerCase();
  if (workflowSha !== trustedWorkflow.revision.toLowerCase()) {
    throw new CiWorkloadIdentityError(
      'GitHub workload identity revision is not deployed by Juanie'
    );
  }
  const eventName = requireClaim(payload, 'event_name');
  if (eventName !== 'workflow_dispatch') {
    throw new CiWorkloadIdentityError('GitHub workload identity was not manually dispatched');
  }

  const runId = requireClaim(payload, 'run_id');
  const runAttempt = requireClaim(payload, 'run_attempt');
  return {
    provider: 'github',
    issuer,
    subject: requireClaim(payload, 'sub'),
    repository,
    ref: normalizeRef(requireClaim(payload, 'ref')),
    sha: requireClaim(payload, 'sha'),
    runId,
    runAttempt,
    externalRunId: `${runId}-${runAttempt}`,
    workflowRef,
    workflowSha,
    eventName,
  };
}

export function assertWorkloadIdentityMatchesRequest(
  identity: CiWorkloadIdentity,
  request: WorkloadIdentityRequestScope
): void {
  if (isPlatformDeliveryIdentity(identity)) {
    if (
      !request.repository ||
      !request.sourceRef ||
      !request.sourceCommitSha ||
      !request.externalRunId
    ) {
      throw new CiWorkloadIdentityError('Platform delivery request scope is incomplete');
    }
    return;
  }
  throw new CiWorkloadIdentityError('CI workload identity is not the Juanie delivery executor');
}

const remoteJwks = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getRemoteJwks(url: string): ReturnType<typeof createRemoteJWKSet> {
  const existing = remoteJwks.get(url);
  if (existing) return existing;
  const created = createRemoteJWKSet(new URL(url));
  remoteJwks.set(url, created);
  return created;
}

function requireBearerToken(authHeader: string | null): string {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new CiWorkloadIdentityError('Missing CI workload bearer token');
  }
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) throw new CiWorkloadIdentityError('Missing CI workload bearer token');
  return token;
}

export async function verifyCiWorkloadIdentity(input: {
  authHeader: string | null;
}): Promise<CiWorkloadIdentity> {
  const token = requireBearerToken(input.authHeader);
  const { payload } = await jwtVerify(token, getRemoteJwks(`${githubIssuer}/.well-known/jwks`), {
    issuer: githubIssuer,
    audience: ciOidcAudience,
  });
  return normalizeGitHubWorkloadIdentity(payload);
}
