import type * as k8s from '@kubernetes/client-node';

export const DEPLOYMENT_REVISION_ANNOTATION = 'deployment.kubernetes.io/revision';

function parseRevision(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const revision = Number.parseInt(value, 10);
  return Number.isFinite(revision) ? revision : null;
}

function getRevision(resource: { metadata?: { annotations?: Record<string, string> } }) {
  return parseRevision(resource.metadata?.annotations?.[DEPLOYMENT_REVISION_ANNOTATION]);
}

function getTimestamp(value: string | Date | undefined): number {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function hasLabels(
  labels: Record<string, string | undefined> | undefined
): labels is Record<string, string> {
  return Boolean(labels && Object.keys(labels).length > 0);
}

export function formatK8sLabelSelector(labels: Record<string, string | null | undefined>): string {
  return Object.entries(labels)
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(([key, value]) => `${key}=${value}`)
    .join(',');
}

export function isReplicaSetOwnedByDeployment(
  replicaSet: k8s.V1ReplicaSet,
  deployment: k8s.V1Deployment
): boolean {
  const deploymentName = deployment.metadata?.name;
  if (!deploymentName) {
    return false;
  }

  const deploymentUid = deployment.metadata?.uid;
  return (replicaSet.metadata?.ownerReferences ?? []).some((owner) => {
    if (owner.kind !== 'Deployment' || owner.name !== deploymentName) {
      return false;
    }

    return deploymentUid ? owner.uid === deploymentUid : true;
  });
}

export function selectActiveDeploymentReplicaSet(
  deployment: k8s.V1Deployment,
  replicaSets: k8s.V1ReplicaSet[]
): k8s.V1ReplicaSet | null {
  const ownedReplicaSets = replicaSets.filter((replicaSet) =>
    isReplicaSetOwnedByDeployment(replicaSet, deployment)
  );

  if (ownedReplicaSets.length === 0) {
    return null;
  }

  const deploymentRevision = getRevision(deployment);
  if (deploymentRevision !== null) {
    const matchingRevision = ownedReplicaSets.filter(
      (replicaSet) => getRevision(replicaSet) === deploymentRevision
    );
    if (matchingRevision.length > 0) {
      return matchingRevision.sort(compareReplicaSetRecency)[0] ?? null;
    }
  }

  return ownedReplicaSets.sort(compareReplicaSetRecency)[0] ?? null;
}

function compareReplicaSetRecency(left: k8s.V1ReplicaSet, right: k8s.V1ReplicaSet): number {
  const revisionDelta = (getRevision(right) ?? -1) - (getRevision(left) ?? -1);
  if (revisionDelta !== 0) {
    return revisionDelta;
  }

  return (
    getTimestamp(right.metadata?.creationTimestamp) - getTimestamp(left.metadata?.creationTimestamp)
  );
}

export function getReplicaSetPodLabelSelector(replicaSet: k8s.V1ReplicaSet): string | null {
  const selectorLabels = replicaSet.spec?.selector?.matchLabels;
  if (hasLabels(selectorLabels)) {
    return formatK8sLabelSelector(selectorLabels);
  }

  const templateLabels = replicaSet.spec?.template?.metadata?.labels;
  return hasLabels(templateLabels) ? formatK8sLabelSelector(templateLabels) : null;
}

export function isReplicaSetReadyForDeployment(
  deployment: k8s.V1Deployment,
  replicaSet: k8s.V1ReplicaSet
): boolean {
  const desiredReplicas = deployment.spec?.replicas ?? 1;
  if (desiredReplicas <= 0) {
    return true;
  }

  const readyReplicas = replicaSet.status?.readyReplicas ?? 0;
  const availableReplicas = replicaSet.status?.availableReplicas ?? 0;
  return readyReplicas >= desiredReplicas && availableReplicas >= desiredReplicas;
}

export function describeReplicaSetReadiness(
  deployment: k8s.V1Deployment,
  replicaSet: k8s.V1ReplicaSet | null
): string {
  const desiredReplicas = deployment.spec?.replicas ?? 1;
  if (!replicaSet) {
    return `waiting for current ReplicaSet for ${deployment.metadata?.name ?? 'deployment'}`;
  }

  const name = replicaSet.metadata?.name ?? 'current ReplicaSet';
  const readyReplicas = replicaSet.status?.readyReplicas ?? 0;
  const availableReplicas = replicaSet.status?.availableReplicas ?? 0;
  return `${name} ready ${readyReplicas}/${desiredReplicas}, available ${availableReplicas}/${desiredReplicas}`;
}
