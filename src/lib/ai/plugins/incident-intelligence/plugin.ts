import type { IncidentEvidencePack } from '@/lib/ai/evidence/incident-evidence';
import { incidentIntelligenceManifest } from '@/lib/ai/plugins/incident-intelligence/manifest';
import type { AIPlugin } from '@/lib/ai/runtime/types';
import type { IncidentAnalysis } from '@/lib/ai/schemas/incident-analysis';
import { executeJuanieTool } from '@/lib/ai/tools/runtime';
import { runIncidentAnalysisWorkflow } from '@/lib/ai/workflows/incident-analysis';

export const incidentIntelligencePlugin: AIPlugin<IncidentEvidencePack, IncidentAnalysis> = {
  manifest: incidentIntelligenceManifest,
  async isEnabled() {
    return true;
  },
  async buildEvidence(context) {
    if (!context.projectId || !context.releaseId) {
      throw new Error('incident-intelligence requires projectId and releaseId');
    }

    return executeJuanieTool({
      toolId: 'read-incident-context',
      context: {
        actorUserId: context.actorUserId,
        teamId: context.teamId,
        projectId: context.projectId,
        releaseId: context.releaseId,
      },
    });
  },
  async run({ evidence }) {
    return runIncidentAnalysisWorkflow(evidence);
  },
};
