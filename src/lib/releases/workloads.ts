import {
  createDeployment,
  type DeploymentSnapshot,
  deleteDeployment,
  deleteService,
  updateDeployment,
  upsertService,
  verifyServiceReachability,
  waitForDeploymentReady,
} from '@/lib/k8s';
import { syncEnvironmentServiceTrafficRoutes } from '@/lib/releases/traffic';

export interface ReleaseWorkloadServiceLike {
  id: string;
  name: string;
  type: string;
  isPublic?: boolean | null;
  port?: number | null;
  replicas?: number | null;
  healthcheckPath?: string | null;
  cpuRequest?: string | null;
  cpuLimit?: string | null;
  memoryRequest?: string | null;
  memoryLimit?: string | null;
}

export interface WorkloadEnvFromRef {
  secretRef?: { name: string };
  configMapRef?: { name: string };
}

export type ProgressiveDeploymentStrategy = 'controlled' | 'canary' | 'blue_green';

export interface TrafficBackendRef {
  serviceName: string;
  servicePort: number;
  weight?: number;
}

export function buildServiceVerificationPaths(service: {
  type: string;
  isPublic?: boolean | null;
  healthcheckPath?: string | null;
}) {
  if (service.type !== 'web') {
    return [];
  }

  const paths = new Set<string>();

  if (service.healthcheckPath) {
    paths.add(service.healthcheckPath);
  } else {
    paths.add('/api/health/ready');
  }

  if (service.isPublic !== false) {
    paths.add('/');
  }

  return Array.from(paths);
}

export function isProgressiveStrategy(
  strategy?: 'rolling' | 'controlled' | 'canary' | 'blue_green' | null
): strategy is ProgressiveDeploymentStrategy {
  return strategy === 'controlled' || strategy === 'canary' || strategy === 'blue_green';
}

export function buildTrafficBackends(input: {
  strategy: ProgressiveDeploymentStrategy;
  stableExists: boolean;
  stableName: string;
  candidateName: string;
  servicePort: number;
}) {
  if (!input.stableExists) {
    return [
      {
        serviceName: input.candidateName,
        servicePort: input.servicePort,
        weight: 100,
      },
    ];
  }

  if (input.strategy === 'canary') {
    return [
      {
        serviceName: input.stableName,
        servicePort: input.servicePort,
        weight: 90,
      },
      {
        serviceName: input.candidateName,
        servicePort: input.servicePort,
        weight: 10,
      },
    ];
  }

  if (input.strategy === 'blue_green') {
    return [
      {
        serviceName: input.candidateName,
        servicePort: input.servicePort,
        weight: 100,
      },
    ];
  }

  return [
    {
      serviceName: input.stableName,
      servicePort: input.servicePort,
      weight: 100,
    },
  ];
}

export async function ensureServiceResource(namespace: string, name: string, port: number) {
  await upsertService(namespace, name, {
    port,
    targetPort: port,
    selector: { app: name },
  });
}

export async function cleanupCandidateResources(namespace: string, candidateName: string) {
  await deleteDeployment(namespace, candidateName).catch(() => undefined);
  await deleteService(namespace, candidateName).catch(() => undefined);
}

export async function upsertServiceWorkload(input: {
  namespace: string;
  resourceName: string;
  imageName: string;
  service: ReleaseWorkloadServiceLike;
  envFrom: WorkloadEnvFromRef[];
  imagePullSecrets?: string[];
  creationLabel?: string;
  onLog?: (message: string) => Promise<void>;
}) {
  try {
    await updateDeployment(input.namespace, input.resourceName, {
      image: input.imageName,
      port: input.service.port ?? 3000,
      envFrom: input.envFrom,
      imagePullSecrets: input.imagePullSecrets,
      healthcheckPath: input.service.healthcheckPath ?? undefined,
      cpuRequest: input.service.cpuRequest ?? undefined,
      cpuLimit: input.service.cpuLimit ?? undefined,
      memoryRequest: input.service.memoryRequest ?? undefined,
      memoryLimit: input.service.memoryLimit ?? undefined,
    });
    await input.onLog?.(`Updated ${input.resourceName} → ${input.imageName}`);
  } catch {
    await input.onLog?.(
      `${input.resourceName} not found, creating ${input.creationLabel ?? 'deployment'}`
    );
    await createDeployment(input.namespace, input.resourceName, {
      image: input.imageName,
      port: input.service.port ?? 3000,
      replicas: input.service.replicas ?? 1,
      envFrom: input.envFrom,
      imagePullSecrets: input.imagePullSecrets,
      healthcheckPath: input.service.healthcheckPath ?? undefined,
      cpuRequest: input.service.cpuRequest ?? undefined,
      cpuLimit: input.service.cpuLimit ?? undefined,
      memoryRequest: input.service.memoryRequest ?? undefined,
      memoryLimit: input.service.memoryLimit ?? undefined,
    });
    await input.onLog?.(`Created ${input.resourceName} → ${input.imageName}`);
  }

  await waitForDeploymentReady({
    namespace: input.namespace,
    name: input.resourceName,
  });
}

export async function verifyServiceWorkload(input: {
  namespace: string;
  resourceName: string;
  port: number;
  verificationPaths: string[];
  onLog?: (message: string) => Promise<void>;
}) {
  if (input.verificationPaths.length === 0) {
    return;
  }

  await verifyServiceReachability({
    namespace: input.namespace,
    serviceName: input.resourceName,
    port: input.port,
    paths: input.verificationPaths,
  });
  await input.onLog?.(`Verified ${input.resourceName} on ${input.verificationPaths.join(', ')}`);
}

export async function deployCandidateWorkload(input: {
  namespace: string;
  candidateName: string;
  imageName: string;
  service: ReleaseWorkloadServiceLike;
  envFrom: WorkloadEnvFromRef[];
  imagePullSecrets?: string[];
  verificationPaths: string[];
  onLog?: (message: string) => Promise<void>;
}) {
  await ensureServiceResource(input.namespace, input.candidateName, input.service.port ?? 3000);
  await upsertServiceWorkload({
    namespace: input.namespace,
    resourceName: input.candidateName,
    imageName: input.imageName,
    service: input.service,
    envFrom: input.envFrom,
    imagePullSecrets: input.imagePullSecrets,
    creationLabel: 'candidate deployment',
    onLog: input.onLog,
  });
  await verifyServiceWorkload({
    namespace: input.namespace,
    resourceName: input.candidateName,
    port: input.service.port ?? 3000,
    verificationPaths: input.verificationPaths,
    onLog: input.onLog,
  });
}

export async function promoteCandidateSnapshotToStable(input: {
  namespace: string;
  projectSlug: string;
  environmentId: string;
  service: ReleaseWorkloadServiceLike;
  stableName: string;
  candidateName: string;
  snapshot: DeploymentSnapshot;
  stableExists: boolean;
  candidateVerified: boolean;
  onLog?: (message: string) => Promise<void>;
}) {
  await ensureServiceResource(input.namespace, input.stableName, input.snapshot.port);

  if (input.stableExists) {
    await updateDeployment(input.namespace, input.stableName, {
      image: input.snapshot.image ?? undefined,
      port: input.snapshot.port,
      envFrom: input.snapshot.envFrom,
      replicas: input.snapshot.replicas,
      imagePullSecrets: input.snapshot.imagePullSecrets,
      healthcheckPath: input.service.healthcheckPath ?? undefined,
      cpuRequest: input.snapshot.cpuRequest,
      cpuLimit: input.snapshot.cpuLimit,
      memoryRequest: input.snapshot.memoryRequest,
      memoryLimit: input.snapshot.memoryLimit,
    });
    await input.onLog?.(`Updated ${input.stableName} → ${input.snapshot.image}`);
  } else if (input.snapshot.image) {
    await createDeployment(input.namespace, input.stableName, {
      image: input.snapshot.image,
      port: input.snapshot.port,
      replicas: input.snapshot.replicas,
      envFrom: input.snapshot.envFrom,
      imagePullSecrets: input.snapshot.imagePullSecrets,
      healthcheckPath: input.service.healthcheckPath ?? undefined,
      cpuRequest: input.snapshot.cpuRequest,
      cpuLimit: input.snapshot.cpuLimit,
      memoryRequest: input.snapshot.memoryRequest,
      memoryLimit: input.snapshot.memoryLimit,
    });
    await input.onLog?.(`Created ${input.stableName} → ${input.snapshot.image}`);
  }

  await waitForDeploymentReady({
    namespace: input.namespace,
    name: input.stableName,
  });

  if (input.candidateVerified) {
    await input.onLog?.(
      `Promoted verified candidate to ${input.stableName} without redundant post-promote HTTP verification`
    );
  }

  await syncEnvironmentServiceTrafficRoutes({
    projectSlug: input.projectSlug,
    environmentId: input.environmentId,
    namespace: input.namespace,
    service: input.service,
    backends: [
      {
        serviceName: input.stableName,
        servicePort: input.service.port ?? input.snapshot.port,
        weight: 100,
      },
    ],
  });

  await cleanupCandidateResources(input.namespace, input.candidateName);
}
