import { createRemoteJWKSet, decodeJwt, type JWTPayload, jwtVerify } from 'jose';
import { getCiRuntimeDescriptor } from '@/lib/ci/runtime-assets';

const githubIssuer = 'https://token.actions.githubusercontent.com';
const ciOidcAudience = 'juanie-ci';
const githubWorkflowPath = '.github/workflows/juanie-ci.yml';
const gitLabConfigPath = '.gitlab-ci.yml';

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

function normalizeIssuer(value: string): string {
  return value.trim().replace(/\/$/u, '');
}

export function readCiWorkloadIssuer(token: string): string {
  return normalizeIssuer(requireClaim(decodeJwt(token), 'iss'));
}

export function matchesCiProviderIssuer(input: {
  issuer: string;
  provider: CiWorkloadProvider;
  serverUrl?: string | null;
}): boolean {
  const issuer = normalizeIssuer(input.issuer);
  if (input.provider === 'github') return issuer === githubIssuer;
  if (input.provider === 'gitlab') return issuer === 'https://gitlab.com';
  if (!input.serverUrl) return false;

  try {
    const server = new URL(input.serverUrl);
    server.pathname = '';
    server.search = '';
    server.hash = '';
    return issuer === normalizeIssuer(server.toString());
  } catch {
    return false;
  }
}

function normalizeRef(value: string): string {
  const normalized = value.trim();
  if (normalized.startsWith('refs/')) return normalized;
  return `refs/heads/${normalized}`;
}

function matchesManagedWorkflow(workflowRef: string, repository: string, path: string): boolean {
  return workflowRef.startsWith(`${repository}/${path}@`);
}

function getTrustedGitHubJobWorkflowRef(): string {
  const runtime = getCiRuntimeDescriptor();
  return `${runtime.githubRepository}/.github/workflows/application-delivery.yml@${runtime.githubRevision}`;
}

export function normalizeGitHubWorkloadIdentity(
  payload: JWTPayload,
  trustedJobWorkflowRef = getTrustedGitHubJobWorkflowRef()
): CiWorkloadIdentity {
  const issuer = normalizeIssuer(requireClaim(payload, 'iss'));
  if (issuer !== githubIssuer) {
    throw new CiWorkloadIdentityError('GitHub workload identity issuer is not trusted');
  }

  const repository = requireClaim(payload, 'repository');
  const workflowRef = requireClaim(payload, 'workflow_ref');
  if (!matchesManagedWorkflow(workflowRef, repository, githubWorkflowPath)) {
    throw new CiWorkloadIdentityError('GitHub workload identity workflow is not managed by Juanie');
  }
  const jobWorkflowRef = requireClaim(payload, 'job_workflow_ref');
  if (jobWorkflowRef !== trustedJobWorkflowRef) {
    throw new CiWorkloadIdentityError(
      'GitHub workload identity was not issued by the trusted Juanie reusable workflow'
    );
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
    workflowRef: jobWorkflowRef,
    workflowSha: trustedJobWorkflowRef.slice(trustedJobWorkflowRef.lastIndexOf('@') + 1),
    eventName: typeof payload.event_name === 'string' ? payload.event_name : null,
  };
}

export function normalizeGitLabWorkloadIdentity(
  payload: JWTPayload,
  allowedIssuer: string,
  provider: 'gitlab' | 'gitlab-self-hosted' = normalizeIssuer(allowedIssuer) ===
  'https://gitlab.com'
    ? 'gitlab'
    : 'gitlab-self-hosted'
): CiWorkloadIdentity {
  const issuer = normalizeIssuer(requireClaim(payload, 'iss'));
  if (issuer !== normalizeIssuer(allowedIssuer)) {
    throw new CiWorkloadIdentityError('GitLab workload identity issuer is not trusted');
  }

  const repository = requireClaim(payload, 'project_path');
  const workflowRef = requireClaim(payload, 'ci_config_ref_uri');
  const workflowSha = requireClaim(payload, 'ci_config_sha').toLowerCase();
  const sourceSha = requireClaim(payload, 'sha').toLowerCase();
  const issuerHost = new URL(issuer).host;
  if (!workflowRef.startsWith(`${issuerHost}/${repository}//${gitLabConfigPath}@`)) {
    throw new CiWorkloadIdentityError('GitLab workload identity workflow is not managed by Juanie');
  }
  if (!/^[a-f0-9]{40}$/u.test(workflowSha) || workflowSha !== sourceSha) {
    throw new CiWorkloadIdentityError(
      'GitLab workload identity config revision does not match the source commit'
    );
  }

  const runId = requireClaim(payload, 'pipeline_id');
  const runAttempt = requireClaim(payload, 'job_id');
  const ref =
    typeof payload.ref_path === 'string'
      ? normalizeRef(payload.ref_path)
      : normalizeRef(requireClaim(payload, 'ref'));
  return {
    provider,
    issuer,
    subject: typeof payload.sub === 'string' ? payload.sub : `project:${repository}`,
    repository,
    ref,
    sha: sourceSha,
    runId,
    runAttempt,
    externalRunId: runId,
    workflowRef,
    workflowSha,
    eventName: typeof payload.pipeline_source === 'string' ? payload.pipeline_source : null,
  };
}

function canSelectSourceRevision(identity: CiWorkloadIdentity): boolean {
  if (identity.provider === 'github') return identity.eventName === 'workflow_dispatch';
  return ['api', 'pipeline', 'trigger', 'web'].includes(identity.eventName ?? '');
}

export function assertWorkloadIdentityMatchesRequest(
  identity: CiWorkloadIdentity,
  request: WorkloadIdentityRequestScope
): void {
  if (identity.repository !== request.repository) {
    throw new CiWorkloadIdentityError('CI workload repository does not match the request');
  }
  if (
    request.sourceRef &&
    identity.ref !== normalizeRef(request.sourceRef) &&
    !canSelectSourceRevision(identity)
  ) {
    throw new CiWorkloadIdentityError('CI workload ref does not match the request');
  }
  if (
    request.sourceCommitSha &&
    identity.sha !== request.sourceCommitSha &&
    !canSelectSourceRevision(identity)
  ) {
    throw new CiWorkloadIdentityError('CI workload commit does not match the request');
  }
  if (request.externalRunId && identity.externalRunId !== request.externalRunId) {
    throw new CiWorkloadIdentityError('CI workload run does not match the request');
  }
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
  provider: CiWorkloadProvider;
  gitLabIssuer?: string | null;
}): Promise<CiWorkloadIdentity> {
  const token = requireBearerToken(input.authHeader);
  if (input.provider === 'github') {
    const { payload } = await jwtVerify(token, getRemoteJwks(`${githubIssuer}/.well-known/jwks`), {
      issuer: githubIssuer,
      audience: ciOidcAudience,
    });
    return normalizeGitHubWorkloadIdentity(payload);
  }

  const allowedIssuer = input.gitLabIssuer ? normalizeIssuer(input.gitLabIssuer) : null;
  if (!allowedIssuer) {
    throw new CiWorkloadIdentityError('GitLab workload issuer is not configured');
  }
  const unverifiedIssuer = readCiWorkloadIssuer(token);
  if (unverifiedIssuer !== allowedIssuer) {
    throw new CiWorkloadIdentityError('GitLab workload identity issuer is not trusted');
  }
  const { payload } = await jwtVerify(token, getRemoteJwks(`${allowedIssuer}/-/jwks`), {
    issuer: allowedIssuer,
    audience: ciOidcAudience,
  });
  return normalizeGitLabWorkloadIdentity(payload, allowedIssuer, input.provider);
}
