import { getK8sClient } from './k8s';

const FLUX_GIT_REPOSITORY_GROUP = 'source.toolkit.fluxcd.io';
const FLUX_GIT_REPOSITORY_VERSION = 'v1';
const FLUX_KUSTOMIZATION_GROUP = 'kustomize.toolkit.fluxcd.io';
const FLUX_KUSTOMIZATION_VERSION = 'v1';

interface GitRepositorySpec {
  url: string;
  ref?: {
    branch?: string;
    tag?: string;
    semver?: string;
  };
  secretRef?: {
    name: string;
  };
  interval?: string;
}

interface KustomizationSpec {
  sourceRef: {
    kind: string;
    name: string;
  };
  path?: string;
  prune?: boolean;
  interval?: string;
  targetNamespace?: string;
}

export async function createGitRepository(
  name: string,
  namespace: string,
  spec: GitRepositorySpec
): Promise<void> {
  const { custom } = getK8sClient();

  const existing = await getGitRepository(name, namespace);
  if (existing) {
    return;
  }

  await custom.createNamespacedCustomObject({
    group: FLUX_GIT_REPOSITORY_GROUP,
    version: FLUX_GIT_REPOSITORY_VERSION,
    namespace,
    plural: 'gitrepositories',
    body: {
      apiVersion: `${FLUX_GIT_REPOSITORY_GROUP}/${FLUX_GIT_REPOSITORY_VERSION}`,
      kind: 'GitRepository',
      metadata: {
        name,
        namespace,
      },
      spec,
    },
  });
}

export async function getGitRepository(name: string, namespace: string): Promise<unknown | null> {
  const { custom } = getK8sClient();

  try {
    const response = await custom.getNamespacedCustomObject({
      group: FLUX_GIT_REPOSITORY_GROUP,
      version: FLUX_GIT_REPOSITORY_VERSION,
      namespace,
      plural: 'gitrepositories',
      name,
    });
    return response;
  } catch (e: unknown) {
    const error = e as { statusCode?: number };
    if (error.statusCode === 404) {
      return null;
    }
    throw e;
  }
}

export async function updateGitRepository(
  name: string,
  namespace: string,
  spec: GitRepositorySpec
): Promise<void> {
  const { custom } = getK8sClient();

  await custom.patchNamespacedCustomObject({
    group: FLUX_GIT_REPOSITORY_GROUP,
    version: FLUX_GIT_REPOSITORY_VERSION,
    namespace,
    plural: 'gitrepositories',
    name,
    body: {
      apiVersion: `${FLUX_GIT_REPOSITORY_GROUP}/${FLUX_GIT_REPOSITORY_VERSION}`,
      kind: 'GitRepository',
      metadata: {
        name,
        namespace,
      },
      spec,
    },
  });
}

export async function deleteGitRepository(name: string, namespace: string): Promise<void> {
  const { custom } = getK8sClient();

  try {
    await custom.deleteNamespacedCustomObject({
      group: FLUX_GIT_REPOSITORY_GROUP,
      version: FLUX_GIT_REPOSITORY_VERSION,
      namespace,
      plural: 'gitrepositories',
      name,
    });
  } catch (e: unknown) {
    const error = e as { statusCode?: number };
    if (error.statusCode !== 404) {
      throw e;
    }
  }
}

export async function createKustomization(
  name: string,
  namespace: string,
  spec: KustomizationSpec
): Promise<void> {
  const { custom } = getK8sClient();

  const existing = await getKustomization(name, namespace);
  if (existing) {
    return;
  }

  await custom.createNamespacedCustomObject({
    group: FLUX_KUSTOMIZATION_GROUP,
    version: FLUX_KUSTOMIZATION_VERSION,
    namespace,
    plural: 'kustomizations',
    body: {
      apiVersion: `${FLUX_KUSTOMIZATION_GROUP}/${FLUX_KUSTOMIZATION_VERSION}`,
      kind: 'Kustomization',
      metadata: {
        name,
        namespace,
      },
      spec,
    },
  });
}

export async function getKustomization(name: string, namespace: string): Promise<unknown | null> {
  const { custom } = getK8sClient();

  try {
    const response = await custom.getNamespacedCustomObject({
      group: FLUX_KUSTOMIZATION_GROUP,
      version: FLUX_KUSTOMIZATION_VERSION,
      namespace,
      plural: 'kustomizations',
      name,
    });
    return response;
  } catch (e: unknown) {
    const error = e as { statusCode?: number };
    if (error.statusCode === 404) {
      return null;
    }
    throw e;
  }
}

export async function updateKustomization(
  name: string,
  namespace: string,
  spec: KustomizationSpec
): Promise<void> {
  const { custom } = getK8sClient();

  await custom.patchNamespacedCustomObject({
    group: FLUX_KUSTOMIZATION_GROUP,
    version: FLUX_KUSTOMIZATION_VERSION,
    namespace,
    plural: 'kustomizations',
    name,
    body: {
      apiVersion: `${FLUX_KUSTOMIZATION_GROUP}/${FLUX_KUSTOMIZATION_VERSION}`,
      kind: 'Kustomization',
      metadata: {
        name,
        namespace,
      },
      spec,
    },
  });
}

export async function deleteKustomization(name: string, namespace: string): Promise<void> {
  const { custom } = getK8sClient();

  try {
    await custom.deleteNamespacedCustomObject({
      group: FLUX_KUSTOMIZATION_GROUP,
      version: FLUX_KUSTOMIZATION_VERSION,
      namespace,
      plural: 'kustomizations',
      name,
    });
  } catch (e: unknown) {
    const error = e as { statusCode?: number };
    if (error.statusCode !== 404) {
      throw e;
    }
  }
}

export async function getKustomizationStatus(
  name: string,
  namespace: string
): Promise<{ ready: boolean; message: string } | null> {
  const kustomization = (await getKustomization(name, namespace)) as {
    status?: {
      conditions?: Array<{
        type: string;
        status: string;
        message?: string;
      }>;
    };
  } | null;

  if (!kustomization) {
    return null;
  }

  const conditions = kustomization.status?.conditions || [];
  const readyCondition = conditions.find((c) => c.type === 'Ready');

  return {
    ready: readyCondition?.status === 'True',
    message: readyCondition?.message || '',
  };
}

export async function reconcileKustomization(name: string, namespace: string): Promise<void> {
  const { custom } = getK8sClient();

  await custom.patchNamespacedCustomObject({
    group: FLUX_KUSTOMIZATION_GROUP,
    version: FLUX_KUSTOMIZATION_VERSION,
    namespace,
    plural: 'kustomizations',
    name,
    body: {
      metadata: {
        annotations: {
          'kustomize.toolkit.fluxcd.io/reconcile': 'now',
        },
      },
    },
  });
}
