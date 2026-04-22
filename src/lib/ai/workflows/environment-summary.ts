import type { EnvironmentEvidencePack } from '@/lib/ai/evidence/environment-evidence';
import type { AIPluginRunEnvelope } from '@/lib/ai/runtime/types';
import {
  type EnvironmentSummary,
  environmentSummarySchema,
} from '@/lib/ai/schemas/environment-summary';
import type { StructuredWorkflowRuntime } from '@/lib/ai/workflows/shared';
import { runStructuredWorkflow } from '@/lib/ai/workflows/shared';

function buildEnvironmentSummaryPrompt(evidence: EnvironmentEvidencePack): string {
  return [
    '请基于以下环境证据输出结构化 environment summary。',
    '要求：优先说明当前状态、访问地址、来源链路、版本、数据库与变量摘要，以及用户下一步最该关注什么。',
    JSON.stringify(evidence),
  ].join('\n\n');
}

export async function runEnvironmentSummaryWorkflow(
  evidence: EnvironmentEvidencePack,
  options?: {
    runtime?: StructuredWorkflowRuntime;
  }
): Promise<AIPluginRunEnvelope<EnvironmentSummary>> {
  return runStructuredWorkflow({
    promptKey: 'environment-summary',
    skillId: 'environment-skill',
    schema: environmentSummarySchema,
    schemaName: 'environmentSummary',
    description: 'Juanie 环境摘要',
    evidence,
    buildPrompt: buildEnvironmentSummaryPrompt,
    runtime: options?.runtime,
  });
}
