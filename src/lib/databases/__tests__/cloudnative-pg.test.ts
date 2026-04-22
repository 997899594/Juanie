import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resolveManagedPostgresImage } from '@/lib/databases/capabilities';
import {
  buildCloudNativePgClusterManifest,
  buildCloudNativePgConnectionDetails,
} from '@/lib/databases/cloudnative-pg';

const ORIGINAL_ENV = { ...process.env };

function resetDatabaseSslEnv() {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.DATABASE_SSL_MODE;
  delete process.env.PGSSLMODE;
}

describe('cloudnativepg helpers', () => {
  beforeEach(() => {
    resetDatabaseSslEnv();
  });

  afterEach(() => {
    resetDatabaseSslEnv();
  });

  it('builds a bootstrap cluster manifest with juanie-managed credentials', () => {
    const manifest = buildCloudNativePgClusterManifest({
      name: 'juanie-demo-db',
      namespace: 'juanie-demo-staging',
      databaseName: 'juanie_demo_app',
      owner: 'juanie_demo_app',
      credentialsSecretName: 'juanie-demo-db-app',
      storageSize: '10Gi',
      capabilities: ['vector'],
    });

    expect(manifest.apiVersion).toBe('postgresql.cnpg.io/v1');
    expect(manifest.kind).toBe('Cluster');
    expect(manifest.spec.imageName).toBe(resolveManagedPostgresImage(['vector']));
    expect(manifest.spec.bootstrap.initdb).toEqual({
      database: 'juanie_demo_app',
      owner: 'juanie_demo_app',
      secret: {
        name: 'juanie-demo-db-app',
      },
    });
    expect(manifest.spec.managed.services.disabledDefaultServices).toEqual(['ro', 'r']);
  });

  it('uses the operator managed rw service for application connections', () => {
    expect(
      buildCloudNativePgConnectionDetails({
        clusterName: 'juanie-demo-db',
        namespace: 'juanie-demo-staging',
        username: 'juanie_demo_app',
        password: 'secret',
        databaseName: 'juanie_demo_app',
      })
    ).toEqual({
      serviceName: 'juanie-demo-db-rw',
      host: 'juanie-demo-db-rw.juanie-demo-staging.svc.cluster.local',
      port: 5432,
      databaseName: 'juanie_demo_app',
      username: 'juanie_demo_app',
      connectionString:
        'postgresql://juanie_demo_app:secret@juanie-demo-db-rw.juanie-demo-staging.svc.cluster.local:5432/juanie_demo_app',
    });
  });

  it('inherits sslmode normalization when postgres ssl env is configured', () => {
    process.env.PGSSLMODE = 'disable';

    expect(
      buildCloudNativePgConnectionDetails({
        clusterName: 'juanie-demo-db',
        namespace: 'juanie-demo-staging',
        username: 'juanie_demo_app',
        password: 'secret',
        databaseName: 'juanie_demo_app',
      }).connectionString
    ).toBe(
      'postgresql://juanie_demo_app:secret@juanie-demo-db-rw.juanie-demo-staging.svc.cluster.local:5432/juanie_demo_app?sslmode=disable'
    );
  });
});
