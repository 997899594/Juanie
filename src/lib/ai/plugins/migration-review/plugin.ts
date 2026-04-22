import type { EnvironmentMigrationReviewEvidence } from '@/lib/ai/evidence/environment-migration-review';
import { migrationReviewManifest } from '@/lib/ai/plugins/migration-review/manifest';
import type { AIPlugin } from '@/lib/ai/runtime/types';
import type { MigrationReview } from '@/lib/ai/schemas/migration-review';
import { executeJuanieTool } from '@/lib/ai/tools/runtime';
import { runMigrationReviewWorkflow } from '@/lib/ai/workflows/migration-review';

export const migrationReviewPlugin: AIPlugin<EnvironmentMigrationReviewEvidence, MigrationReview> =
  {
    manifest: migrationReviewManifest,
    async isEnabled() {
      return true;
    },
    async buildEvidence(context) {
      if (!context.projectId || !context.environmentId) {
        throw new Error('migration-review requires projectId and environmentId');
      }

      return executeJuanieTool({
        toolId: 'read-environment-migrations',
        context: {
          actorUserId: context.actorUserId,
          teamId: context.teamId,
          projectId: context.projectId,
          environmentId: context.environmentId,
        },
      });
    },
    async run({ evidence }) {
      return runMigrationReviewWorkflow(evidence);
    },
  };
