import type { EnvironmentEnvvarRiskEvidence } from '@/lib/ai/evidence/environment-envvar-risk';
import type { AIPluginRunEnvelope } from '@/lib/ai/runtime/types';
import type { EnvvarRisk } from '@/lib/ai/schemas/envvar-risk';
import { envvarRiskWorkflowDefinition } from '@/lib/ai/workflows/catalog';
import type { StructuredWorkflowRuntime } from '@/lib/ai/workflows/shared';
import { runStructuredWorkflow } from '@/lib/ai/workflows/shared';

function buildEnvvarRiskPrompt(evidence: EnvironmentEnvvarRiskEvidence): string {
  return [
    '请基于以下环境变量证据输出结构化 envvar risk。',
    '要求：优先说明当前变量覆盖是否清晰、继承链是否过深、密文使用是否健康，以及用户最该先看的风险点。',
    JSON.stringify(evidence),
  ].join('\n\n');
}

export async function runEnvvarRiskWorkflow(
  evidence: EnvironmentEnvvarRiskEvidence,
  options?: {
    runtime?: StructuredWorkflowRuntime;
  }
): Promise<AIPluginRunEnvelope<EnvvarRisk>> {
  return runStructuredWorkflow({
    workflow: envvarRiskWorkflowDefinition,
    evidence,
    buildPrompt: buildEnvvarRiskPrompt,
    runtime: options?.runtime,
  });
}
