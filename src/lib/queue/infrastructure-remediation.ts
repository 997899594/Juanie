import { Cron } from 'croner';
import { eq } from 'drizzle-orm';
import { createAuditLog } from '@/lib/audit';
import { db } from '@/lib/db';
import { projects } from '@/lib/db/schema';
import { cleanupStuckTerminatingPods } from '@/lib/k8s';
import { persistLatestEnvironmentReleaseRecap } from '@/lib/releases/recap-service';
import { cleanupRedundantCandidateResources } from '@/lib/releases/workloads';

let infrastructureRemediationRunning = false;

const DEFAULT_PLATFORM_NAMESPACE = process.env.PLATFORM_NAMESPACE?.trim() || 'juanie';

export function startInfrastructureRemediation(): void {
  if (infrastructureRemediationRunning) {
    console.log('[InfraRemediation] Already running');
    return;
  }

  infrastructureRemediationRunning = true;

  new Cron('*/10 * * * *', async () => {
    console.log('[InfraRemediation] Checking for stuck terminating pods...');
    try {
      await remediateInfrastructure();
    } catch (error) {
      console.error('[InfraRemediation] Error:', error);
    }
  });

  console.log('[InfraRemediation] Started (runs every 10 minutes)');
}

async function remediateInfrastructure(): Promise<void> {
  const activeProjects = await db.query.projects.findMany({
    where: eq(projects.status, 'active'),
    columns: {
      id: true,
      teamId: true,
      name: true,
    },
    with: {
      environments: {
        columns: {
          id: true,
          name: true,
          namespace: true,
        },
      },
    },
  });

  for (const project of activeProjects) {
    for (const environment of project.environments) {
      if (!environment.namespace) {
        continue;
      }

      try {
        const podNames = await cleanupStuckTerminatingPods(environment.namespace);
        const candidateNames = await cleanupRedundantCandidateResources(environment.namespace);

        if (podNames.length > 0) {
          await createAuditLog({
            teamId: project.teamId,
            action: 'environment.remediation_triggered',
            resourceType: 'environment',
            resourceId: environment.id,
            metadata: {
              projectId: project.id,
              environmentId: environment.id,
              environmentName: environment.name,
              action: 'cleanup_terminating_pods',
              mode: 'auto',
              podNames,
              podCount: podNames.length,
            },
          });
        }

        if (candidateNames.length > 0) {
          await createAuditLog({
            teamId: project.teamId,
            action: 'environment.remediation_triggered',
            resourceType: 'environment',
            resourceId: environment.id,
            metadata: {
              projectId: project.id,
              environmentId: environment.id,
              environmentName: environment.name,
              action: 'cleanup_candidate_workloads',
              mode: 'auto',
              candidateNames,
              candidateCount: candidateNames.length,
            },
          });
        }

        if (podNames.length > 0 || candidateNames.length > 0) {
          await persistLatestEnvironmentReleaseRecap({
            projectId: project.id,
            environmentId: environment.id,
          }).catch(() => null);
        }

        if (podNames.length > 0) {
          console.log(
            `[InfraRemediation] auto-cleaned ${podNames.length} terminating pod(s) in ${environment.namespace}`
          );
        }
        if (candidateNames.length > 0) {
          console.log(
            `[InfraRemediation] auto-cleaned ${candidateNames.length} redundant candidate workload(s) in ${environment.namespace}`
          );
        }
      } catch (error) {
        console.error(`[InfraRemediation] Failed to remediate ${environment.namespace}:`, error);
      }
    }
  }

  try {
    const platformPods = await cleanupStuckTerminatingPods(DEFAULT_PLATFORM_NAMESPACE);
    if (platformPods.length > 0) {
      console.log(
        `[InfraRemediation] auto-cleaned ${platformPods.length} terminating pod(s) in platform namespace ${DEFAULT_PLATFORM_NAMESPACE}`
      );
    }
  } catch (error) {
    console.error(
      `[InfraRemediation] Failed to remediate platform namespace ${DEFAULT_PLATFORM_NAMESPACE}:`,
      error
    );
  }
}
