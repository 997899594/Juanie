import { eq } from 'drizzle-orm';
import { parseJuanieConfig } from '@/lib/config/parser';
import { db } from '@/lib/db';
import { projects, repositories, services } from '@/lib/db/schema';
import {
  gateway,
  getTeamIntegrationSession,
} from '@/lib/integrations/service/integration-control-plane';

export async function syncProjectServiceRuntimeContractsFromRepo(input: {
  projectId: string;
  sourceRef?: string | null;
  sourceCommitSha?: string | null;
}) {
  const currentServices = await db.query.services.findMany({
    where: eq(services.projectId, input.projectId),
  });

  if (currentServices.length === 0) {
    return currentServices;
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, input.projectId),
    columns: {
      id: true,
      teamId: true,
      repositoryId: true,
    },
  });

  if (!project?.repositoryId) {
    return currentServices;
  }

  const repository = await db.query.repositories.findFirst({
    where: eq(repositories.id, project.repositoryId),
  });

  if (!repository) {
    return currentServices;
  }

  let session: Awaited<ReturnType<typeof getTeamIntegrationSession>>;
  try {
    session = await getTeamIntegrationSession({
      teamId: project.teamId,
      requiredCapabilities: ['read_repo'],
    });
  } catch (error) {
    console.warn(
      `[Deployment] Could not load integration session for project ${input.projectId}:`,
      error
    );
    return currentServices;
  }

  const configRef = input.sourceCommitSha || input.sourceRef || repository.defaultBranch || 'main';
  let configContent: string | null = null;

  for (const configPath of ['juanie.yaml', 'juanie.yml']) {
    try {
      const content = await gateway.getFileContent(
        session,
        repository.fullName,
        configPath,
        configRef
      );
      if (content) {
        configContent = content;
        break;
      }
    } catch (_error) {
      // Ignore missing config files and keep the last persisted contract.
    }
  }

  if (!configContent) {
    return currentServices;
  }

  const parsed = parseJuanieConfig(configContent);
  if (!parsed.isValid) {
    throw new Error(`Invalid juanie.yaml: ${parsed.errors.join('; ')}`);
  }

  const configServices = new Map(parsed.services.map((service) => [service.name, service]));
  const byId = new Map(currentServices.map((service) => [service.id, service]));

  for (const serviceRecord of currentServices) {
    const serviceConfig = configServices.get(serviceRecord.name);
    if (!serviceConfig) {
      continue;
    }

    const scaling = serviceConfig.scaling ?? null;
    const resources = serviceConfig.resources ?? null;
    const [updated] = await db
      .update(services)
      .set({
        type: serviceConfig.type,
        buildCommand: serviceConfig.build?.command ?? serviceRecord.buildCommand,
        dockerfile: serviceConfig.build?.dockerfile ?? serviceRecord.dockerfile,
        dockerContext: serviceConfig.build?.context ?? serviceRecord.dockerContext,
        startCommand: serviceConfig.run.command,
        port: serviceConfig.run.port ?? serviceRecord.port,
        cronSchedule:
          serviceConfig.type === 'cron'
            ? (serviceConfig.schedule ?? serviceRecord.cronSchedule)
            : null,
        replicas: scaling?.min ?? serviceRecord.replicas ?? 1,
        healthcheckPath: serviceConfig.healthcheck?.path ?? null,
        healthcheckInterval: serviceConfig.healthcheck?.interval ?? 30,
        cpuRequest: resources?.cpuRequest ?? serviceRecord.cpuRequest,
        cpuLimit: resources?.cpuLimit ?? serviceRecord.cpuLimit,
        memoryRequest: resources?.memoryRequest ?? serviceRecord.memoryRequest,
        memoryLimit: resources?.memoryLimit ?? serviceRecord.memoryLimit,
        autoscaling:
          scaling && ((scaling.max ?? 0) > (scaling.min ?? 0) || Boolean(scaling.cpu))
            ? {
                min: scaling.min ?? 1,
                max: scaling.max ?? scaling.min ?? 1,
                cpu: scaling.cpu ?? 80,
              }
            : serviceRecord.autoscaling,
        isPublic: serviceConfig.isPublic ?? serviceRecord.isPublic,
        updatedAt: new Date(),
      })
      .where(eq(services.id, serviceRecord.id))
      .returning();

    byId.set(serviceRecord.id, updated);
  }

  return currentServices.map((service) => byId.get(service.id) ?? service);
}
