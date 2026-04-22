import type { ReleaseEvidencePack } from '@/lib/ai/evidence/release-evidence';
import { releaseIntelligenceManifest } from '@/lib/ai/plugins/release-intelligence/manifest';
import type { AIPlugin } from '@/lib/ai/runtime/types';
import type { ReleasePlan } from '@/lib/ai/schemas/release-plan';
import { executeJuanieTool } from '@/lib/ai/tools/runtime';
import { runReleasePlanWorkflow } from '@/lib/ai/workflows/release-plan';

export const releaseIntelligencePlugin: AIPlugin<ReleaseEvidencePack, ReleasePlan> = {
  manifest: releaseIntelligenceManifest,
  async isEnabled() {
    return true;
  },
  async buildEvidence(context) {
    if (!context.projectId || !context.releaseId) {
      throw new Error('release-intelligence requires projectId and releaseId');
    }

    return executeJuanieTool({
      toolId: 'read-release-context',
      context: {
        actorUserId: context.actorUserId,
        teamId: context.teamId,
        projectId: context.projectId,
        releaseId: context.releaseId,
      },
    });
  },
  async run({ evidence }) {
    return runReleasePlanWorkflow(evidence);
  },
};
