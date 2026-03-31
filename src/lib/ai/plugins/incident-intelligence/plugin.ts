import { createDegradationState } from '@/lib/ai/core/degradation';
import { generateStructuredObject } from '@/lib/ai/core/generate-structured';
import {
  buildIncidentEvidencePack,
  type IncidentEvidencePack,
} from '@/lib/ai/evidence/incident-evidence';
import { incidentIntelligenceManifest } from '@/lib/ai/plugins/incident-intelligence/manifest';
import type { AIPlugin } from '@/lib/ai/runtime/types';
import { type IncidentAnalysis, incidentAnalysisSchema } from '@/lib/ai/schemas/incident-analysis';

function buildIncidentPrompt(evidence: IncidentEvidencePack): string {
  return [
    '请基于以下故障证据输出结构化 incident analysis。',
    '要求：优先给出根因、因果链、证据和处置建议。',
    JSON.stringify(evidence),
  ].join('\n\n');
}

export const incidentIntelligencePlugin: AIPlugin<IncidentEvidencePack, IncidentAnalysis> = {
  manifest: incidentIntelligenceManifest,
  async isEnabled() {
    return true;
  },
  async buildEvidence(context) {
    if (!context.projectId || !context.releaseId) {
      throw new Error('incident-intelligence requires projectId and releaseId');
    }

    return buildIncidentEvidencePack({
      projectId: context.projectId,
      releaseId: context.releaseId,
    });
  },
  async run({ evidence }) {
    const result = await generateStructuredObject({
      schema: incidentAnalysisSchema,
      schemaName: 'incidentAnalysis',
      description: 'Juanie 故障归因分析',
      system: [
        '你是 Juanie 的故障归因分析器。',
        '你的职责是基于平台证据给出结构化 incident diagnosis。',
        '只能依据 evidence 作答，不得编造。',
        '输出必须严格符合 schema。',
      ].join('\n'),
      prompt: buildIncidentPrompt(evidence),
    });

    return {
      output: result.object,
      provider: result.provider,
      model: result.model,
      degradation: createDegradationState(null),
    };
  },
};
