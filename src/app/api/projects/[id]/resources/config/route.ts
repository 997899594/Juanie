import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { clusters, environments, projects } from '@/lib/db/schema'
import {
  createConfigMap,
  createSecret,
  deleteConfigMap,
  deleteSecret,
  getConfigMaps,
  getK8sClient,
  getSecrets,
} from '@/lib/k8s'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const resourceType = url.searchParams.get('type') || 'configmaps'
  const environmentId = url.searchParams.get('env')

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  })

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const cluster = await db.query.clusters.findFirst({
    where: eq(clusters.id, project.clusterId || ''),
  })

  if (!cluster) {
    return NextResponse.json({ error: 'No cluster configured' }, { status: 400 })
  }

  let environment = null
  if (environmentId) {
    environment = await db.query.environments.findFirst({
      where: eq(environments.id, environmentId),
    })
  } else {
    const envs = await db.query.environments.findMany({
      where: eq(environments.projectId, id),
    })
    environment = envs[0]
  }

  if (!environment || !environment.namespace) {
    return NextResponse.json({ error: 'Environment not configured' }, { status: 400 })
  }

  try {
    getK8sClient()
    let data: unknown

    switch (resourceType) {
      case 'configmaps':
        data = await getConfigMaps(environment.namespace)
        break
      case 'secrets':
        data = await getSecrets(environment.namespace)
        break
      default:
        return NextResponse.json({ error: 'Invalid resource type' }, { status: 400 })
    }

    return NextResponse.json(data)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { resourceType, name, data, environmentId } = body

  if (!resourceType || !name || !data) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  })

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const cluster = await db.query.clusters.findFirst({
    where: eq(clusters.id, project.clusterId || ''),
  })

  if (!cluster) {
    return NextResponse.json({ error: 'No cluster configured' }, { status: 400 })
  }

  let environment = null
  if (environmentId) {
    environment = await db.query.environments.findFirst({
      where: eq(environments.id, environmentId),
    })
  } else {
    const envs = await db.query.environments.findMany({
      where: eq(environments.projectId, id),
    })
    environment = envs[0]
  }

  if (!environment || !environment.namespace) {
    return NextResponse.json({ error: 'Environment not configured' }, { status: 400 })
  }

  try {
    getK8sClient()

    if (resourceType === 'configmap') {
      await createConfigMap(environment.namespace, name, data)
    } else if (resourceType === 'secret') {
      await createSecret(environment.namespace, name, data)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const resourceType = url.searchParams.get('type') || 'configmap'
  const name = url.searchParams.get('name')
  const environmentId = url.searchParams.get('env')

  if (!name) {
    return NextResponse.json({ error: 'Name required' }, { status: 400 })
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  })

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const cluster = await db.query.clusters.findFirst({
    where: eq(clusters.id, project.clusterId || ''),
  })

  if (!cluster) {
    return NextResponse.json({ error: 'No cluster configured' }, { status: 400 })
  }

  let environment = null
  if (environmentId) {
    environment = await db.query.environments.findFirst({
      where: eq(environments.id, environmentId),
    })
  } else {
    const envs = await db.query.environments.findMany({
      where: eq(environments.projectId, id),
    })
    environment = envs[0]
  }

  if (!environment || !environment.namespace) {
    return NextResponse.json({ error: 'Environment not configured' }, { status: 400 })
  }

  try {
    getK8sClient()

    if (resourceType === 'configmap') {
      await deleteConfigMap(environment.namespace, name)
    } else if (resourceType === 'secret') {
      await deleteSecret(environment.namespace, name)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
