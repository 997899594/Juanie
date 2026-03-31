import { createDegradationState } from '@/lib/ai/core/degradation';
import { generateStructuredObject } from '@/lib/ai/core/generate-structured';
import {
  buildReleaseEvidencePack,
  type ReleaseEvidencePack,
} from '@/lib/ai/evidence/release-evidence';
import { releaseIntelligenceManifest } from '@/lib/ai/plugins/release-intelligence/manifest';
import type { AIPlugin } from '@/lib/ai/runtime/types';
import { type ReleasePlan, releasePlanSchema } from '@/lib/ai/schemas/release-plan';

function buildReleasePlanPrompt(evidence: ReleaseEvidencePack): string {
  return [
    '请基于以下发布证据输出结构化发布计划。',
    '要求：只根据 evidence 判断，不得虚构。',
    JSON.stringify(evidence),
  ].join('\n\n');
}

export const releaseIntelligencePlugin: AIPlugin<ReleaseEvidencePack, ReleasePlan> = {
  manifest: releaseIntelligenceManifest,
  async isEnabled() {
    return true;
  },
  async buildEvidence(context) {
    if (!context.projectId || !context.releaseId) {
      throw new Error('release-intelligence requires projectId and releaseId');
    }

    return buildReleaseEvidencePack({
      projectId: context.projectId,
      releaseId: context.releaseId,
    });
  },
  async run({ evidence }) {
    const result = await generateStructuredObject({
      schema: releasePlanSchema,
      schemaName: 'releasePlan',
      description: 'Juanie 发布计划',
      system: [
        '你是 Juanie 的发布控制分析器。',
        '你的职责是基于平台证据给出结构化发布判断。',
        '只能依据 evidence 作答，不得编造。',
        '输出必须严格符合 schema。',
      ].join('\n'),
      prompt: buildReleasePlanPrompt(evidence),
    });

    return {
      output: result.object,
      provider: result.provider,
      model: result.model,
      degradation: createDegradationState(null),
    };
  },
};
