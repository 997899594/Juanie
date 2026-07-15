import { describe, expect, it } from 'bun:test';
import {
  assertWorkloadIdentityMatchesRequest,
  normalizeGitHubWorkloadIdentity,
  normalizeGitLabWorkloadIdentity,
} from '@/lib/ci/workload-identity';

describe('CI workload identity', () => {
  it('normalizes and binds a GitHub Actions identity to its managed workflow run', () => {
    const identity = normalizeGitHubWorkloadIdentity({
      iss: 'https://token.actions.githubusercontent.com',
      sub: 'repo:acme/api:ref:refs/heads/main',
      aud: 'juanie-ci',
      repository: 'acme/api',
      ref: 'refs/heads/main',
      sha: 'abc123',
      run_id: '42',
      run_attempt: '3',
      workflow_ref: 'acme/api/.github/workflows/juanie-ci.yml@refs/heads/main',
      event_name: 'push',
    });

    expect(identity.provider).toBe('github');
    expect(identity.repository).toBe('acme/api');
    expect(identity.ref).toBe('refs/heads/main');
    expect(identity.sha).toBe('abc123');
    expect(identity.runId).toBe('42');
    expect(identity.runAttempt).toBe('3');
    expect(() =>
      assertWorkloadIdentityMatchesRequest(identity, {
        repository: 'acme/api',
        sourceRef: 'refs/heads/main',
        sourceCommitSha: 'abc123',
        externalRunId: '42-3',
      })
    ).not.toThrow();
  });

  it('rejects a GitHub identity from an unmanaged workflow', () => {
    expect(() =>
      normalizeGitHubWorkloadIdentity({
        iss: 'https://token.actions.githubusercontent.com',
        sub: 'repo:acme/api:ref:refs/heads/main',
        repository: 'acme/api',
        ref: 'refs/heads/main',
        sha: 'abc123',
        run_id: '42',
        run_attempt: '1',
        workflow_ref: 'acme/api/.github/workflows/exfiltrate.yml@refs/heads/main',
        event_name: 'push',
      })
    ).toThrow('workflow');
  });

  it('allows workflow_dispatch to select a revision while retaining run binding', () => {
    const identity = normalizeGitHubWorkloadIdentity({
      iss: 'https://token.actions.githubusercontent.com',
      sub: 'repo:acme/api:ref:refs/heads/main',
      repository: 'acme/api',
      ref: 'refs/heads/main',
      sha: 'workflow-head',
      run_id: '9',
      run_attempt: '1',
      workflow_ref: 'acme/api/.github/workflows/juanie-ci.yml@refs/heads/main',
      event_name: 'workflow_dispatch',
    });

    expect(() =>
      assertWorkloadIdentityMatchesRequest(identity, {
        repository: 'acme/api',
        sourceRef: 'refs/heads/preview',
        sourceCommitSha: 'selected-commit',
        externalRunId: '9-1',
      })
    ).not.toThrow();
  });

  it('rejects repository, ref, sha and run mismatches', () => {
    const identity = normalizeGitHubWorkloadIdentity({
      iss: 'https://token.actions.githubusercontent.com',
      sub: 'repo:acme/api:ref:refs/heads/main',
      repository: 'acme/api',
      ref: 'refs/heads/main',
      sha: 'abc123',
      run_id: '42',
      run_attempt: '1',
      workflow_ref: 'acme/api/.github/workflows/juanie-ci.yml@refs/heads/main',
      event_name: 'push',
    });

    expect(() =>
      assertWorkloadIdentityMatchesRequest(identity, { repository: 'acme/other' })
    ).toThrow('repository');
    expect(() =>
      assertWorkloadIdentityMatchesRequest(identity, {
        repository: 'acme/api',
        sourceRef: 'refs/heads/dev',
      })
    ).toThrow('ref');
    expect(() =>
      assertWorkloadIdentityMatchesRequest(identity, {
        repository: 'acme/api',
        sourceCommitSha: 'other',
      })
    ).toThrow('commit');
    expect(() =>
      assertWorkloadIdentityMatchesRequest(identity, {
        repository: 'acme/api',
        externalRunId: '42-2',
      })
    ).toThrow('run');
  });

  it('normalizes GitLab OIDC claims without accepting arbitrary issuers', () => {
    const identity = normalizeGitLabWorkloadIdentity(
      {
        iss: 'https://gitlab.example.com',
        sub: 'project_path:acme/api:ref_type:branch:ref:main',
        project_path: 'acme/api',
        ref: 'main',
        ref_path: 'refs/heads/main',
        sha: 'abc123',
        pipeline_id: '100',
        job_id: '200',
        ci_config_ref_uri: 'gitlab.example.com/acme/api//.gitlab-ci.yml@refs/heads/main',
      },
      'https://gitlab.example.com'
    );

    expect(identity.provider).toBe('gitlab');
    expect(identity.repository).toBe('acme/api');
    expect(identity.ref).toBe('refs/heads/main');
    expect(identity.sha).toBe('abc123');
    expect(identity.runId).toBe('100');
    expect(identity.runAttempt).toBe('200');
    expect(() =>
      normalizeGitLabWorkloadIdentity(
        {
          iss: 'https://attacker.example.com',
          project_path: 'acme/api',
          ref: 'main',
          pipeline_id: '100',
          job_id: '200',
          ci_config_ref_uri: 'gitlab.example.com/acme/api//.gitlab-ci.yml@refs/heads/main',
        },
        'https://gitlab.example.com'
      )
    ).toThrow('issuer');
  });
});
