import { describe, expect, it } from 'bun:test';
import {
  buildDatabaseConsoleOverview,
  buildDbGateConsoleUrl,
  buildDbGateDatabaseConsoleLink,
  getDbGateConsoleConfig,
} from '@/lib/database-console/dbgate';
import { buildDbGateDeployment } from '@/lib/database-console/dbgate-session';
import { buildDbGateUpstreamPath } from '@/lib/database-console/proxy-route';

const project = { id: 'project-1', name: 'nexusnote' };
const environment = { id: 'env-1', name: 'production' };
const database = {
  id: 'cf13f5b4-5bc7-4c7d-ae5e-d926f38dbe07',
  name: 'postgres',
  type: 'postgresql',
  host: 'postgres.prod.svc.cluster.local',
  port: 5432,
  databaseName: 'nexusnote_prod',
  namespace: 'nexusnote-prod',
  serviceName: 'postgres-rw',
};

describe('DbGate database console config', () => {
  it('builds Juanie-authenticated proxy URLs per database', () => {
    const config = getDbGateConsoleConfig({
      DATABASE_CONSOLE_ENABLED: 'true',
    });

    const link = buildDbGateDatabaseConsoleLink({ config, project, environment, database });

    expect(link?.provider).toBe('dbgate');
    expect(link?.consoleUrl).toBe(
      `/api/projects/${project.id}/databases/${database.id}/console/proxy/`
    );
    expect(link?.context.engine).toBe('postgres');
    expect(buildDbGateConsoleUrl({ projectId: project.id, databaseId: database.id })).toBe(
      `/api/projects/${project.id}/databases/${database.id}/console/proxy/`
    );
  });

  it('builds overview metadata without exposing raw workspace URLs', () => {
    const config = getDbGateConsoleConfig({
      DATABASE_CONSOLE_ENABLED: 'true',
    });
    expect(buildDatabaseConsoleOverview(config).provider).toBe('dbgate');
  });

  it('does not expose links when disabled or unsupported', () => {
    const disabled = getDbGateConsoleConfig({
      DATABASE_CONSOLE_ENABLED: 'false',
    });

    expect(
      buildDbGateDatabaseConsoleLink({ config: disabled, project, environment, database })
    ).toBe(null);
    expect(
      buildDbGateDatabaseConsoleLink({
        config: getDbGateConsoleConfig({
          DATABASE_CONSOLE_ENABLED: 'true',
        }),
        project,
        environment,
        database: { ...database, type: 'sqlite' },
      })
    ).toBe(null);
    expect(
      buildDbGateDatabaseConsoleLink({
        config: getDbGateConsoleConfig({
          DATABASE_CONSOLE_ENABLED: 'true',
        }),
        project,
        environment,
        database: { ...database, type: 'redis' },
      })
    ).toBe(null);
  });
});

describe('DbGate database console session', () => {
  it('renders a read-only single-database DbGate deployment', () => {
    const deployment = buildDbGateDeployment({
      name: 'dbgate-cf13',
      namespace: 'juanie',
      secretName: 'dbgate-cf13-connection',
      connectionHash: 'abc123',
      lastOpenedAt: new Date('2026-06-09T10:00:00.000Z'),
      image: 'dbgate/dbgate:7.2.0',
      readonly: true,
      webRoot: '/api/projects/project-1/databases/db-1/console/proxy/',
      resources: {
        cpuRequest: '50m',
        cpuLimit: '500m',
        memoryRequest: '128Mi',
        memoryLimit: '512Mi',
      },
    });
    const env = deployment.spec?.template.spec?.containers[0]?.env ?? [];
    const annotations = deployment.metadata?.annotations ?? {};
    const templateAnnotations = deployment.spec?.template.metadata?.annotations ?? {};

    expect(annotations['juanie.io/last-opened-at']).toBe('2026-06-09T10:00:00.000Z');
    expect(templateAnnotations['juanie.io/connection-hash']).toBe('abc123');
    expect(env.some((item) => item.name === 'SINGLE_CONNECTION' && item.value === 'juanie')).toBe(
      true
    );
    expect(env.some((item) => item.name === 'READONLY_juanie' && item.value === 'true')).toBe(true);
    expect(
      env.some(
        (item) =>
          item.name === 'WEB_ROOT' &&
          item.value === '/api/projects/project-1/databases/db-1/console/proxy/'
      )
    ).toBe(true);
    expect(deployment.spec?.template.spec?.containers[0]?.readinessProbe?.httpGet?.path).toBe(
      '/api/projects/project-1/databases/db-1/console/proxy/'
    );
    expect(deployment.spec?.template.spec?.containers[0]?.livenessProbe?.httpGet?.path).toBe(
      '/api/projects/project-1/databases/db-1/console/proxy/'
    );
    expect(
      env.some(
        (item) =>
          item.name === 'SINGLE_DATABASE' &&
          item.valueFrom?.secretKeyRef?.name === 'dbgate-cf13-connection' &&
          item.valueFrom.secretKeyRef.key === 'database'
      )
    ).toBe(true);
    expect(
      env.some(
        (item) =>
          item.name === 'ENGINE_juanie' &&
          item.valueFrom?.secretKeyRef?.name === 'dbgate-cf13-connection' &&
          item.valueFrom.secretKeyRef.key === 'enginePlugin'
      )
    ).toBe(true);
  });
});

describe('DbGate database console proxy', () => {
  it('keeps the public proxy prefix when forwarding to a WEB_ROOT-scoped DbGate', () => {
    expect(
      buildDbGateUpstreamPath({
        projectId: project.id,
        databaseId: database.id,
        requestUrl: 'https://juanie.art/api/projects/project-1/databases/db-1/console/proxy/',
      })
    ).toBe('/api/projects/project-1/databases/cf13f5b4-5bc7-4c7d-ae5e-d926f38dbe07/console/proxy/');

    expect(
      buildDbGateUpstreamPath({
        projectId: project.id,
        databaseId: database.id,
        pathSegments: ['assets', 'main.js'],
        requestUrl:
          'https://juanie.art/api/projects/project-1/databases/db-1/console/proxy/assets/main.js?v=1',
      })
    ).toBe(
      '/api/projects/project-1/databases/cf13f5b4-5bc7-4c7d-ae5e-d926f38dbe07/console/proxy/assets/main.js?v=1'
    );
  });
});
