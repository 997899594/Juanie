import type { EnvironmentEvidencePack } from '@/lib/ai/evidence/environment-evidence';
import { environmentSummaryManifest } from '@/lib/ai/plugins/environment-summary/manifest';
import type { AIPlugin } from '@/lib/ai/runtime/types';
import type { EnvironmentSummary } from '@/lib/ai/schemas/environment-summary';
import { executeJuanieTool } from '@/lib/ai/tools/runtime';
import { runEnvironmentSummaryWorkflow } from '@/lib/ai/workflows/environment-summary';

export const environmentSummaryPlugin: AIPlugin<EnvironmentEvidencePack, EnvironmentSummary> = {
  manifest: environmentSummaryManifest,
  async isEnabled() {
    return true;
  },
  async buildEvidence(context) {
    if (!context.projectId || !context.environmentId) {
      throw new Error('environment-summary requires projectId and environmentId');
    }

    return executeJuanieTool({
      toolId: 'read-environment-context',
      context: {
        actorUserId: context.actorUserId,
        teamId: context.teamId,
        projectId: context.projectId,
        environmentId: context.environmentId,
      },
    });
  },
  async run({ evidence }) {
    return runEnvironmentSummaryWorkflow(evidence);
  },
};
