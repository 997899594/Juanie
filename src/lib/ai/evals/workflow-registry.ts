import { ZodError, type ZodTypeAny } from 'zod';
import type { JuanieEvalFixture } from '@/lib/ai/evals/types';
import { environmentSummarySchema } from '@/lib/ai/schemas/environment-summary';
import { envvarRiskSchema } from '@/lib/ai/schemas/envvar-risk';
import { incidentAnalysisSchema } from '@/lib/ai/schemas/incident-analysis';
import { migrationReviewSchema } from '@/lib/ai/schemas/migration-review';
import { releasePlanSchema } from '@/lib/ai/schemas/release-plan';
import { runEnvironmentSummaryWorkflow } from '@/lib/ai/workflows/environment-summary';
import { runEnvvarRiskWorkflow } from '@/lib/ai/workflows/envvar-risk';
import { runIncidentAnalysisWorkflow } from '@/lib/ai/workflows/incident-analysis';
import { runMigrationReviewWorkflow } from '@/lib/ai/workflows/migration-review';
import { runReleasePlanWorkflow } from '@/lib/ai/workflows/release-plan';
import type { StructuredWorkflowRuntime } from '@/lib/ai/workflows/shared';

export interface WorkflowEvalExecutionResult<TOutput = unknown> {
  output: TOutput;
  provider: string | null;
  model: string | null;
  promptKey?: string | null;
  promptVersion?: string | null;
  skillId?: string | null;
}

export interface JuanieWorkflowEvalDefinition<TInput = unknown, TOutput = unknown> {
  schema: ZodTypeAny;
  run(
    input: TInput,
    runtime: StructuredWorkflowRuntime
  ): Promise<WorkflowEvalExecutionResult<TOutput>>;
}

const workflowEvalRegistry: Record<string, JuanieWorkflowEvalDefinition> = {
  'environment-summary': {
    schema: environmentSummarySchema,
    run: (input, runtime) => runEnvironmentSummaryWorkflow(input as never, { runtime }),
  },
  'envvar-risk': {
    schema: envvarRiskSchema,
    run: (input, runtime) => runEnvvarRiskWorkflow(input as never, { runtime }),
  },
  'incident-intelligence': {
    schema: incidentAnalysisSchema,
    run: (input, runtime) => runIncidentAnalysisWorkflow(input as never, { runtime }),
  },
  'migration-review': {
    schema: migrationReviewSchema,
    run: (input, runtime) => runMigrationReviewWorkflow(input as never, { runtime }),
  },
  'release-intelligence': {
    schema: releasePlanSchema,
    run: (input, runtime) => runReleasePlanWorkflow(input as never, { runtime }),
  },
};

export function getWorkflowEvalDefinition(pluginId: string): JuanieWorkflowEvalDefinition | null {
  return workflowEvalRegistry[pluginId] ?? null;
}

export function validateWorkflowFixtureOutput(fixture: JuanieEvalFixture): {
  ok: boolean;
  detail: string;
} {
  const definition = getWorkflowEvalDefinition(fixture.pluginId);
  if (!definition) {
    return {
      ok: false,
      detail: `no workflow evaluator registered for plugin ${fixture.pluginId}`,
    };
  }

  try {
    definition.schema.parse(fixture.output);
    return { ok: true, detail: 'output matches workflow schema' };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        ok: false,
        detail: `schema validation failed: ${error.issues.map((issue) => issue.path.join('.')).join(', ')}`,
      };
    }

    return {
      ok: false,
      detail: error instanceof Error ? error.message : 'schema validation failed',
    };
  }
}
