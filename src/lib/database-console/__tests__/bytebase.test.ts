import { describe, expect, it } from 'bun:test';
import {
  buildBytebaseDatabaseConsoleLink,
  getBytebaseConsoleConfig,
} from '@/lib/database-console/bytebase';

const project = { id: 'project-1', name: 'nexusnote' };
const environment = { id: 'env-1', name: 'staging' };
const database = {
  id: 'database-1',
  name: 'primary',
  type: 'postgresql',
  host: 'primary-rw.namespace.svc.cluster.local',
  port: 5432,
  databaseName: 'nexusnote',
  namespace: 'juanie-nexusnote-staging',
  serviceName: 'primary-rw',
};

describe('Bytebase database console config', () => {
  it('stays disabled without a public URL', () => {
    const config = getBytebaseConsoleConfig({});

    expect(config.enabled).toBe(false);
    expect(buildBytebaseDatabaseConsoleLink({ config, project, environment, database })).toBe(null);
  });

  it('uses the SQL editor as the default database console entry', () => {
    const config = getBytebaseConsoleConfig({
      BYTEBASE_ENABLED: 'true',
      BYTEBASE_URL: 'https://bytebase.juanie.art/',
    });
    const link = buildBytebaseDatabaseConsoleLink({ config, project, environment, database });

    expect(config.enabled).toBe(true);
    expect(link?.databaseUrl).toBe('https://bytebase.juanie.art/sql-editor');
    expect(link?.context.target).toBe('nexusnote');
  });

  it('supports operator-provided Bytebase deep link templates', () => {
    const config = getBytebaseConsoleConfig({
      BYTEBASE_URL: 'https://bytebase.juanie.art',
      BYTEBASE_DATABASE_URL_TEMPLATE:
        '{workspaceUrl}/projects/{projectName}/environments/{environmentName}/databases/{databaseName}',
    });
    const link = buildBytebaseDatabaseConsoleLink({ config, project, environment, database });

    expect(link?.databaseUrl).toBe(
      'https://bytebase.juanie.art/projects/nexusnote/environments/staging/databases/nexusnote'
    );
  });

  it('lets an explicit false flag hide the console even when URL is configured', () => {
    const config = getBytebaseConsoleConfig({
      BYTEBASE_ENABLED: 'false',
      BYTEBASE_URL: 'https://bytebase.juanie.art',
    });

    expect(config.enabled).toBe(false);
  });

  it('does not expose Bytebase links for unsupported database types', () => {
    const config = getBytebaseConsoleConfig({
      BYTEBASE_ENABLED: 'true',
      BYTEBASE_URL: 'https://bytebase.juanie.art',
    });

    expect(
      buildBytebaseDatabaseConsoleLink({
        config,
        project,
        environment,
        database: {
          ...database,
          type: 'redis',
        },
      })
    ).toBe(null);
  });
});
