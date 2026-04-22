import type { EnvironmentMigrationReviewEvidence } from '@/lib/ai/evidence/environment-migration-review';
import type { AIPluginRunEnvelope } from '@/lib/ai/runtime/types';
import { type MigrationReview, migrationReviewSchema } from '@/lib/ai/schemas/migration-review';
import type { StructuredWorkflowRuntime } from '@/lib/ai/workflows/shared';
import { runStructuredWorkflow } from '@/lib/ai/workflows/shared';

function buildMigrationReviewPrompt(evidence: EnvironmentMigrationReviewEvidence): string {
  return [
    '请基于以下环境迁移证据输出结构化 migration review。',
    '要求：优先指出当前迁移是否阻塞、schema 是否卡住、最该先处理什么。',
    JSON.stringify(evidence),
  ].join('\n\n');
}

export async function runMigrationReviewWorkflow(
  evidence: EnvironmentMigrationReviewEvidence,
  options?: {
    runtime?: StructuredWorkflowRuntime;
  }
): Promise<AIPluginRunEnvelope<MigrationReview>> {
  return runStructuredWorkflow({
    promptKey: 'migration-review',
    skillId: 'migration-skill',
    schema: migrationReviewSchema,
    schemaName: 'migrationReview',
    description: 'Juanie 环境迁移审阅',
    evidence,
    buildPrompt: buildMigrationReviewPrompt,
    runtime: options?.runtime,
  });
}
