import { resolveManagedPostgresImage } from '@/lib/databases/capabilities';
import {
  buildPlatformOperationJob,
  createNamespace,
  deletePlatformOperationJob,
  isK8sAvailable,
  submitPlatformOperationJob,
  waitForPlatformOperationJob,
} from '@/lib/k8s';

export async function clonePostgreSQLDatabase(input: {
  namespace: string | null;
  source: {
    id: string;
    name: string;
    type: string;
    connectionString: string | null;
  };
  target: {
    id: string;
    name: string;
    type: string;
    connectionString: string | null;
    capabilities?: string[] | null;
  };
}): Promise<string> {
  if (!isK8sAvailable() || !input.namespace) {
    throw new Error('独立预览库当前需要 Kubernetes 连接和环境命名空间');
  }

  if (input.source.type !== 'postgresql' || input.target.type !== 'postgresql') {
    throw new Error('独立预览库当前只支持 PostgreSQL');
  }

  if (!input.source.connectionString || !input.target.connectionString) {
    throw new Error('源数据库或目标数据库缺少连接信息，无法执行数据克隆');
  }

  const jobName = `db-clone-${input.target.id.slice(0, 8)}`;
  const namespace = input.namespace;

  await createNamespace(namespace);

  const job = buildPlatformOperationJob({
    namespace,
    name: jobName,
    component: 'database-clone',
    labels: {
      'juanie.dev/database-clone-id': input.target.id,
    },
    ttlSecondsAfterFinished: 3600,
    containers: [
      {
        name: 'clone',
        image: resolveManagedPostgresImage(input.target.capabilities),
        command: ['/bin/sh', '-lc'],
        args: [
          [
            'set -euo pipefail',
            'pg_dump --clean --if-exists --no-owner --no-privileges "$SOURCE_DATABASE_URL" | psql "$TARGET_DATABASE_URL"',
          ].join(' && '),
        ],
        env: [
          {
            name: 'SOURCE_DATABASE_URL',
            value: input.source.connectionString,
          },
          {
            name: 'TARGET_DATABASE_URL',
            value: input.target.connectionString,
          },
        ],
        securityContext: {
          allowPrivilegeEscalation: false,
          capabilities: {
            drop: ['ALL'],
          },
        },
      },
    ],
  });

  await submitPlatformOperationJob({
    namespace,
    job,
    replaceExisting: true,
  });

  try {
    const snapshot = await waitForPlatformOperationJob({
      namespace,
      name: jobName,
      containerName: 'clone',
      timeoutMs: 360_000,
      timeoutMessage: '预览数据库克隆超时',
      pollIntervalMs: 2_000,
      tailLines: 200,
    });

    if (snapshot.status === 'succeeded') {
      return snapshot.logs ?? '';
    }

    throw new Error(snapshot.logs ?? snapshot.message ?? '预览数据库克隆失败');
  } finally {
    await deletePlatformOperationJob({
      namespace,
      name: jobName,
    }).catch(() => undefined);
  }
}
