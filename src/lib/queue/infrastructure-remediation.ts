import { Cron } from 'croner';
import { eq } from 'drizzle-orm';
import { createAuditLog } from '@/lib/audit';
import { db } from '@/lib/db';
import { projects } from '@/lib/db/schema';
import { cleanupStuckTerminatingPods } from '@/lib/k8s';
import { logger } from '@/lib/logger';
import { persistLatestEnvironmentReleaseRecap } from '@/lib/releases/recap-service';
import { cleanupRedundantCandidateResources } from '@/lib/releases/workloads';

let infrastructureRemediationRunning = false;

const DEFAULT_PLATFORM_NAMESPACE = process.env.PLATFORM_NAMESPACE?.trim() || 'juanie';
const infrastructureRemediationLogger = logger.child({
  component: 'infrastructure-remediation',
});

export function startInfrastructureRemediation(): void {
  if (infrastructureRemediationRunning) {
    infrastructureRemediationLogger.info('Infrastructure remediation already running');
    return;
  }

  infrastructureRemediationRunning = true;

  new Cron('*/10 * * * *', async () => {
    infrastructureRemediationLogger.info('Checking infrastructure remediation targets');
    try {
      await remediateInfrastructure();
    } catch (error) {
      infrastructureRemediationLogger.error('Infrastructure remediation failed', error);
    }
  });

  infrastructureRemediationLogger.info('Infrastructure remediation started', {
    schedule: '*/10 * * * *',
  });
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
          infrastructureRemediationLogger.info('Auto-cleaned terminating pods', {
            namespace: environment.namespace,
            podCount: podNames.length,
            podNames,
            projectId: project.id,
            environmentId: environment.id,
          });
        }
        if (candidateNames.length > 0) {
          infrastructureRemediationLogger.info('Auto-cleaned redundant candidate workloads', {
            namespace: environment.namespace,
            candidateCount: candidateNames.length,
            candidateNames,
            projectId: project.id,
            environmentId: environment.id,
          });
        }
      } catch (error) {
        infrastructureRemediationLogger.error('Failed to remediate environment namespace', error, {
          namespace: environment.namespace,
          projectId: project.id,
          environmentId: environment.id,
        });
      }
    }
  }

  try {
    const platformPods = await cleanupStuckTerminatingPods(DEFAULT_PLATFORM_NAMESPACE);
    if (platformPods.length > 0) {
      infrastructureRemediationLogger.info('Auto-cleaned terminating pods in platform namespace', {
        namespace: DEFAULT_PLATFORM_NAMESPACE,
        podCount: platformPods.length,
        podNames: platformPods,
      });
    }
  } catch (error) {
    infrastructureRemediationLogger.error('Failed to remediate platform namespace', error, {
      namespace: DEFAULT_PLATFORM_NAMESPACE,
    });
  }
}
