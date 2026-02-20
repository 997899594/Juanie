import * as k8s from '@kubernetes/client-node'

let k8sApi: k8s.CoreV1Api | null = null
let appsApi: k8s.AppsV1Api | null = null
let customObjectsApi: k8s.CustomObjectsApi | null = null
let isConnected = false

export function initK8sClient(kubeconfigPath?: string): void {
  const kc = new k8s.KubeConfig()

  if (kubeconfigPath) {
    kc.loadFromFile(kubeconfigPath)
  } else {
    kc.loadFromDefault()
  }

  k8sApi = kc.makeApiClient(k8s.CoreV1Api)
  appsApi = kc.makeApiClient(k8s.AppsV1Api)
  customObjectsApi = kc.makeApiClient(k8s.CustomObjectsApi)
  isConnected = true
}

export function getK8sClient(): {
  core: k8s.CoreV1Api
  apps: k8s.AppsV1Api
  custom: k8s.CustomObjectsApi
  isConnected: boolean
} {
  if (!k8sApi || !appsApi || !customObjectsApi) {
    throw new Error('K8s client not initialized. Call initK8sClient first.')
  }

  return {
    core: k8sApi,
    apps: appsApi,
    custom: customObjectsApi,
    isConnected,
  }
}

export async function createNamespace(name: string): Promise<void> {
  const { core } = getK8sClient()

  try {
    await core.readNamespace(name)
  } catch (e: any) {
    if (e.response?.statusCode === 404) {
      await core.createNamespace({
        apiVersion: 'v1',
        kind: 'Namespace',
        metadata: { name },
      })
    } else {
      throw e
    }
  }
}

export async function deleteNamespace(name: string): Promise<void> {
  const { core } = getK8sClient()

  try {
    await core.deleteNamespace(name)
  } catch (e: any) {
    if (e.response?.statusCode !== 404) {
      throw e
    }
  }
}

export async function getDeployments(namespace: string): Promise<k8s.V1Deployment[]> {
  const { apps } = getK8sClient()

  const result = await apps.listNamespacedDeployment(namespace)
  return result.items
}

export async function getPods(namespace: string, labelSelector?: string): Promise<k8s.V1Pod[]> {
  const { core } = getK8sClient()

  const result = await core.listNamespacedPod(
    namespace,
    undefined,
    undefined,
    undefined,
    labelSelector,
  )
  return result.items
}

export async function getServices(namespace: string): Promise<k8s.V1Service[]> {
  const { core } = getK8sClient()

  const result = await core.listNamespacedService(namespace)
  return result.items
}

export async function getEvents(namespace: string): Promise<k8s.V1Event[]> {
  const { core } = getK8sClient()

  const result = await core.listNamespacedEvent(namespace)
  return result.items
}

export async function getPodLogs(
  namespace: string,
  podName: string,
  containerName?: string,
  tailLines: number = 100,
  follow: boolean = false,
): Promise<ReadableStream<Uint8Array> | string> {
  const { core } = getK8sClient()

  const pod = await core.readNamespacedPod(podName, namespace)
  const containers = pod.spec?.containers || []

  const container = containerName || containers[0]?.name
  if (!container) {
    throw new Error('No container found')
  }

  const result = await core.readNamespacedPodLog(
    namespace,
    podName,
    container,
    undefined,
    undefined,
    undefined,
    undefined,
    tailLines,
    undefined,
    undefined,
    follow,
  )

  if (follow) {
    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        if (typeof result === 'string') {
          controller.enqueue(encoder.encode(result))
        }
        if (result && typeof result.on === 'function') {
          result.on('data', (data: string) => {
            controller.enqueue(encoder.encode(data))
          })
          result.on('end', () => {
            controller.close()
          })
          result.on('error', (err: Error) => {
            controller.error(err)
          })
        }
      },
    })
    return stream
  }

  return result as string
}

export async function getPodContainers(namespace: string, podName: string): Promise<string[]> {
  const { core } = getK8sClient()

  const pod = await core.readNamespacedPod(podName, namespace)
  const containers = pod.spec?.containers || []
  const initContainers = pod.spec?.initContainers || []

  return [
    ...initContainers.map((c) => c.name || ''),
    ...containers.map((c) => c.name || ''),
  ].filter(Boolean)
}

let clusterApi: k8s.Cluster | null = null

export function setClusterApi(api: k8s.Cluster): void {
  clusterApi = api
}

export async function execInPod(
  namespace: string,
  podName: string,
  containerName: string,
  command: string[],
): Promise<string> {
  if (!clusterApi) {
    throw new Error('Cluster API not initialized')
  }

  const { core, apps } = getK8sClient()

  const exec = new k8s.Exec(clusterApi, core, apps, namespace, podName, containerName)

  return new Promise((resolve, reject) => {
    let output = ''
    let errorOutput = ''

    exec.exec(
      command[0],
      command.slice(1),
      undefined,
      (data) => {
        output += data
      },
      (data) => {
        errorOutput += data
      },
      (error) => {
        if (error) {
          reject(error)
        } else {
          resolve(output || errorOutput)
        }
      },
      false,
    )

    setTimeout(() => {
      if (!output && !errorOutput) {
        reject(new Error('Command timed out'))
      }
    }, 30000)
  })
}

export function getIsConnected(): boolean {
  return isConnected
}

export async function createConfigMap(
  namespace: string,
  name: string,
  data: Record<string, string>,
): Promise<void> {
  const { core } = getK8sClient()

  try {
    await core.readNamespacedConfigMap(name, namespace)
  } catch (e: any) {
    if (e.response?.statusCode === 404) {
      await core.createNamespacedConfigMap(namespace, {
        apiVersion: 'v1',
        kind: 'ConfigMap',
        metadata: { name },
        data,
      })
    } else {
      throw e
    }
  }
}

export async function getConfigMaps(namespace: string): Promise<any[]> {
  const { core } = getK8sClient()

  const result = await core.listNamespacedConfigMap(namespace)
  return result.items
}

export async function deleteConfigMap(namespace: string, name: string): Promise<void> {
  const { core } = getK8sClient()

  try {
    await core.deleteNamespacedConfigMap(name, namespace)
  } catch (e: any) {
    if (e.response?.statusCode !== 404) {
      throw e
    }
  }
}

export async function createSecret(
  namespace: string,
  name: string,
  data: Record<string, string>,
  type: string = 'Opaque',
): Promise<void> {
  const { core } = getK8sClient()

  const encodedData: Record<string, string> = {}
  for (const [key, value] of Object.entries(data)) {
    encodedData[key] = Buffer.from(value).toString('base64')
  }

  try {
    await core.readNamespacedSecret(name, namespace)
  } catch (e: any) {
    if (e.response?.statusCode === 404) {
      await core.createNamespacedSecret(namespace, {
        apiVersion: 'v1',
        kind: 'Secret',
        metadata: { name },
        type,
        data: encodedData,
      })
    } else {
      throw e
    }
  }
}

export async function getSecrets(namespace: string): Promise<any[]> {
  const { core } = getK8sClient()

  const result = await core.listNamespacedSecret(namespace)
  return result.items
}

export async function deleteSecret(namespace: string, name: string): Promise<void> {
  const { core } = getK8sClient()

  try {
    await core.deleteNamespacedSecret(name, namespace)
  } catch (e: any) {
    if (e.response?.statusCode !== 404) {
      throw e
    }
  }
}
