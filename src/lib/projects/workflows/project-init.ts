import * as restate from '@restatedev/restate-sdk';
import {
  completeProjectInitialization,
  failProjectInitialization,
  prepareProjectInitialization,
  runProjectInitializationStep,
} from '@/lib/queue/project-init';
import { restateServiceNames } from '@/lib/restate/config';
import type { DurableCommand } from '@/lib/restate/contracts';

function readMode(command: DurableCommand): 'import' | 'create' {
  const mode = command.payload.mode;
  if (mode !== 'import' && mode !== 'create') {
    throw new restate.TerminalError(`Unsupported project initialization mode: ${String(mode)}`);
  }
  return mode;
}

export const projectInitializationWorkflow = restate.workflow({
  name: restateServiceNames.projectInitialization,
  handlers: {
    run: async (ctx: restate.WorkflowContext, command: DurableCommand) => {
      const mode = readMode(command);
      const template = command.payload.template;
      const plan = await ctx.run(
        'prepare-project-initialization',
        () =>
          prepareProjectInitialization({
            projectId: command.aggregateId,
            mode,
            template: typeof template === 'string' ? template : undefined,
          }),
        { maxRetryAttempts: 3 }
      );

      for (const step of plan.steps) {
        try {
          await ctx.run(
            `project-init-${step}`,
            () =>
              runProjectInitializationStep({
                projectId: command.aggregateId,
                step,
                template: typeof template === 'string' ? template : undefined,
              }),
            {
              maxRetryAttempts: 8,
              initialRetryInterval: { seconds: 1 },
              maxRetryInterval: { seconds: 30 },
            }
          );
        } catch (error) {
          await ctx.run(`fail-project-init-${step}`, () =>
            failProjectInitialization({
              projectId: command.aggregateId,
              step,
              error: error instanceof Error ? error.message : String(error),
            })
          );
          throw error;
        }
      }

      await ctx.run('complete-project-initialization', () =>
        completeProjectInitialization(command.aggregateId)
      );
    },
  },
  options: {
    workflowRetention: { days: 30 },
  },
});
