import { describe, expect, it } from 'bun:test';
import {
  createMigrationApprovalToken,
  createReleaseMigrationPlanApprovalToken,
  verifyMigrationApprovalToken,
  verifyReleaseMigrationPlanApprovalToken,
} from '@/lib/ai/runtime/approval-token';

describe('migration approval token', () => {
  it('creates and verifies a signed approval token', () => {
    process.env.AI_APPROVAL_TOKEN_SECRET = 'test-secret';

    const token = createMigrationApprovalToken({
      teamId: 'team-1',
      projectId: 'project-1',
      environmentId: 'env-1',
      runId: 'run-1',
      actorUserId: 'user-1',
    });

    expect(
      verifyMigrationApprovalToken({
        token,
        teamId: 'team-1',
        projectId: 'project-1',
        environmentId: 'env-1',
        runId: 'run-1',
        actorUserId: 'user-1',
      })
    ).toBe(true);
  });

  it('rejects tokens when scope does not match', () => {
    process.env.AI_APPROVAL_TOKEN_SECRET = 'test-secret';

    const token = createMigrationApprovalToken({
      teamId: 'team-1',
      projectId: 'project-1',
      environmentId: 'env-1',
      runId: 'run-1',
      actorUserId: 'user-1',
    });

    expect(
      verifyMigrationApprovalToken({
        token,
        teamId: 'team-1',
        projectId: 'project-1',
        environmentId: 'env-2',
        runId: 'run-1',
        actorUserId: 'user-1',
      })
    ).toBe(false);
  });

  it('binds release plan approval to the immutable digest', () => {
    process.env.AI_APPROVAL_TOKEN_SECRET = 'test-secret';
    const token = createReleaseMigrationPlanApprovalToken({
      teamId: 'team-1',
      projectId: 'project-1',
      environmentId: 'env-1',
      releaseId: 'release-1',
      planId: 'plan-1',
      digest: 'a'.repeat(64),
      actorUserId: 'user-1',
    });

    expect(
      verifyReleaseMigrationPlanApprovalToken({
        token,
        teamId: 'team-1',
        projectId: 'project-1',
        environmentId: 'env-1',
        releaseId: 'release-1',
        planId: 'plan-1',
        digest: 'a'.repeat(64),
        actorUserId: 'user-1',
      })
    ).toBe(true);
    expect(
      verifyReleaseMigrationPlanApprovalToken({
        token,
        teamId: 'team-1',
        projectId: 'project-1',
        environmentId: 'env-1',
        releaseId: 'release-1',
        planId: 'plan-1',
        digest: 'b'.repeat(64),
        actorUserId: 'user-1',
      })
    ).toBe(false);
  });
});
