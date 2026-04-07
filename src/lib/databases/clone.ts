import type { V1Job } from '@kubernetes/client-node';
import { managedPostgresImage } from '@/lib/databases/images';
import {
  createJob,
  createNamespace,
  deleteJob,
  getIsConnected,
  getJob,
  getPodLogs,
  getPods,
} from '@/lib/k8s';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

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
  };
}): Promise<string> {
  if (!getIsConnected() || !input.namespace) {
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
  await deleteJob(namespace, jobName).catch(() => undefined);

  const job: V1Job = {
    apiVersion: 'batch/v1',
    kind: 'Job',
    metadata: {
      name: jobName,
      namespace,
      labels: {
        'app.kubernetes.io/managed-by': 'juanie',
        'juanie.dev/database-clone-id': input.target.id,
      },
    },
    spec: {
      backoffLimit: 0,
      ttlSecondsAfterFinished: 3600,
      template: {
        metadata: {
          labels: {
            'job-name': jobName,
            'juanie.dev/database-clone-id': input.target.id,
          },
        },
        spec: {
          restartPolicy: 'Never',
          containers: [
            {
              name: 'clone',
              image: managedPostgresImage,
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
            },
          ],
        },
      },
    },
  };

  await createJob(namespace, job);

  let finalLogs = '';
  try {
    for (let attempts = 0; attempts < 180; attempts++) {
      const currentJob = await getJob(namespace, jobName);
      const conditions = currentJob.status?.conditions ?? [];
      const pods = await getPods(namespace, `job-name=${jobName}`);
      const podName = pods[0]?.metadata?.name;

      if (podName) {
        finalLogs = await getPodLogs(namespace, podName, undefined, 200).catch(() => finalLogs);
      }

      if (
        conditions.some((condition) => condition.type === 'Complete' && condition.status === 'True')
      ) {
        return finalLogs;
      }

      if (
        conditions.some((condition) => condition.type === 'Failed' && condition.status === 'True')
      ) {
        throw new Error(finalLogs || '预览数据库克隆失败');
      }

      await sleep(2000);
    }

    throw new Error(finalLogs || '预览数据库克隆超时');
  } finally {
    await deleteJob(namespace, jobName).catch(() => undefined);
  }
}
