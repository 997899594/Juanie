import { createHash } from 'node:crypto';
import * as k8s from '@kubernetes/client-node';
import {
  buildDbGateConsoleHostname,
  buildDbGateConsoleSlug,
  buildDbGateConsoleUrl,
  type DatabaseConsoleConfig,
  getDbGateConsoleConfig,
  isDbGateSupportedDatabaseType,
} from '@/lib/database-console/dbgate';
import { createDbGateConsoleToken } from '@/lib/database-console/host-auth';
import { getGatewayRouteConfig } from '@/lib/gateway/config';
import {
  createCiliumHTTPRoute,
  deleteCiliumHTTPRoute,
  deleteDeployment,
  deleteSecret,
  deleteService,
  getDeployments,
  getK8sClient,
  upsertSecret,
  upsertService,
  waitForDeploymentReady,
} from '@/lib/k8s';
import { logger } from '@/lib/logger';

export interface DbGateConsoleTarget {
  project: {
    id: string;
    name: string;
  };
  environment: {
    id: string;
    name: string;
  };
  database: {
    id: string;
    name: string;
    type: string;
    connectionString?: string | null;
    databaseName?: string | null;
  };
  actor: {
    email?: string | null;
    name?: string | null;
  };
}

export interface DbGateConsoleResult {
  provider: 'dbgate';
  databaseId: string;
  serviceName: string;
  deploymentName: string;
  hostname: string;
  url: string;
  readonly: boolean;
}

interface ParsedConnection {
  engine: 'postgres' | 'mysql' | 'mongo';
  server: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

const logger_ = logger.child({ module: 'dbgate-console' });
const DBGATE_PORT = 3000;
const DEFAULT_IDLE_TTL_MINUTES = 60;

export const DBGATE_CONSOLE_LABEL_SELECTOR =
  'app.kubernetes.io/name=dbgate,app.kubernetes.io/component=database-console';
export const DBGATE_LAST_OPENED_ANNOTATION = 'juanie.io/last-opened-at';

function stableHash(values: Record<string, string>): string {
  const payload = Object.keys(values)
    .sort()
    .map((key) => `${key}=${values[key]}`)
    .join('\n');

  return createHash('sha256').update(payload).digest('hex').slice(0, 16);
}

function getEngine(type: string): ParsedConnection['engine'] {
  switch (type) {
    case 'postgresql':
      return 'postgres';
    case 'mysql':
      return 'mysql';
    case 'mongodb':
      return 'mongo';
    default:
      throw new Error('当前数据库类型不支持 DbGate 控制台');
  }
}

function getDbGateEnginePlugin(engine: ParsedConnection['engine']): string {
  switch (engine) {
    case 'postgres':
      return 'postgres@dbgate-plugin-postgres';
    case 'mysql':
      return 'mysql@dbgate-plugin-mysql';
    case 'mongo':
      return 'mongo@dbgate-plugin-mongo';
  }
}

function parseConnectionString(input: {
  type: string;
  connectionString: string;
  databaseName?: string | null;
}): ParsedConnection {
  const url = new URL(input.connectionString);
  const engine = getEngine(input.type);
  const defaultPort = engine === 'mysql' ? 3306 : engine === 'mongo' ? 27017 : 5432;
  const databaseFromPath = decodeURIComponent(url.pathname.replace(/^\/+/, '')).trim();
  const database = input.databaseName?.trim() || databaseFromPath;

  if (!url.hostname) {
    throw new Error('数据库连接串缺少 host');
  }

  if ((engine === 'postgres' || engine === 'mysql') && !database) {
    throw new Error('数据库连接串缺少 database name');
  }

  return {
    engine,
    server: url.hostname,
    port: Number(url.port || defaultPort),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
  };
}

export function buildDbGateConsoleResourceNames(databaseId: string): {
  baseName: string;
  secretName: string;
  routeName: string;
} {
  const suffix = buildDbGateConsoleSlug(databaseId).slice(0, 45).replace(/-+$/g, '') || 'database';
  const baseName = `dbgate-${suffix}`;

  return {
    baseName,
    secretName: `${baseName}-connection`,
    routeName: `${baseName}-route`,
  };
}

export function buildDbGateDeployment(input: {
  name: string;
  namespace: string;
  secretName: string;
  connectionHash: string;
  lastOpenedAt: Date;
  image: string;
  readonly: boolean;
  resources: DatabaseConsoleConfig['resources'];
}): k8s.V1Deployment {
  const labels = {
    'app.kubernetes.io/name': 'dbgate',
    'app.kubernetes.io/managed-by': 'juanie',
    'app.kubernetes.io/component': 'database-console',
    'juanie.io/console': input.name,
  };

  return {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: {
      name: input.name,
      namespace: input.namespace,
      labels,
      annotations: {
        [DBGATE_LAST_OPENED_ANNOTATION]: input.lastOpenedAt.toISOString(),
      },
    },
    spec: {
      replicas: 1,
      revisionHistoryLimit: 2,
      selector: {
        matchLabels: {
          'juanie.io/console': input.name,
        },
      },
      template: {
        metadata: {
          labels,
          annotations: {
            'juanie.io/connection-hash': input.connectionHash,
          },
        },
        spec: {
          automountServiceAccountToken: false,
          containers: [
            {
              name: 'dbgate',
              image: input.image,
              imagePullPolicy: 'IfNotPresent',
              ports: [
                {
                  name: 'http',
                  containerPort: DBGATE_PORT,
                  protocol: 'TCP',
                },
              ],
              env: [
                { name: 'SKIP_ALL_AUTH', value: 'true' },
                { name: 'CONNECTIONS', value: 'juanie' },
                { name: 'LABEL_juanie', value: 'Juanie Database' },
                { name: 'SINGLE_CONNECTION', value: 'juanie' },
                {
                  name: 'SINGLE_DATABASE',
                  valueFrom: { secretKeyRef: { name: input.secretName, key: 'database' } },
                },
                { name: 'READONLY_juanie', value: input.readonly ? 'true' : 'false' },
                {
                  name: 'ENGINE_juanie',
                  valueFrom: { secretKeyRef: { name: input.secretName, key: 'enginePlugin' } },
                },
                {
                  name: 'SERVER_juanie',
                  valueFrom: { secretKeyRef: { name: input.secretName, key: 'server' } },
                },
                {
                  name: 'PORT_juanie',
                  valueFrom: { secretKeyRef: { name: input.secretName, key: 'port' } },
                },
                {
                  name: 'USER_juanie',
                  valueFrom: { secretKeyRef: { name: input.secretName, key: 'user' } },
                },
                {
                  name: 'PASSWORD_juanie',
                  valueFrom: { secretKeyRef: { name: input.secretName, key: 'password' } },
                },
                {
                  name: 'DATABASE_juanie',
                  valueFrom: { secretKeyRef: { name: input.secretName, key: 'database' } },
                },
              ],
              readinessProbe: {
                httpGet: { path: '/', port: 'http' },
                initialDelaySeconds: 5,
                periodSeconds: 10,
                timeoutSeconds: 3,
                failureThreshold: 6,
              },
              livenessProbe: {
                httpGet: { path: '/', port: 'http' },
                initialDelaySeconds: 20,
                periodSeconds: 20,
                timeoutSeconds: 3,
                failureThreshold: 3,
              },
              resources: {
                requests: {
                  cpu: input.resources.cpuRequest,
                  memory: input.resources.memoryRequest,
                },
                limits: {
                  cpu: input.resources.cpuLimit,
                  memory: input.resources.memoryLimit,
                },
              },
              securityContext: {
                allowPrivilegeEscalation: false,
                capabilities: { drop: ['ALL'] },
              },
            },
          ],
        },
      },
    },
  };
}

function getDbGateIdleTtlMs(): number {
  const configuredMinutes = Number(process.env.DBGATE_IDLE_TTL_MINUTES ?? DEFAULT_IDLE_TTL_MINUTES);
  const ttlMinutes =
    Number.isFinite(configuredMinutes) && configuredMinutes > 0
      ? configuredMinutes
      : DEFAULT_IDLE_TTL_MINUTES;

  return ttlMinutes * 60 * 1000;
}

export async function cleanupIdleDbGateDatabaseConsoles(
  config = getDbGateConsoleConfig(),
  now = new Date()
): Promise<{
  checked: number;
  deleted: number;
  skipped: number;
  deletedNames: string[];
}> {
  const deployments = await getDeployments(config.namespace, DBGATE_CONSOLE_LABEL_SELECTOR);
  const idleTtlMs = getDbGateIdleTtlMs();
  const nowTime = now.getTime();
  let checked = 0;
  let deleted = 0;
  let skipped = 0;
  const deletedNames: string[] = [];

  for (const deployment of deployments) {
    checked += 1;

    const name = deployment.metadata?.name;
    const openedAtValue = deployment.metadata?.annotations?.[DBGATE_LAST_OPENED_ANNOTATION];
    const openedAt = openedAtValue ? new Date(openedAtValue) : null;

    if (!name || !openedAt || Number.isNaN(openedAt.getTime())) {
      skipped += 1;
      continue;
    }

    if (nowTime - openedAt.getTime() < idleTtlMs) {
      continue;
    }

    const secretName = `${name}-connection`;
    const routeName = `${name}-route`;
    await Promise.all([
      deleteCiliumHTTPRoute(config.routeNamespace, routeName),
      deleteDeployment(config.namespace, name),
      deleteService(config.namespace, name),
      deleteSecret(config.namespace, secretName),
    ]);

    deleted += 1;
    deletedNames.push(name);
  }

  return { checked, deleted, skipped, deletedNames };
}

async function upsertDeployment(input: {
  namespace: string;
  name: string;
  body: k8s.V1Deployment;
}): Promise<void> {
  const { apps } = getK8sClient();
  const maxAttempts = 4;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const current = await apps.readNamespacedDeployment({
        namespace: input.namespace,
        name: input.name,
      });
      await apps.replaceNamespacedDeployment({
        namespace: input.namespace,
        name: input.name,
        body: {
          ...input.body,
          metadata: {
            ...(input.body.metadata ?? {}),
            resourceVersion: current.metadata?.resourceVersion,
          },
        },
      });
      return;
    } catch (error) {
      const candidate = error as { code?: number; statusCode?: number };
      const status = candidate.code ?? candidate.statusCode;

      if (status === 404) {
        await apps.createNamespacedDeployment({
          namespace: input.namespace,
          body: input.body,
        });
        return;
      }

      if (status === 409 && attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 150 * attempt));
        continue;
      }

      throw error;
    }
  }
}

async function upsertDbGateHTTPRoute(input: {
  namespace: string;
  routeName: string;
  hostname: string;
  serviceName: string;
}): Promise<void> {
  const gateway = getGatewayRouteConfig();
  const spec = {
    name: input.routeName,
    namespace: input.namespace,
    gatewayName: gateway.name,
    gatewayNamespace: gateway.namespace,
    sectionName: gateway.wildcardSectionName,
    hostnames: [input.hostname],
    serviceName: input.serviceName,
    servicePort: 80,
    path: '/',
  };

  await deleteCiliumHTTPRoute(input.namespace, input.routeName).catch(() => undefined);
  await createCiliumHTTPRoute(spec);
}

export async function openDbGateDatabaseConsole(
  target: DbGateConsoleTarget,
  config = getDbGateConsoleConfig()
): Promise<DbGateConsoleResult> {
  if (!config.enabled) {
    throw new Error('DbGate 控制台未启用');
  }

  const connectionString = target.database.connectionString?.trim();
  if (!isDbGateSupportedDatabaseType(target.database.type)) {
    throw new Error('当前数据库类型不支持 DbGate 控制台');
  }

  if (!connectionString) {
    throw new Error('当前数据库缺少连接串，不能创建控制台上下文');
  }

  const parsed = parseConnectionString({
    type: target.database.type,
    connectionString,
    databaseName: target.database.databaseName,
  });
  const { baseName, secretName, routeName } = buildDbGateConsoleResourceNames(target.database.id);
  const openedAt = new Date();
  const hostname = buildDbGateConsoleHostname({
    databaseId: target.database.id,
    baseDomain: config.hostnameBaseDomain,
  });
  const token = createDbGateConsoleToken({
    projectId: target.project.id,
    environmentId: target.environment.id,
    databaseId: target.database.id,
    databaseSlug: buildDbGateConsoleSlug(target.database.id),
    actorEmail: target.actor.email ?? null,
    actorName: target.actor.name ?? null,
    expiresAt: new Date(openedAt.getTime() + config.tokenTtlSeconds * 1000),
  });
  const url = buildDbGateConsoleUrl({
    databaseId: target.database.id,
    baseDomain: config.hostnameBaseDomain,
    token,
  });
  const secretData = {
    engine: parsed.engine,
    enginePlugin: getDbGateEnginePlugin(parsed.engine),
    server: parsed.server,
    port: String(parsed.port),
    user: parsed.user,
    password: parsed.password,
    database: parsed.database,
  };
  const connectionHash = stableHash({
    ...secretData,
    image: config.image,
    readonly: String(config.readonly),
    hostname,
  });

  await upsertSecret(config.namespace, secretName, secretData);
  await upsertDeployment({
    namespace: config.namespace,
    name: baseName,
    body: buildDbGateDeployment({
      name: baseName,
      namespace: config.namespace,
      secretName,
      connectionHash,
      lastOpenedAt: openedAt,
      image: config.image,
      readonly: config.readonly,
      resources: config.resources,
    }),
  });
  await upsertService(config.namespace, baseName, {
    port: 80,
    targetPort: 'http',
    selector: { 'juanie.io/console': baseName },
  });
  await upsertDbGateHTTPRoute({
    namespace: config.routeNamespace,
    routeName,
    hostname,
    serviceName: config.gatewayServiceName,
  });
  await waitForDeploymentReady({
    namespace: config.namespace,
    name: baseName,
    timeoutMs: 90_000,
    pollMs: 2_000,
  });

  logger_.info('DbGate database console opened', {
    projectId: target.project.id,
    environmentId: target.environment.id,
    databaseId: target.database.id,
    deploymentName: baseName,
    serviceName: baseName,
    hostname,
    readonly: config.readonly,
  });

  return {
    provider: 'dbgate',
    databaseId: target.database.id,
    serviceName: baseName,
    deploymentName: baseName,
    hostname,
    url,
    readonly: config.readonly,
  };
}
