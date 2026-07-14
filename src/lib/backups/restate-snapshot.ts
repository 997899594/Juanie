import * as k8s from '@kubernetes/client-node';

interface VolumeSnapshotList {
  items?: Array<{
    metadata?: { name?: string; creationTimestamp?: string; labels?: Record<string, string> };
  }>;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function positiveInteger(name: string, fallback: number): number {
  const value = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

async function run(): Promise<void> {
  const namespace = process.env.JUANIE_NAMESPACE?.trim() || 'juanie';
  const pvcName = required('RESTATE_SNAPSHOT_PVC_NAME');
  const snapshotClassName = required('RESTATE_SNAPSHOT_CLASS_NAME');
  const retentionCount = positiveInteger('RESTATE_SNAPSHOT_RETENTION_COUNT', 7);
  const name = `juanie-restate-${new Date()
    .toISOString()
    .replace(/[-:TZ.]/gu, '')
    .slice(0, 14)}`;
  const config = new k8s.KubeConfig();
  config.loadFromCluster();
  const client = config.makeApiClient(k8s.CustomObjectsApi);

  await client.createNamespacedCustomObject({
    group: 'snapshot.storage.k8s.io',
    version: 'v1',
    namespace,
    plural: 'volumesnapshots',
    body: {
      apiVersion: 'snapshot.storage.k8s.io/v1',
      kind: 'VolumeSnapshot',
      metadata: {
        name,
        namespace,
        labels: { 'app.kubernetes.io/name': 'juanie', 'juanie.io/backup': 'restate' },
      },
      spec: {
        volumeSnapshotClassName: snapshotClassName,
        source: { persistentVolumeClaimName: pvcName },
      },
    },
  });

  const response = await client.listNamespacedCustomObject({
    group: 'snapshot.storage.k8s.io',
    version: 'v1',
    namespace,
    plural: 'volumesnapshots',
    labelSelector: 'juanie.io/backup=restate',
  });
  const snapshots = ((response as { body?: VolumeSnapshotList }).body?.items ?? [])
    .filter((snapshot) => snapshot.metadata?.name)
    .sort((left, right) =>
      String(right.metadata?.creationTimestamp).localeCompare(
        String(left.metadata?.creationTimestamp)
      )
    );
  for (const snapshot of snapshots.slice(retentionCount)) {
    await client.deleteNamespacedCustomObject({
      group: 'snapshot.storage.k8s.io',
      version: 'v1',
      namespace,
      plural: 'volumesnapshots',
      name: snapshot.metadata?.name as string,
    });
  }
  console.log(
    JSON.stringify({ snapshot: name, deleted: Math.max(0, snapshots.length - retentionCount) })
  );
}

await run();
