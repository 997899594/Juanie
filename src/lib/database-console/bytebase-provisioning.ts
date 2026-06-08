import { createHash } from 'node:crypto';
import { logger } from '@/lib/logger';

export interface BytebaseProvisioningConfig {
  enabled: boolean;
  workspaceUrl: string | null;
  apiToken: string | null;
  serviceAccountEmail: string | null;
  serviceAccountKey: string | null;
  bootstrapEmail: string | null;
  bootstrapPassword: string | null;
  bootstrapTitle: string;
  oidcClientId: string;
  oidcClientSecret: string;
  oidcIssuer: string | null;
}

export interface BytebaseProvisioningTarget {
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
}

export interface BytebaseProvisioningResult {
  provider: 'bytebase';
  projectId: string;
  environmentId: string;
  instanceId: string;
  databaseName: string;
  url: string;
}

interface BytebaseClientOptions {
  fetchFn?: typeof fetch;
}

type BytebaseEngine = 'POSTGRES' | 'MYSQL';

const provisioningLogger = logger.child({ module: 'bytebase-provisioning' });

function normalizeBaseUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.replace(/\/+$/, '') : null;
}

function normalizeSecret(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed || null;
}

export function getBytebaseProvisioningConfig(
  env: Record<string, string | undefined> = process.env
): BytebaseProvisioningConfig {
  const workspaceUrl = normalizeBaseUrl(env.BYTEBASE_URL ?? env.BYTEBASE_PUBLIC_URL);
  const bootstrapEmail =
    normalizeSecret(env.BYTEBASE_BOOTSTRAP_EMAIL) ??
    `bytebase@${new URL(workspaceUrl ?? env.NEXTAUTH_URL ?? 'https://juanie.local').hostname}`;
  const bootstrapPassword =
    normalizeSecret(env.BYTEBASE_BOOTSTRAP_PASSWORD) ??
    createHash('sha256')
      .update(`bytebase:${env.NEXTAUTH_SECRET ?? 'development-secret'}`)
      .digest('hex');

  return {
    enabled: env.BYTEBASE_ENABLED?.trim().toLowerCase() === 'true',
    workspaceUrl,
    apiToken: normalizeSecret(env.BYTEBASE_API_TOKEN),
    serviceAccountEmail: normalizeSecret(env.BYTEBASE_SERVICE_ACCOUNT_EMAIL) ?? bootstrapEmail,
    serviceAccountKey: normalizeSecret(env.BYTEBASE_SERVICE_ACCOUNT_KEY) ?? bootstrapPassword,
    bootstrapEmail,
    bootstrapPassword,
    bootstrapTitle: normalizeSecret(env.BYTEBASE_BOOTSTRAP_TITLE) ?? 'Juanie Platform',
    oidcClientId: normalizeSecret(env.BYTEBASE_OIDC_CLIENT_ID) ?? 'bytebase',
    oidcClientSecret:
      normalizeSecret(env.BYTEBASE_OIDC_CLIENT_SECRET) ??
      normalizeSecret(env.NEXTAUTH_SECRET) ??
      'development-secret',
    oidcIssuer: normalizeBaseUrl(env.BYTEBASE_OIDC_ISSUER ?? env.NEXTAUTH_URL),
  };
}

function toBytebaseId(value: string, fallback: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 54)
    .replace(/-+$/g, '');

  return normalized || fallback;
}

function getEngine(type: string): BytebaseEngine {
  switch (type) {
    case 'postgresql':
      return 'POSTGRES';
    case 'mysql':
      return 'MYSQL';
    default:
      throw new Error('当前数据库类型不支持 Bytebase 控制台');
  }
}

function parseConnectionString(connectionString: string): {
  host: string;
  port: number;
  username: string;
  password: string;
  databaseName: string;
} {
  const url = new URL(connectionString);
  const databaseName = decodeURIComponent(url.pathname.replace(/^\/+/, '')).trim();

  if (!url.hostname || !url.username || !databaseName) {
    throw new Error('数据库连接串缺少 host、username 或 database name');
  }

  return {
    host: url.hostname,
    port: Number(url.port || (url.protocol.startsWith('mysql') ? 3306 : 5432)),
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    databaseName,
  };
}

async function parseJson(response: Response): Promise<Record<string, unknown>> {
  return ((await response.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
}

function isPermissionDeniedStatus(status: number): boolean {
  return status === 401 || status === 403;
}

class BytebaseProvisioningClient {
  private accessToken: string | null = null;
  private cookie: string | null = null;
  private readonly fetchFn: typeof fetch;

  constructor(
    private readonly config: BytebaseProvisioningConfig,
    options: BytebaseClientOptions = {}
  ) {
    this.fetchFn = options.fetchFn ?? fetch;
  }

  private url(path: string): string {
    if (!this.config.workspaceUrl) {
      throw new Error('BYTEBASE_URL 未配置');
    }

    return `${this.config.workspaceUrl}${path}`;
  }

  private async headers(): Promise<Record<string, string>> {
    await this.ensureAuthenticated();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }

    if (this.cookie) {
      headers.Cookie = this.cookie;
    }

    return headers;
  }

  private async ensureAuthenticated(): Promise<void> {
    if (this.accessToken || this.cookie) {
      return;
    }

    if (this.config.apiToken) {
      this.accessToken = this.config.apiToken;
      return;
    }

    if (!this.config.serviceAccountEmail || !this.config.serviceAccountKey) {
      throw new Error('Bytebase service account 未配置，不能自动创建控制台上下文');
    }

    const response = await this.fetchFn(this.url('/v1/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: this.config.serviceAccountEmail,
        password: this.config.serviceAccountKey,
      }),
    });

    if (!response.ok) {
      if (this.config.bootstrapEmail && this.config.bootstrapPassword) {
        await this.bootstrapFirstAdmin();
        return;
      }

      throw new Error(`Bytebase 登录失败：${response.status}`);
    }

    await this.captureCredentials(response);
  }

  private async bootstrapFirstAdmin(): Promise<void> {
    const response = await this.fetchFn(this.url('/v1/auth/signup'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: this.config.bootstrapEmail,
        password: this.config.bootstrapPassword,
        title: this.config.bootstrapTitle,
      }),
    });

    if (!response.ok) {
      throw new Error(`Bytebase 首次管理员初始化失败：${response.status}`);
    }

    await this.captureCredentials(response);
  }

  private async captureCredentials(response: Response): Promise<void> {
    const payload = await parseJson(response);
    const token = payload.token ?? payload.accessToken;
    const setCookie = response.headers.get('set-cookie');

    if (typeof token === 'string' && token.trim()) {
      this.accessToken = token.trim();
    } else if (setCookie) {
      this.cookie = setCookie;
    } else {
      throw new Error('Bytebase 认证成功但没有返回可用凭证');
    }
  }

  private async get(path: string): Promise<Response> {
    return await this.fetchFn(this.url(path), {
      method: 'GET',
      headers: await this.headers(),
    });
  }

  private async post(path: string, body?: unknown): Promise<Response> {
    return await this.fetchFn(this.url(path), {
      method: 'POST',
      headers: await this.headers(),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  async ensureProject(input: { id: string; title: string }): Promise<void> {
    const existing = await this.get(`/v1/projects/${input.id}`);
    if (existing.ok) {
      return;
    }

    if (existing.status !== 404) {
      throw new Error(`读取 Bytebase project 失败：${existing.status}`);
    }

    const created = await this.post(`/v1/projects?projectId=${encodeURIComponent(input.id)}`, {
      title: input.title,
      key: input.id.slice(0, 20).toUpperCase(),
    });

    if (!created.ok) {
      throw new Error(`创建 Bytebase project 失败：${created.status}`);
    }
  }

  async ensureJuanieOidcProvider(): Promise<void> {
    if (!this.config.oidcIssuer) {
      throw new Error('BYTEBASE_OIDC_ISSUER 或 NEXTAUTH_URL 未配置，不能配置 Bytebase SSO');
    }

    const idpId = 'juanie';
    const existing = await this.get(`/v1/idps/${idpId}`);
    if (existing.ok) {
      return;
    }

    if (isPermissionDeniedStatus(existing.status)) {
      provisioningLogger.warn('Bytebase SSO provider sync skipped because access is denied', {
        status: existing.status,
      });
      return;
    }

    if (existing.status !== 404) {
      throw new Error(`读取 Bytebase SSO provider 失败：${existing.status}`);
    }

    const created = await this.post(`/v1/idps?identityProviderId=${idpId}`, {
      title: 'Juanie',
      type: 'OIDC',
      domain: '',
      config: {
        oidcConfig: {
          issuer: this.config.oidcIssuer,
          clientId: this.config.oidcClientId,
          clientSecret: this.config.oidcClientSecret,
          scopes: ['openid', 'email', 'profile'],
          fieldMapping: {
            identifier: 'email',
            displayName: 'name',
          },
        },
      },
    });

    if (!created.ok) {
      if (isPermissionDeniedStatus(created.status)) {
        provisioningLogger.warn('Bytebase SSO provider creation skipped because access is denied', {
          status: created.status,
        });
        return;
      }

      throw new Error(`创建 Bytebase SSO provider 失败：${created.status}`);
    }
  }

  async ensureEnvironment(input: { id: string; title: string }): Promise<void> {
    const existing = await this.get(`/v1/environments/${input.id}`);
    if (existing.ok) {
      return;
    }

    if (existing.status !== 404) {
      throw new Error(`读取 Bytebase environment 失败：${existing.status}`);
    }

    const created = await this.post(
      `/v1/environments?environmentId=${encodeURIComponent(input.id)}`,
      {
        title: input.title,
      }
    );

    if (!created.ok) {
      throw new Error(`创建 Bytebase environment 失败：${created.status}`);
    }
  }

  async ensureInstance(input: {
    id: string;
    title: string;
    engine: BytebaseEngine;
    environmentId: string;
    connection: ReturnType<typeof parseConnectionString>;
  }): Promise<void> {
    const existing = await this.get(`/v1/instances/${input.id}`);
    if (!existing.ok && existing.status !== 404) {
      throw new Error(`读取 Bytebase instance 失败：${existing.status}`);
    }

    if (existing.status === 404) {
      const created = await this.post(`/v1/instances?instanceId=${encodeURIComponent(input.id)}`, {
        title: input.title,
        engine: input.engine,
        environment: `environments/${input.environmentId}`,
        activation: true,
        dataSources: [
          {
            id: 'admin',
            type: 'ADMIN',
            host: input.connection.host,
            port: input.connection.port,
            username: input.connection.username,
            password: input.connection.password,
            database: input.connection.databaseName,
          },
        ],
      });

      if (!created.ok) {
        throw new Error(`创建 Bytebase instance 失败：${created.status}`);
      }
    }

    const synced = await this.post(`/v1/instances/${input.id}:sync`);
    if (!synced.ok) {
      throw new Error(`同步 Bytebase instance 失败：${synced.status}`);
    }
  }
}

export function buildBytebaseSqlEditorUrl(input: {
  workspaceUrl: string;
  instanceId: string;
  databaseName: string;
}): string {
  const url = new URL('/sql-editor', input.workspaceUrl);
  url.searchParams.set('instance', `instances/${input.instanceId}`);
  url.searchParams.set('database', input.databaseName);
  return url.toString();
}

export async function provisionBytebaseDatabaseConsole(
  target: BytebaseProvisioningTarget,
  config = getBytebaseProvisioningConfig(),
  options: BytebaseClientOptions = {}
): Promise<BytebaseProvisioningResult> {
  if (!config.enabled || !config.workspaceUrl) {
    throw new Error('Bytebase 控制台未启用');
  }

  const connectionString = target.database.connectionString?.trim();
  if (!connectionString) {
    throw new Error('当前数据库缺少连接串，不能创建控制台上下文');
  }

  const engine = getEngine(target.database.type);
  const connection = parseConnectionString(connectionString);
  const projectId = `juanie-${toBytebaseId(target.project.id, 'project')}`;
  const environmentId = `juanie-${toBytebaseId(target.environment.id, 'environment')}`;
  const instanceId = `juanie-${toBytebaseId(target.database.id, 'database')}`;
  const databaseName = target.database.databaseName?.trim() || connection.databaseName;
  const client = new BytebaseProvisioningClient(config, options);

  await client.ensureJuanieOidcProvider();
  await client.ensureProject({
    id: projectId,
    title: target.project.name,
  });
  await client.ensureEnvironment({
    id: environmentId,
    title: `${target.project.name} / ${target.environment.name}`,
  });
  await client.ensureInstance({
    id: instanceId,
    title: `${target.project.name} / ${target.environment.name} / ${target.database.name}`,
    engine,
    environmentId,
    connection,
  });

  provisioningLogger.info('Bytebase database console context synced', {
    projectId: target.project.id,
    environmentId: target.environment.id,
    databaseId: target.database.id,
    bytebaseProjectId: projectId,
    bytebaseInstanceId: instanceId,
  });

  return {
    provider: 'bytebase',
    projectId,
    environmentId,
    instanceId,
    databaseName,
    url: buildBytebaseSqlEditorUrl({
      workspaceUrl: config.workspaceUrl,
      instanceId,
      databaseName,
    }),
  };
}
