import { describe, expect, it } from 'bun:test';
import {
  assertWorkloadIdentityMatchesRequest,
  normalizeGitHubWorkloadIdentity,
} from '@/lib/ci/workload-identity';

const sourceSha = 'a'.repeat(40);
const trustedWorkflow = {
  repository: 'juanie/platform',
  revision: '1'.repeat(40),
};

function platformClaims(overrides: Record<string, unknown> = {}) {
  return {
    iss: 'https://token.actions.githubusercontent.com',
    sub: 'repo:juanie/platform:ref:refs/heads/main',
    aud: 'juanie-ci',
    repository: 'juanie/platform',
    ref: 'refs/heads/main',
    sha: trustedWorkflow.revision,
    workflow_sha: trustedWorkflow.revision,
    run_id: '42',
    run_attempt: '3',
    workflow_ref: 'juanie/platform/.github/workflows/application-delivery.yml@refs/heads/main',
    event_name: 'workflow_dispatch',
    ...overrides,
  };
}

describe('CI workload identity', () => {
  it('binds GitHub OIDC to the platform workflow while accepting source scope separately', () => {
    const identity = normalizeGitHubWorkloadIdentity(platformClaims(), trustedWorkflow);

    expect(identity.provider).toBe('github');
    expect(identity.repository).toBe('juanie/platform');
    expect(identity.ref).toBe('refs/heads/main');
    expect(identity.sha).toBe(trustedWorkflow.revision);
    expect(identity.workflowSha).toBe(trustedWorkflow.revision);
    expect(identity.runId).toBe('42');
    expect(identity.runAttempt).toBe('3');
    expect(() =>
      assertWorkloadIdentityMatchesRequest(identity, {
        repository: 'acme/api',
        sourceRef: 'refs/heads/main',
        sourceCommitSha: sourceSha,
        externalRunId: 'github:delivery-123',
      })
    ).not.toThrow();
  });

  it('rejects a GitHub identity from an unmanaged workflow', () => {
    expect(() =>
      normalizeGitHubWorkloadIdentity(
        platformClaims({
          workflow_ref: 'juanie/platform/.github/workflows/exfiltrate.yml@refs/heads/main',
        }),
        trustedWorkflow
      )
    ).toThrow('workflow');
  });

  it('rejects non-platform executors and undeployed workflow revisions', () => {
    expect(() =>
      normalizeGitHubWorkloadIdentity(
        platformClaims({ repository: 'attacker/platform' }),
        trustedWorkflow
      )
    ).toThrow('executor');
    expect(() =>
      normalizeGitHubWorkloadIdentity(
        platformClaims({ workflow_sha: '2'.repeat(40) }),
        trustedWorkflow
      )
    ).toThrow('revision');
  });

  it('requires complete source scope from a trusted platform workflow', () => {
    const identity = normalizeGitHubWorkloadIdentity(platformClaims(), trustedWorkflow);
    expect(() =>
      assertWorkloadIdentityMatchesRequest(identity, {
        repository: 'acme/api',
        sourceRef: 'refs/heads/main',
        sourceCommitSha: sourceSha,
      })
    ).toThrow('incomplete');
  });
});
