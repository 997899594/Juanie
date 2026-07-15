import { describe, expect, it } from 'bun:test';
import {
  assertWorkloadIdentityMatchesRequest,
  matchesCiProviderIssuer,
  normalizeGitHubWorkloadIdentity,
  normalizeGitLabWorkloadIdentity,
} from '@/lib/ci/workload-identity';

const sourceSha = 'a'.repeat(40);
const trustedJobWorkflowRef =
  'juanie/platform/.github/workflows/application-delivery.yml@1111111111111111111111111111111111111111';

describe('CI workload identity', () => {
  it('normalizes and binds a GitHub Actions identity to its managed workflow run', () => {
    const identity = normalizeGitHubWorkloadIdentity(
      {
        iss: 'https://token.actions.githubusercontent.com',
        sub: 'repo:acme/api:ref:refs/heads/main',
        aud: 'juanie-ci',
        repository: 'acme/api',
        ref: 'refs/heads/main',
        sha: sourceSha,
        run_id: '42',
        run_attempt: '3',
        workflow_ref: 'acme/api/.github/workflows/juanie-ci.yml@refs/heads/main',
        job_workflow_ref: trustedJobWorkflowRef,
        event_name: 'push',
      },
      trustedJobWorkflowRef
    );

    expect(identity.provider).toBe('github');
    expect(identity.repository).toBe('acme/api');
    expect(identity.ref).toBe('refs/heads/main');
    expect(identity.sha).toBe(sourceSha);
    expect(identity.workflowRef).toBe(trustedJobWorkflowRef);
    expect(identity.runId).toBe('42');
    expect(identity.runAttempt).toBe('3');
    expect(() =>
      assertWorkloadIdentityMatchesRequest(identity, {
        repository: 'acme/api',
        sourceRef: 'refs/heads/main',
        sourceCommitSha: sourceSha,
        externalRunId: '42-3',
      })
    ).not.toThrow();
  });

  it('rejects a GitHub identity from an unmanaged workflow', () => {
    expect(() =>
      normalizeGitHubWorkloadIdentity(
        {
          iss: 'https://token.actions.githubusercontent.com',
          sub: 'repo:acme/api:ref:refs/heads/main',
          repository: 'acme/api',
          ref: 'refs/heads/main',
          sha: sourceSha,
          run_id: '42',
          run_attempt: '1',
          workflow_ref: 'acme/api/.github/workflows/exfiltrate.yml@refs/heads/main',
          job_workflow_ref: trustedJobWorkflowRef,
          event_name: 'push',
        },
        trustedJobWorkflowRef
      )
    ).toThrow('workflow');
  });

  it('rejects a child workflow that does not run the pinned Juanie reusable workflow', () => {
    const claims = {
      iss: 'https://token.actions.githubusercontent.com',
      sub: 'repo:acme/api:ref:refs/heads/main',
      repository: 'acme/api',
      ref: 'refs/heads/main',
      sha: sourceSha,
      run_id: '42',
      run_attempt: '1',
      workflow_ref: 'acme/api/.github/workflows/juanie-ci.yml@refs/heads/main',
      event_name: 'push',
    };

    expect(() => normalizeGitHubWorkloadIdentity(claims, trustedJobWorkflowRef)).toThrow(
      'job_workflow_ref'
    );
    expect(() =>
      normalizeGitHubWorkloadIdentity(
        {
          ...claims,
          job_workflow_ref:
            'attacker/platform/.github/workflows/application-delivery.yml@1111111111111111111111111111111111111111',
        },
        trustedJobWorkflowRef
      )
    ).toThrow('trusted Juanie reusable workflow');
  });

  it('allows workflow_dispatch to select a revision while retaining run binding', () => {
    const identity = normalizeGitHubWorkloadIdentity(
      {
        iss: 'https://token.actions.githubusercontent.com',
        sub: 'repo:acme/api:ref:refs/heads/main',
        repository: 'acme/api',
        ref: 'refs/heads/main',
        sha: 'workflow-head',
        run_id: '9',
        run_attempt: '1',
        workflow_ref: 'acme/api/.github/workflows/juanie-ci.yml@refs/heads/main',
        job_workflow_ref: trustedJobWorkflowRef,
        event_name: 'workflow_dispatch',
      },
      trustedJobWorkflowRef
    );

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
    const identity = normalizeGitHubWorkloadIdentity(
      {
        iss: 'https://token.actions.githubusercontent.com',
        sub: 'repo:acme/api:ref:refs/heads/main',
        repository: 'acme/api',
        ref: 'refs/heads/main',
        sha: sourceSha,
        run_id: '42',
        run_attempt: '1',
        workflow_ref: 'acme/api/.github/workflows/juanie-ci.yml@refs/heads/main',
        job_workflow_ref: trustedJobWorkflowRef,
        event_name: 'push',
      },
      trustedJobWorkflowRef
    );

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
        sourceCommitSha: 'b'.repeat(40),
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
        sha: sourceSha,
        pipeline_id: '100',
        job_id: '200',
        ci_config_ref_uri: 'gitlab.example.com/acme/api//.gitlab-ci.yml@refs/heads/main',
        ci_config_sha: sourceSha,
      },
      'https://gitlab.example.com'
    );

    expect(identity.provider).toBe('gitlab-self-hosted');
    expect(identity.repository).toBe('acme/api');
    expect(identity.ref).toBe('refs/heads/main');
    expect(identity.sha).toBe(sourceSha);
    expect(identity.workflowSha).toBe(sourceSha);
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
          ci_config_sha: sourceSha,
          sha: sourceSha,
        },
        'https://gitlab.example.com'
      )
    ).toThrow('issuer');
  });

  it('rejects a GitLab config that is not bound to the source commit', () => {
    expect(() =>
      normalizeGitLabWorkloadIdentity(
        {
          iss: 'https://gitlab.example.com',
          project_path: 'acme/api',
          ref: 'main',
          sha: sourceSha,
          pipeline_id: '100',
          job_id: '200',
          ci_config_ref_uri: 'gitlab.example.com/acme/api//.gitlab-ci.yml@refs/heads/main',
          ci_config_sha: 'b'.repeat(40),
        },
        'https://gitlab.example.com'
      )
    ).toThrow('config revision');
  });

  it('routes identities only to their exact provider issuer', () => {
    expect(
      matchesCiProviderIssuer({
        issuer: 'https://token.actions.githubusercontent.com',
        provider: 'github',
      })
    ).toBe(true);
    expect(matchesCiProviderIssuer({ issuer: 'https://gitlab.com', provider: 'gitlab' })).toBe(
      true
    );
    expect(
      matchesCiProviderIssuer({
        issuer: 'https://gitlab.example.com',
        provider: 'gitlab-self-hosted',
        serverUrl: 'https://gitlab.example.com/groups/platform',
      })
    ).toBe(true);
    expect(
      matchesCiProviderIssuer({
        issuer: 'https://attacker.example.com',
        provider: 'gitlab-self-hosted',
        serverUrl: 'https://gitlab.example.com',
      })
    ).toBe(false);
  });
});
