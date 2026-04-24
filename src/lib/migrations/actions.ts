import {
  executeMigrationRunActionForActor,
  type MigrationRunActionResult,
} from '@/lib/migrations/control-service';

export type { MigrationRunActionResult } from '@/lib/migrations/control-service';

export async function approveMigrationRunForActor(input: {
  actorUserId: string;
  projectId: string;
  runId: string;
  approvalToken: string;
}): Promise<MigrationRunActionResult> {
  return executeMigrationRunActionForActor({
    actorUserId: input.actorUserId,
    projectId: input.projectId,
    runId: input.runId,
    action: 'approve',
    approvalToken: input.approvalToken,
  });
}
