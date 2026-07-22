export const restateServiceNames = {
  projectInitialization: 'ProjectInitializationWorkflow',
  release: 'ReleaseWorkflow',
  migration: 'MigrationWorkflow',
  schemaRepair: 'SchemaRepairWorkflow',
  projectDeletion: 'ProjectDeletionWorkflow',
  environmentRuntime: 'EnvironmentRuntimeWorkflow',
  deployment: 'DeploymentWorkflow',
  sourceDelivery: 'SourceDeliveryWorkflow',
} as const;

export interface RestateInvocationTarget {
  service: string;
  handler: string;
  key?: string;
  oneWay?: boolean;
  idempotencyMode: 'workflow-key' | 'request-header';
}

export function getRestateIngressUrl(): string {
  return (process.env.RESTATE_INGRESS_URL ?? 'http://localhost:8080').replace(/\/$/u, '');
}

export function getRestateServicePort(): number {
  const port = Number.parseInt(process.env.RESTATE_SERVICE_PORT ?? '9080', 10);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new Error('RESTATE_SERVICE_PORT must be a valid TCP port');
  }
  return port;
}

export function buildRestateInvocationUrl(
  ingressUrl: string,
  target: RestateInvocationTarget
): string {
  const segments = [target.service, target.key, target.handler, target.oneWay ? 'send' : null]
    .filter((value): value is string => Boolean(value))
    .map(encodeURIComponent);
  return `${ingressUrl.replace(/\/$/u, '')}/${segments.join('/')}`;
}
