import type { ReleaseEvidencePack } from '@/lib/ai/evidence/release-evidence';
import type { AIPluginRunEnvelope } from '@/lib/ai/runtime/types';
import { type ReleasePlan, releasePlanSchema } from '@/lib/ai/schemas/release-plan';
import type { StructuredWorkflowRuntime } from '@/lib/ai/workflows/shared';
import { runStructuredWorkflow } from '@/lib/ai/workflows/shared';

function buildReleasePlanPrompt(evidence: ReleaseEvidencePack): string {
  return [
    '请基于以下发布证据输出结构化发布计划。',
    '要求：只根据 evidence 判断，不得虚构。',
    JSON.stringify(evidence),
  ].join('\n\n');
}

export async function runReleasePlanWorkflow(
  evidence: ReleaseEvidencePack,
  options?: {
    runtime?: StructuredWorkflowRuntime;
  }
): Promise<AIPluginRunEnvelope<ReleasePlan>> {
  return runStructuredWorkflow({
    promptKey: 'release-plan',
    skillId: 'release-skill',
    schema: releasePlanSchema,
    schemaName: 'releasePlan',
    description: 'Juanie 发布计划',
    evidence,
    buildPrompt: buildReleasePlanPrompt,
    runtime: options?.runtime,
  });
}
