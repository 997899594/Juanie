import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { environments, projectInitializationSteps, projects, teams } from '@/lib/db/schema'
import { createGitRepository, createKustomization } from './flux'
import { createGitHubRepo, pushTemplateToRepo } from './github'
import { createNamespace } from './k8s'

export type InitializationStep =
  | 'create_repository'
  | 'push_template'
  | 'create_environments'
  | 'setup_gitops'
  | 'finalize'

export interface StepResult {
  success: boolean
  error?: string
  metadata?: Record<string, unknown>
}

const STEP_WEIGHTS: Record<InitializationStep, number> = {
  create_repository: 15,
  push_template: 25,
  create_environments: 10,
  setup_gitops: 35,
  finalize: 15,
}

export class ProjectInitializationService {
  private projectId: string

  constructor(projectId: string) {
    this.projectId = projectId
  }

  async initialize(): Promise<void> {
    const steps: InitializationStep[] = [
      'create_repository',
      'push_template',
      'create_environments',
      'setup_gitops',
      'finalize',
    ]

    for (const step of steps) {
      await this.executeStep(step)

      const progress = this.calculateProgress(steps.indexOf(step) + 1, steps.length)
      await this.updateStepProgress(step, progress)
    }
  }

  private calculateProgress(currentStep: number, totalSteps: number): number {
    let total = 0
    for (let i = 0; i < currentStep; i++) {
      total += STEP_WEIGHTS[Object.keys(STEP_WEIGHTS)[i] as InitializationStep]
    }
    return total
  }

  private async executeStep(step: InitializationStep): Promise<StepResult> {
    await this.markStepRunning(step)

    try {
      switch (step) {
        case 'create_repository':
          return await this.createRepository()
        case 'push_template':
          return await this.pushTemplate()
        case 'create_environments':
          return await this.createEnvironments()
        case 'setup_gitops':
          return await this.setupGitOps()
        case 'finalize':
          return await this.finalize()
        default:
          return { success: false, error: 'Unknown step' }
      }
    } catch (error) {
      await this.markStepFailed(step, error instanceof Error ? error.message : 'Unknown error')
      throw error
    }
  }

  private async createRepository(): Promise<StepResult> {
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, this.projectId),
    })

    if (!project) {
      return { success: false, error: 'Project not found' }
    }

    if (project.gitRepository) {
      return { success: true, metadata: { repository: project.gitRepository } }
    }

    const team = await db.query.teams.findFirst({
      where: eq(teams.id, project.teamId),
    })

    if (!team) {
      return { success: false, error: 'Team not found' }
    }

    const { createGitHubRepo } = await import('./github')
    const repo = await createGitHubRepo(team.id, {
      name: project.slug,
      description: project.description || `Project ${project.name}`,
      private: true,
    })

    if (!repo) {
      return {
        success: false,
        error:
          'Failed to create GitHub repository. Please ensure GitHub is connected to your team.',
      }
    }

    await db
      .update(projects)
      .set({ gitRepository: repo.html_url })
      .where(eq(projects.id, this.projectId))

    return { success: true, metadata: { repository: repo.html_url, repoFullName: repo.full_name } }
  }

  private async pushTemplate(): Promise<StepResult> {
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, this.projectId),
    })

    if (!project) {
      return { success: false, error: 'Project not found' }
    }

    if (!project.gitRepository) {
      return { success: false, error: 'Repository not created' }
    }

    const team = await db.query.teams.findFirst({
      where: eq(teams.id, project.teamId),
    })

    if (!team) {
      return { success: false, error: 'Team not found' }
    }

    const [, ownerRepo] = project.gitRepository.split('github.com/')
    const [owner, repo] = ownerRepo.split('/')

    const { pushTemplateToRepo } = await import('./github')
    const templateFiles = this.generateTemplateFiles(project.templateId || 'nextjs', project.slug)

    const success = await pushTemplateToRepo(team.id, owner, repo, templateFiles)

    if (!success) {
      return { success: false, error: 'Failed to push template to repository' }
    }

    return { success: true, metadata: { template: project.templateId } }
  }

  private generateTemplateFiles(templateId: string, projectSlug: string): Record<string, string> {
    const baseFiles: Record<string, string> = {
      'kustomization.yaml': `apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - deployment.yaml
  - service.yaml
`,
      'deployment.yaml': `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${projectSlug}
  labels:
    app: ${projectSlug}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ${projectSlug}
  template:
    metadata:
      labels:
        app: ${projectSlug}
    spec:
      containers:
        - name: app
          image: nginx:latest
          ports:
            - containerPort: 80
`,
      'service.yaml': `apiVersion: v1
kind: Service
metadata:
  name: ${projectSlug}
spec:
  selector:
    app: ${projectSlug}
  ports:
    - port: 80
      targetPort: 80
  type: ClusterIP
`,
      '.github/workflows/deploy.yaml': `name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy
        run: echo "Deploying..."
`,
    }

    return baseFiles
  }

  private async createEnvironments(): Promise<StepResult> {
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, this.projectId),
    })

    if (!project) {
      return { success: false, error: 'Project not found' }
    }

    const envs = await db.query.environments.findMany({
      where: eq(environments.projectId, this.projectId),
    })

    const namespacePrefix = 'juanie'
    const projectSlug = project.slug

    const envNames: Record<string, number> = {
      development: 1,
      staging: 2,
      production: 3,
    }

    for (const [envName, order] of Object.entries(envNames)) {
      const namespace = `${namespacePrefix}-${projectSlug}-${envName}`
      const env = envs.find((e) => e.name === envName)

      if (env) {
        await db.update(environments).set({ namespace }).where(eq(environments.id, env.id))
      }
    }

    return { success: true }
  }

  private async setupGitOps(): Promise<StepResult> {
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, this.projectId),
    })

    if (!project) {
      return { success: false, error: 'Project not found' }
    }

    if (!project.gitRepository) {
      return { success: false, error: 'Repository not created' }
    }

    const [, ownerRepo] = project.gitRepository.split('github.com/')
    const [, repo] = ownerRepo.split('/')
    const repoUrl = `https://github.com/${repo}`

    const envs = await db.query.environments.findMany({
      where: eq(environments.projectId, this.projectId),
    })

    for (const env of envs) {
      if (!env.namespace) continue

      try {
        await createNamespace(env.namespace)

        await createGitRepository(`${project.slug}-${env.name}`, env.namespace, {
          url: repoUrl,
          ref: { branch: 'main' },
          interval: '1m',
        })

        await createKustomization(`${project.slug}-${env.name}`, env.namespace, {
          sourceRef: {
            kind: 'GitRepository',
            name: `${project.slug}-${env.name}`,
          },
          path: `./environments/${env.name}`,
          prune: true,
          interval: '1m',
          targetNamespace: env.namespace,
        })
      } catch (error) {
        console.error(`Failed to setup GitOps for environment ${env.name}:`, error)
      }
    }

    return { success: true }
  }

  private async finalize(): Promise<StepResult> {
    await db.update(projects).set({ status: 'active' }).where(eq(projects.id, this.projectId))

    return { success: true }
  }

  private async markStepRunning(step: InitializationStep): Promise<void> {
    await db
      .update(projectInitializationSteps)
      .set({
        status: 'running',
        startedAt: new Date(),
      })
      .where(eq(projectInitializationSteps.step, step))
  }

  private async markStepFailed(step: InitializationStep, error: string): Promise<void> {
    await db
      .update(projectInitializationSteps)
      .set({
        status: 'failed',
        error,
        completedAt: new Date(),
      })
      .where(eq(projectInitializationSteps.step, step))

    await db.update(projects).set({ status: 'failed' }).where(eq(projects.id, this.projectId))
  }

  private async updateStepProgress(step: InitializationStep, progress: number): Promise<void> {
    await db
      .update(projectInitializationSteps)
      .set({
        status: 'completed',
        progress,
        completedAt: new Date(),
      })
      .where(eq(projectInitializationSteps.step, step))
  }
}

export async function initializeProject(projectId: string): Promise<void> {
  const service = new ProjectInitializationService(projectId)
  await service.initialize()
}
