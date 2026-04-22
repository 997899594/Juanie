import type { EnvironmentEnvvarRiskEvidence } from '@/lib/ai/evidence/environment-envvar-risk';
import { envvarRiskManifest } from '@/lib/ai/plugins/envvar-risk/manifest';
import type { AIPlugin } from '@/lib/ai/runtime/types';
import type { EnvvarRisk } from '@/lib/ai/schemas/envvar-risk';
import { executeJuanieTool } from '@/lib/ai/tools/runtime';
import { runEnvvarRiskWorkflow } from '@/lib/ai/workflows/envvar-risk';

export const envvarRiskPlugin: AIPlugin<EnvironmentEnvvarRiskEvidence, EnvvarRisk> = {
  manifest: envvarRiskManifest,
  async isEnabled() {
    return true;
  },
  async buildEvidence(context) {
    if (!context.projectId || !context.environmentId) {
      throw new Error('envvar-risk requires projectId and environmentId');
    }

    return executeJuanieTool({
      toolId: 'read-environment-variables',
      context: {
        actorUserId: context.actorUserId,
        teamId: context.teamId,
        projectId: context.projectId,
        environmentId: context.environmentId,
      },
    });
  },
  async run({ evidence }) {
    return runEnvvarRiskWorkflow(evidence);
  },
};
