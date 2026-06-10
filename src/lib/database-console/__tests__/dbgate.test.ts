import { describe, expect, it } from 'bun:test';
import {
  buildDatabaseConsoleOverview,
  buildDbGateConsoleHostname,
  buildDbGateConsoleUrl,
  buildDbGateDatabaseConsoleLink,
  getDbGateConsoleConfig,
  parseDbGateConsoleHostname,
} from '@/lib/database-console/dbgate';
import {
  buildDbGateConsoleResourceNames,
  buildDbGateDeployment,
} from '@/lib/database-console/dbgate-session';
import {
  createDbGateConsoleToken,
  verifyDbGateConsoleToken,
} from '@/lib/database-console/host-auth';
import { buildRelativeRedirectWithoutToken } from '@/lib/database-console/host-proxy';

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
  it('builds dedicated host URLs per database', () => {
    const config = getDbGateConsoleConfig({
      DATABASE_CONSOLE_ENABLED: 'true',
      DBGATE_HOSTNAME_BASE_DOMAIN: 'juanie.art',
    });

    const link = buildDbGateDatabaseConsoleLink({ config, project, environment, database });

    expect(link?.provider).toBe('dbgate');
    expect(config.routeNamespace).toBe('juanie');
    expect(config.gatewayServiceName).toBe('juanie-web');
    expect(link?.consoleUrl).toBe(
      'https://dbgate-cf13f5b4-5bc7-4c7d-ae5e-d926f38dbe07.juanie.art/'
    );
    expect(link?.context.engine).toBe('postgres');
    expect(
      buildDbGateConsoleUrl({
        databaseId: database.id,
        baseDomain: 'juanie.art',
        token: 'session-token',
      })
    ).toBe('https://dbgate-cf13f5b4-5bc7-4c7d-ae5e-d926f38dbe07.juanie.art/?token=session-token');
  });

  it('parses database console hosts without treating normal app hosts as consoles', () => {
    expect(
      parseDbGateConsoleHostname({
        hostname: 'dbgate-cf13f5b4-5bc7-4c7d-ae5e-d926f38dbe07.juanie.art',
        baseDomain: 'juanie.art',
      })
    ).toEqual({ databaseSlug: 'cf13f5b4-5bc7-4c7d-ae5e-d926f38dbe07' });
    expect(
      parseDbGateConsoleHostname({
        hostname: 'nexusnote-uclhhb.juanie.art',
        baseDomain: 'juanie.art',
      })
    ).toBe(null);
    expect(
      buildDbGateConsoleHostname({ databaseId: database.id, baseDomain: '.juanie.art.' })
    ).toBe('dbgate-cf13f5b4-5bc7-4c7d-ae5e-d926f38dbe07.juanie.art');
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
  it('keeps generated Kubernetes resource names within DNS label limits', () => {
    const names = buildDbGateConsoleResourceNames(
      'cf13f5b4-5bc7-4c7d-ae5e-d926f38dbe07-extra-extra-extra-extra'
    );

    expect(names.baseName.length <= 52).toBe(true);
    expect(names.secretName.length <= 63).toBe(true);
    expect(names.routeName.length <= 63).toBe(true);
    expect(names.secretName.endsWith('-connection')).toBe(true);
    expect(names.routeName.endsWith('-route')).toBe(true);
  });

  it('renders a read-only single-database DbGate deployment at root', () => {
    const deployment = buildDbGateDeployment({
      name: 'dbgate-cf13',
      namespace: 'juanie',
      secretName: 'dbgate-cf13-connection',
      connectionHash: 'abc123',
      lastOpenedAt: new Date('2026-06-09T10:00:00.000Z'),
      image: 'dbgate/dbgate:7.2.0',
      readonly: true,
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
    expect(env.some((item) => item.value?.includes('/api/projects/'))).toBe(false);
    expect(deployment.spec?.template.spec?.containers[0]?.readinessProbe?.httpGet?.path).toBe('/');
    expect(deployment.spec?.template.spec?.containers[0]?.livenessProbe?.httpGet?.path).toBe('/');
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

describe('DbGate database console auth', () => {
  it('signs short-lived console sessions for the matching database host', () => {
    process.env.NEXTAUTH_SECRET = 'test-secret';
    const token = createDbGateConsoleToken({
      projectId: project.id,
      environmentId: environment.id,
      databaseId: database.id,
      databaseSlug: 'cf13f5b4-5bc7-4c7d-ae5e-d926f38dbe07',
      actorEmail: 'dev@example.com',
      actorName: 'Dev',
      expiresAt: new Date('2026-06-09T11:00:00.000Z'),
    });

    const verified = verifyDbGateConsoleToken({
      token,
      databaseSlug: 'cf13f5b4-5bc7-4c7d-ae5e-d926f38dbe07',
      now: new Date('2026-06-09T10:00:00.000Z'),
    });

    expect(verified?.databaseId).toBe(database.id);
    expect(verified?.projectId).toBe(project.id);
    expect(
      verifyDbGateConsoleToken({
        token,
        databaseSlug: 'other-database',
        now: new Date('2026-06-09T10:00:00.000Z'),
      })
    ).toBe(null);
    expect(
      verifyDbGateConsoleToken({
        token,
        databaseSlug: 'cf13f5b4-5bc7-4c7d-ae5e-d926f38dbe07',
        now: new Date('2026-06-09T12:00:00.000Z'),
      })
    ).toBe(null);
  });
});

describe('DbGate database console host gateway', () => {
  it('strips token redirects as relative locations without leaking the internal Next origin', () => {
    expect(
      buildRelativeRedirectWithoutToken({
        path: '/',
        search: '?token=signed-session&theme=dark',
      })
    ).toBe('/?theme=dark');
    expect(
      buildRelativeRedirectWithoutToken({
        path: '/build/app.js',
        search: '?token=signed-session',
      })
    ).toBe('/build/app.js');
  });
});
