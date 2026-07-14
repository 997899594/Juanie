import * as restate from '@restatedev/restate-sdk';
import {
  deleteProjectControlPlaneRecord,
  deleteProjectManagedDatabases,
  deleteProjectRepositoryArtifacts,
  deleteProjectRuntimeResources,
  failProjectDeletion,
  prepareProjectDeletion,
} from '@/lib/queue/project-delete';
import { restateServiceNames } from '@/lib/restate/config';
import type { DurableCommand } from '@/lib/restate/contracts';

export const projectDeletionWorkflow = restate.workflow({
  name: restateServiceNames.projectDeletion,
  handlers: {
    run: async (ctx: restate.WorkflowContext, command: DurableCommand) => {
      const plan = await ctx.run(
        'prepare-project-deletion',
        () => prepareProjectDeletion(command.aggregateId),
        { maxRetryAttempts: 3 }
      );
      if (!plan) {
        return { success: true, deleted: true, missing: true };
      }

      try {
        await ctx.run(
          'delete-project-runtime-resources',
          () => deleteProjectRuntimeResources(plan),
          {
            maxRetryAttempts: 8,
          }
        );
        await ctx.run(
          'delete-project-managed-databases',
          () => deleteProjectManagedDatabases(plan.project.id),
          { maxRetryAttempts: 8 }
        );
        await ctx.run('delete-project-repository-artifacts', () =>
          deleteProjectRepositoryArtifacts(plan.project)
        );
        await ctx.run('delete-project-control-plane-record', () =>
          deleteProjectControlPlaneRecord(plan.project)
        );
        return { success: true, deleted: true };
      } catch (error) {
        await ctx.run('fail-project-deletion', () =>
          failProjectDeletion(
            plan.project.id,
            error instanceof Error ? error.message : String(error)
          )
        );
        throw error;
      }
    },
  },
  options: { workflowRetention: { days: 30 } },
});
