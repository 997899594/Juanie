import type { DynamicPluginEvidence } from '@/lib/ai/plugins/dynamic-plugin';
import {
  type DynamicPluginOutput,
  dynamicPluginOutputSchema,
} from '@/lib/ai/schemas/dynamic-plugin-output';
import type { StructuredWorkflowRuntime } from '@/lib/ai/workflows/shared';
import { runStructuredWorkflow } from '@/lib/ai/workflows/shared';

function buildDynamicPluginPrompt(evidence: DynamicPluginEvidence): string {
  return [
    `你是 Juanie 的动态插件执行器，现在要根据 manifest 和 tool 输出完成 "${evidence.manifest.title}"。`,
    '必须严格基于给定 evidence，不能虚构。',
    '输出要克制、清晰、可执行，避免重复描述。',
    '如果 manifest 声明了 actions，只能把已声明的 actionId 写入 nextActions.actionId，不能编造新的 actionId。',
    JSON.stringify(evidence),
  ].join('\n\n');
}

export async function runDynamicPluginWorkflow(
  input: {
    evidence: DynamicPluginEvidence;
    skillId?: string | null;
  },
  options?: {
    runtime?: StructuredWorkflowRuntime;
  }
): Promise<import('@/lib/ai/runtime/types').AIPluginRunEnvelope<DynamicPluginOutput>> {
  return runStructuredWorkflow({
    promptKey: 'dynamic-plugin',
    skillId: input.skillId ?? null,
    schema: dynamicPluginOutputSchema,
    schemaName: 'dynamicPluginOutput',
    description: `${input.evidence.manifest.title} dynamic plugin output`,
    evidence: input.evidence,
    buildPrompt: buildDynamicPluginPrompt,
    runtime: options?.runtime,
  });
}
