import { and, desc, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { clusters, deployments, environments, projects } from '@/lib/db/schema'
import { createGitRepository, createKustomization } from '@/lib/flux'
import { createGitHubRepo } from '@/lib/github'
import { createNamespace, createSecret, initK8sClient } from '@/lib/k8s'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const envFilter = url.searchParams.get('env')

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  })

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const query = db
    .select({
      deployment: deployments,
      environmentName: environments.name,
      environmentNamespace: environments.namespace,
    })
    .from(deployments)
    .innerJoin(environments, eq(environments.id, deployments.environmentId))
    .where(eq(deployments.projectId, id))
    .orderBy(desc(deployments.createdAt))

  const result = await query

  const filtered = envFilter ? result.filter((r) => r.environmentName === envFilter) : result

  return NextResponse.json(filtered)
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { environmentId, version, commitSha, commitMessage } = await request.json()

  if (!environmentId) {
    return NextResponse.json({ error: 'Environment ID is required' }, { status: 400 })
  }

  const environment = await db.query.environments.findFirst({
    where: eq(environments.id, environmentId),
  })

  if (!environment || environment.projectId !== id) {
    return NextResponse.json({ error: 'Environment not found' }, { status: 404 })
  }

  const [deployment] = await db
    .insert(deployments)
    .values({
      projectId: id,
      environmentId,
      version: version || '1.0.0',
      commitSha,
      commitMessage,
      status: 'pending',
      deployedById: session.user.id,
    })
    .returning()

  return NextResponse.json(deployment, { status: 201 })
}

export async function triggerDeployment(
  projectId: string,
  environmentId: string,
  commitSha?: string,
) {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  })

  if (!project) {
    throw new Error('Project not found')
  }

  const environment = await db.query.environments.findFirst({
    where: eq(environments.id, environmentId),
  })

  if (!environment || !environment.namespace) {
    throw new Error('Environment not configured')
  }

  const cluster = await db.query.clusters.findFirst({
    where: eq(clusters.id, project.clusterId!),
  })

  if (!cluster) {
    throw new Error('No cluster configured')
  }

  initK8sClient(cluster.kubeconfig)

  const deployment = await db
    .insert(deployments)
    .values({
      projectId,
      environmentId,
      commitSha,
      status: 'deploying',
    })
    .returning()

  try {
    await createNamespace(environment.namespace)

    if (project.gitRepository) {
      await createSecret(
        environment.namespace,
        'git-credentials',
        {
          username: 'x-access-token',
          password: process.env.GITHUB_TOKEN || '',
        },
        'kubernetes.io/basic-auth',
      )

      const [owner, repo] = project.gitRepository.replace('https://github.com/', '').split('/')

      await createGitRepository(project.slug, environment.namespace, {
        url: project.gitRepository,
        ref: { branch: project.gitBranch },
        secretRef: { name: 'git-credentials' },
      })

      await createKustomization(project.slug, environment.namespace, {
        sourceRef: {
          kind: 'GitRepository',
          name: project.slug,
        },
        path: `./k8s/overlays/${environment.name}`,
        prune: true,
        interval: '1m',
      })
    }

    await db
      .update(deployments)
      .set({ status: 'deployed', deployedAt: new Date() })
      .where(eq(deployments.id, deployment[0].id))

    return { success: true, deployment: deployment[0] }
  } catch (error) {
    await db
      .update(deployments)
      .set({ status: 'failed' })
      .where(eq(deployments.id, deployment[0].id))

    throw error
  }
}
