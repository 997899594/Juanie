import { getK8sClient } from './k8s'

const FLUX_GIT_REPOSITORY_GROUP = 'source.toolkit.fluxcd.io'
const FLUX_GIT_REPOSITORY_VERSION = 'v1'
const FLUX_KUSTOMIZATION_GROUP = 'kustomize.toolkit.fluxcd.io'
const FLUX_KUSTOMIZATION_VERSION = 'v1'

interface GitRepositorySpec {
  url: string
  ref?: {
    branch?: string
    tag?: string
    semver?: string
  }
  secretRef?: {
    name: string
  }
  interval?: string
}

interface KustomizationSpec {
  sourceRef: {
    kind: string
    name: string
  }
  path?: string
  prune?: boolean
  interval?: string
  targetNamespace?: string
}

export async function createGitRepository(
  name: string,
  namespace: string,
  spec: GitRepositorySpec,
): Promise<void> {
  const { custom } = getK8sClient()

  const existing = await getGitRepository(name, namespace)
  if (existing) {
    return
  }

  await custom.createNamespacedCustomObject(
    FLUX_GIT_REPOSITORY_GROUP,
    FLUX_GIT_REPOSITORY_VERSION,
    namespace,
    'gitrepositories',
    {
      apiVersion: `${FLUX_GIT_REPOSITORY_GROUP}/${FLUX_GIT_REPOSITORY_VERSION}`,
      kind: 'GitRepository',
      metadata: {
        name,
        namespace,
      },
      spec,
    },
  )
}

export async function getGitRepository(name: string, namespace: string): Promise<any | null> {
  const { custom } = getK8sClient()

  try {
    return await custom.getNamespacedCustomObject(
      FLUX_GIT_REPOSITORY_GROUP,
      FLUX_GIT_REPOSITORY_VERSION,
      namespace,
      'gitrepositories',
      name,
    )
  } catch (e: any) {
    if (e.response?.statusCode === 404) {
      return null
    }
    throw e
  }
}

export async function deleteGitRepository(name: string, namespace: string): Promise<void> {
  const { custom } = getK8sClient()

  try {
    await custom.deleteNamespacedCustomObject(
      FLUX_GIT_REPOSITORY_GROUP,
      FLUX_GIT_REPOSITORY_VERSION,
      namespace,
      'gitrepositories',
      name,
    )
  } catch (e: any) {
    if (e.response?.statusCode !== 404) {
      throw e
    }
  }
}

export async function createKustomization(
  name: string,
  namespace: string,
  spec: KustomizationSpec,
): Promise<void> {
  const { custom } = getK8sClient()

  const existing = await getKustomization(name, namespace)
  if (existing) {
    return
  }

  await custom.createNamespacedCustomObject(
    FLUX_KUSTOMIZATION_GROUP,
    FLUX_KUSTOMIZATION_VERSION,
    namespace,
    'kustomizations',
    {
      apiVersion: `${FLUX_KUSTOMIZATION_GROUP}/${FLUX_KUSTOMIZATION_VERSION}`,
      kind: 'Kustomization',
      metadata: {
        name,
        namespace,
      },
      spec: {
        ...spec,
        prune: spec.prune ?? true,
        interval: spec.interval ?? '1m',
      },
    },
  )
}

export async function getKustomization(name: string, namespace: string): Promise<any | null> {
  const { custom } = getK8sClient()

  try {
    return await custom.getNamespacedCustomObject(
      FLUX_KUSTOMIZATION_GROUP,
      FLUX_KUSTOMIZATION_VERSION,
      namespace,
      'kustomizations',
      name,
    )
  } catch (e: any) {
    if (e.response?.statusCode === 404) {
      return null
    }
    throw e
  }
}

export async function deleteKustomization(name: string, namespace: string): Promise<void> {
  const { custom } = getK8sClient()

  try {
    await custom.deleteNamespacedCustomObject(
      FLUX_KUSTOMIZATION_GROUP,
      FLUX_KUSTOMIZATION_VERSION,
      namespace,
      'kustomizations',
      name,
    )
  } catch (e: any) {
    if (e.response?.statusCode !== 404) {
      throw e
    }
  }
}

export async function reconcileKustomization(name: string, namespace: string): Promise<void> {
  const { custom } = getK8sClient()

  const current = await getKustomization(name, namespace)
  if (!current) {
    throw new Error(`Kustomization ${name} not found in ${namespace}`)
  }

  const metadata = current.metadata || {}
  const annotations = metadata.annotations || {}

  await custom.patchNamespacedCustomObject(
    FLUX_KUSTOMIZATION_GROUP,
    FLUX_KUSTOMIZATION_VERSION,
    namespace,
    'kustomizations',
    name,
    {
      metadata: {
        annotations: {
          ...annotations,
          'reconcile.fluxcd.io/requestedAt': new Date().toISOString(),
        },
      },
    },
  )
}

export async function getKustomizationStatus(
  name: string,
  namespace: string,
): Promise<{
  ready: boolean
  lastAppliedRevision?: string
  message?: string
} | null> {
  const kustomization = await getKustomization(name, namespace)

  if (!kustomization) {
    return null
  }

  const status = (kustomization as any).status || {}

  return {
    ready: status.conditions?.some((c: any) => c.type === 'Ready' && c.status === 'True') ?? false,
    lastAppliedRevision: status.lastAppliedRevision,
    message: status.conditions?.find((c: any) => c.type === 'Ready')?.message,
  }
}
