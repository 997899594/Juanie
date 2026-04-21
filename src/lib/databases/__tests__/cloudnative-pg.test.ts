import { describe, expect, it } from 'bun:test';
import { resolveManagedPostgresImage } from '@/lib/databases/capabilities';
import {
  buildCloudNativePgClusterManifest,
  buildCloudNativePgConnectionDetails,
} from '@/lib/databases/cloudnative-pg';

describe('cloudnativepg helpers', () => {
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
});
