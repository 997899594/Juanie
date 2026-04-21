import { resolveManagedPostgresImage } from '@/lib/databases/capabilities';
import { buildNormalizedPostgresUrl } from '@/lib/db/connection-url';

export interface CloudNativePgClusterManifest {
  apiVersion: 'postgresql.cnpg.io/v1';
  kind: 'Cluster';
  metadata: {
    name: string;
    namespace: string;
    labels?: Record<string, string>;
  };
  spec: {
    instances: number;
    imageName: string;
    bootstrap: {
      initdb: {
        database: string;
        owner: string;
        secret: {
          name: string;
        };
      };
    };
    storage: {
      size: string;
    };
    managed: {
      services: {
        disabledDefaultServices: string[];
      };
    };
  };
}

export interface CloudNativePgConnectionDetails {
  serviceName: string;
  host: string;
  port: number;
  databaseName: string;
  username: string;
  connectionString: string;
}

export function buildCloudNativePgClusterManifest(input: {
  name: string;
  namespace: string;
  databaseName: string;
  owner: string;
  credentialsSecretName: string;
  storageSize: string;
  capabilities?: readonly string[] | null;
}): CloudNativePgClusterManifest {
  return {
    apiVersion: 'postgresql.cnpg.io/v1',
    kind: 'Cluster',
    metadata: {
      name: input.name,
      namespace: input.namespace,
      labels: {
        'app.kubernetes.io/managed-by': 'juanie',
        'juanie.dev/database-runtime': 'cloudnativepg',
      },
    },
    spec: {
      instances: 1,
      imageName: resolveManagedPostgresImage(input.capabilities),
      bootstrap: {
        initdb: {
          database: input.databaseName,
          owner: input.owner,
          secret: {
            name: input.credentialsSecretName,
          },
        },
      },
      storage: {
        size: input.storageSize,
      },
      managed: {
        services: {
          disabledDefaultServices: ['ro', 'r'],
        },
      },
    },
  };
}

export function buildCloudNativePgConnectionDetails(input: {
  clusterName: string;
  namespace: string;
  username: string;
  password: string;
  databaseName: string;
}): CloudNativePgConnectionDetails {
  const serviceName = `${input.clusterName}-rw`;
  const host = `${serviceName}.${input.namespace}.svc.cluster.local`;

  return {
    serviceName,
    host,
    port: 5432,
    databaseName: input.databaseName,
    username: input.username,
    connectionString: buildNormalizedPostgresUrl({
      username: input.username,
      password: input.password,
      host,
      port: 5432,
      databaseName: input.databaseName,
    }),
  };
}
