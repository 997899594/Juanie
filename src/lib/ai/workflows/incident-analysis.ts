import type { IncidentEvidencePack } from '@/lib/ai/evidence/incident-evidence';
import type { AIPluginRunEnvelope } from '@/lib/ai/runtime/types';
import { type IncidentAnalysis, incidentAnalysisSchema } from '@/lib/ai/schemas/incident-analysis';
import type { StructuredWorkflowRuntime } from '@/lib/ai/workflows/shared';
import { runStructuredWorkflow } from '@/lib/ai/workflows/shared';

function buildIncidentPrompt(evidence: IncidentEvidencePack): string {
  return [
    '请基于以下故障证据输出结构化 incident analysis。',
    '要求：优先给出根因、因果链、证据和处置建议。',
    JSON.stringify(evidence),
  ].join('\n\n');
}

export async function runIncidentAnalysisWorkflow(
  evidence: IncidentEvidencePack,
  options?: {
    runtime?: StructuredWorkflowRuntime;
  }
): Promise<AIPluginRunEnvelope<IncidentAnalysis>> {
  return runStructuredWorkflow({
    promptKey: 'incident-analysis',
    skillId: 'incident-skill',
    schema: incidentAnalysisSchema,
    schemaName: 'incidentAnalysis',
    description: 'Juanie 故障归因分析',
    evidence,
    buildPrompt: buildIncidentPrompt,
    runtime: options?.runtime,
  });
}
