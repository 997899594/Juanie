import { and, eq, inArray } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { clusters, environments, projectInitializationSteps, projects } from '@/lib/db/schema'
import { createGitRepository, createKustomization } from '@/lib/flux'
import { createNamespace, initK8sClient } from '@/lib/k8s'

const STEP_HANDLERS: Record<string, (projectId: string) => Promise<void>> = {
  create_repository: createGitRepositoryStep,
  push_template: pushTemplateStep,
  create_environments: createEnvironmentsStep,
  setup_gitops: setupGitOpsStep,
  finalize: finalizeStep,
}

async function createGitRepositoryStep(projectId: string) {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  })

  if (!project) throw new Error('Project not found')

  if (!project.gitRepository) {
    console.log(`[Step: create_repository] No git repository to create for project ${projectId}`)
    return
  }

  console.log(`[Step: create_repository] Repository already configured: ${project.gitRepository}`)
}

async function pushTemplateStep(projectId: string) {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  })

  if (!project) throw new Error('Project not found')

  console.log(`[Step: push_template] Template: ${project.templateId}`)
}

async function createEnvironmentsStep(projectId: string) {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    with: {
      environments: true,
    },
  })

  if (!project) throw new Error('Project not found')

  const cluster = await db.query.clusters.findFirst({
    where: eq(clusters.id, project.clusterId || ''),
  })

  if (cluster) {
    initK8sClient(cluster.kubeconfig)
  }

  for (const env of project.environments) {
    const namespace = `${cluster?.defaultNamespacePrefix || 'juanie'}-${project.slug}-${env.name}`

    await db.update(environments).set({ namespace }).where(eq(environments.id, env.id))

    if (cluster) {
      try {
        await createNamespace(namespace)
        console.log(`[Step: create_environments] Created namespace: ${namespace}`)
      } catch (e) {
        console.log(`[Step: create_environments] Namespace may already exist: ${namespace}`)
      }
    }
  }
}

async function setupGitOpsStep(projectId: string) {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    with: {
      environments: true,
    },
  })

  if (!project) throw new Error('Project not found')

  const cluster = await db.query.clusters.findFirst({
    where: eq(clusters.id, project.clusterId || ''),
  })

  if (!cluster || !project.gitRepository) {
    console.log(`[Step: setup_gitops] Skipping - no cluster or git repository`)
    return
  }

  initK8sClient(cluster.kubeconfig)

  try {
    await createGitRepository(project.slug, 'flux-system', {
      url: project.gitRepository,
      ref: { branch: project.gitBranch || 'main' },
    })
    console.log(`[Step: setup_gitops] Created GitRepository: ${project.slug}`)
  } catch (e) {
    console.log(`[Step: setup_gitops] GitRepository may already exist`)
  }

  for (const env of project.environments) {
    const namespace = `${cluster.defaultNamespacePrefix}-${project.slug}-${env.name}`

    try {
      await createKustomization(`${project.slug}-${env.name}`, namespace, {
        sourceRef: {
          kind: 'GitRepository',
          name: project.slug,
        },
        path: `./k8s/overlays/${env.name}`,
        prune: true,
        interval: '1m',
        targetNamespace: namespace,
      })
      console.log(`[Step: setup_gitops] Created Kustomization: ${project.slug}-${env.name}`)
    } catch (e) {
      console.log(
        `[Step: setup_gitops] Kustomization may already exist: ${project.slug}-${env.name}`,
      )
    }
  }
}

async function finalizeStep(projectId: string) {
  await db.update(projects).set({ status: 'active' }).where(eq(projects.id, projectId))

  console.log(`[Step: finalize] Project ${projectId} is now active`)
}

export async function POST(request: Request) {
  const { projectId, step } = await request.json()

  if (!projectId || !step) {
    return NextResponse.json({ error: 'projectId and step required' }, { status: 400 })
  }

  const handler = STEP_HANDLERS[step]
  if (!handler) {
    return NextResponse.json({ error: `Unknown step: ${step}` }, { status: 400 })
  }

  try {
    await db
      .update(projectInitializationSteps)
      .set({
        status: 'running',
        startedAt: new Date(),
      })
      .where(
        and(
          eq(projectInitializationSteps.projectId, projectId),
          eq(projectInitializationSteps.step, step),
        ),
      )

    await handler(projectId)

    await db
      .update(projectInitializationSteps)
      .set({
        status: 'completed',
        progress: 100,
        completedAt: new Date(),
      })
      .where(
        and(
          eq(projectInitializationSteps.projectId, projectId),
          eq(projectInitializationSteps.step, step),
        ),
      )

    return NextResponse.json({ success: true, step })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    await db
      .update(projectInitializationSteps)
      .set({
        status: 'failed',
        error: errorMessage,
        completedAt: new Date(),
      })
      .where(
        and(
          eq(projectInitializationSteps.projectId, projectId),
          eq(projectInitializationSteps.step, step),
        ),
      )

    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const projectId = url.searchParams.get('projectId')

  if (!projectId) {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 })
  }

  const steps = await db
    .select()
    .from(projectInitializationSteps)
    .where(eq(projectInitializationSteps.projectId, projectId))
    .orderBy(projectInitializationSteps.createdAt)

  return NextResponse.json(steps)
}
