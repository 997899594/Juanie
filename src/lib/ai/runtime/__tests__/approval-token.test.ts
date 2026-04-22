import { describe, expect, it } from 'bun:test';
import {
  createMigrationApprovalToken,
  verifyMigrationApprovalToken,
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
});
