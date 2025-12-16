import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as schema from '@juanie/core/database'
import { Logger } from '@juanie/core/logger'
import { DATABASE } from '@juanie/core/tokens'
// K8s client removed - using K3sService instead
import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import simpleGit, { type SimpleGit, type SimpleGitOptions } from 'simple-git'
import * as yaml from 'yaml'
import { FluxMetricsService } from '../flux/flux-metrics.service'

export interface DeploymentChanges {
  image?: string
  replicas?: number
  env?: Record<string, string>
  resources?: {
    requests?: { cpu?: string; memory?: string }
    limits?: { cpu?: string; memory?: string }
  }
}

export interface CommitFromUIInput {
  projectId: string
  environmentId: string
  changes: DeploymentChanges
  userId: string
  commitMessage?: string
}

export interface GitConfig {
  url: string
  branch: string
  path: string
  secretRef?: string
}

export interface ConflictResolution {
  strategy: 'auto-merge' | 'smart-merge' | 'manual'
  result?: any
  conflicts?: Array<{
    path: string
    type: string
    localValue: any
    remoteValue: any
  }>
  message?: string
}

@Injectable()
export class GitOpsService {
  private readonly repoBasePath: string
  private gitInstances: Map<string, SimpleGit> = new Map()

  constructor(
    @Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>,
    private readonly config: ConfigService,
    private readonly metrics: FluxMetricsService,
    private readonly logger: Logger,
  ) {
    this.logger.setContext(GitOpsService.name)
    this.repoBasePath = this.config.get('GIT_REPOS_PATH', '/tmp/git-repos')
  }

  /**
   * Initialize a Git repository (clone or pull)
   * Requirement: 2.2, 2.3, 4.1, 4.2
   */
  async initRepository(
    repoUrl: string,
    localPath: string,
    options?: {
      branch?: string
      credentials?: { username?: string; password?: string; sshKey?: string }
    },
  ): Promise<SimpleGit> {
    this.logger.info(`Initializing repository: ${repoUrl} at ${localPath}`)
    const startTime = Date.now()

    try {
      // Ensure base directory exists
      await fs.mkdir(path.dirname(localPath), { recursive: true })

      const gitOptions: Partial<SimpleGitOptions> = {
        baseDir: localPath,
        binary: 'git',
        maxConcurrentProcesses: 6,
      }

      // Configure credentials if provided
      if (options?.credentials) {
        if (options.credentials.username && options.credentials.password) {
          // HTTPS authentication
          const urlWithAuth = repoUrl.replace(
            'https://',
            `https://${options.credentials.username}:${options.credentials.password}@`,
          )
          repoUrl = urlWithAuth
        }
        // SSH key authentication is handled via SSH agent or git config
      }

      const git = simpleGit(gitOptions)

      // Check if repository already exists
      const repoExists = await this.repoExists(localPath)

      if (!repoExists) {
        this.logger.info(`Cloning repository from ${repoUrl}`)
        await git.clone(repoUrl, localPath)

        // Record clone operation
        const duration = (Date.now() - startTime) / 1000
        this.metrics.recordGitOperation('clone', repoUrl, 'success', duration)
      } else {
        this.logger.info(`Repository exists, pulling latest changes`)
        await git.cwd(localPath)
        await git.fetch()

        // Record pull operation
        const duration = (Date.now() - startTime) / 1000
        this.metrics.recordGitOperation('pull', repoUrl, 'success', duration)
      }

      // Checkout specified branch
      if (options?.branch) {
        await this.checkoutBranch(git, options.branch)
      }

      // Cache git instance
      this.gitInstances.set(localPath, git)

      return git
    } catch (error) {
      // Record failed operation
      const duration = (Date.now() - startTime) / 1000
      const operation = (await this.repoExists(localPath)) ? 'pull' : 'clone'
      this.metrics.recordGitOperation(operation, repoUrl, 'failed', duration)
      throw error
    }
  }

  /**
   * Check if a repository exists at the given path
   */
  private async repoExists(localPath: string): Promise<boolean> {
    try {
      await fs.access(path.join(localPath, '.git'))
      return true
    } catch {
      return false
    }
  }

  /**
   * Checkout a specific branch
   * Requirement: 2.2, 4.1
   */
  async checkoutBranch(git: SimpleGit, branch: string): Promise<void> {
    this.logger.info(`Checking out branch: ${branch}`)

    try {
      // Check if branch exists locally
      const branches = await git.branchLocal()

      if (branches.all.includes(branch)) {
        await git.checkout(branch)
      } else {
        // Try to checkout remote branch
        await git.checkout(['-b', branch, `origin/${branch}`])
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.logger.error(`Failed to checkout branch ${branch}:`, error)
      throw new Error(`Failed to checkout branch ${branch}: ${errorMessage}`)
    }
  }

  /**
   * Pull latest changes from remote
   * Requirement: 2.2, 4.1
   */
  async pullLatest(git: SimpleGit, branch?: string): Promise<void> {
    this.logger.info(`Pulling latest changes${branch ? ` from ${branch}` : ''}`)

    try {
      if (branch) {
        await git.pull('origin', branch)
      } else {
        await git.pull()
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.logger.error('Failed to pull latest changes:', error)
      throw new Error(`Failed to pull latest changes: ${errorMessage}`)
    }
  }

  /**
   * Get Git configuration for a project
   */
  private async getProjectGitConfig(projectId: string, environmentId: string): Promise<GitConfig> {
    // Get repository configuration
    const [repository] = await this.db
      .select()
      .from(schema.repositories)
      .where(eq(schema.repositories.projectId, projectId))
      .limit(1)

    if (!repository) {
      throw new Error('Repository not found for project')
    }

    // Get environment configuration
    const [environment] = await this.db
      .select()
      .from(schema.environments)
      .where(eq(schema.environments.id, environmentId))
      .limit(1)

    if (!environment) {
      throw new Error('Environment not found')
    }

    const envConfig = environment.config as any
    const gitopsConfig = envConfig?.gitops

    if (!gitopsConfig?.enabled) {
      throw new Error('GitOps is not enabled for this environment')
    }

    return {
      url: repository.cloneUrl,
      branch: gitopsConfig.gitBranch || repository.defaultBranch || 'main',
      path: gitopsConfig.gitPath || `k8s/overlays/${environment.name}`,
      secretRef: (repository.gitopsConfig as any)?.secretRef,
    }
  }

  /**
   * Commit changes from UI operations to Git
   * Core functionality for bidirectional GitOps
   * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
   */
  async commitFromUI(input: CommitFromUIInput): Promise<string> {
    const { projectId, environmentId, changes, userId, commitMessage } = input

    this.logger.info(
      `Creating commit from UI for project ${projectId}, environment ${environmentId}`,
    )

    const startTime = Date.now()

    try {
      // 1. Get project Git configuration
      const gitConfig = await this.getProjectGitConfig(projectId, environmentId)
      const localPath = path.join(this.repoBasePath, projectId)

      // 2. Get credentials from K8s Secret if configured
      let credentials: any
      if (gitConfig.secretRef) {
        credentials = await this.getGitCredentials(gitConfig.secretRef)
      }

      // 3. Initialize repository
      const git = await this.initRepository(gitConfig.url, localPath, {
        branch: gitConfig.branch,
        credentials,
      })

      // 4. Pull latest changes to avoid conflicts
      await this.pullLatest(git, gitConfig.branch)

      // 5. Generate or update YAML file
      const yamlPath = path.join(gitConfig.path, 'deployment.yaml')
      const fullYamlPath = path.join(localPath, yamlPath)

      // Ensure directory exists
      await fs.mkdir(path.dirname(fullYamlPath), { recursive: true })

      const yamlContent = await this.generateOrUpdateYAML(fullYamlPath, changes)
      await fs.writeFile(fullYamlPath, yamlContent, 'utf-8')

      // 6. Stage changes
      await git.add(yamlPath)

      // 7. Create commit with friendly message
      const message = commitMessage || this.generateCommitMessage(changes, userId)
      const commitStartTime = Date.now()
      await git.commit(message)

      // Record commit operation
      const commitDuration = (Date.now() - commitStartTime) / 1000
      this.metrics.recordGitOperation('commit', gitConfig.url, 'success', commitDuration)

      // 8. Push to remote
      const pushStartTime = Date.now()
      await git.push('origin', gitConfig.branch)

      // Record push operation
      const pushDuration = (Date.now() - pushStartTime) / 1000
      this.metrics.recordGitOperation('push', gitConfig.url, 'success', pushDuration)

      // 9. Get commit SHA
      const log = await git.log(['-1'])
      const commitSha = log.latest?.hash

      if (!commitSha) {
        throw new Error('Failed to get commit SHA')
      }

      this.logger.info(`Successfully created commit: ${commitSha}`)

      // Record overall deployment operation
      const totalDuration = (Date.now() - startTime) / 1000
      this.metrics.recordDeployment(projectId, environmentId, 'gitops-ui', 'success', totalDuration)

      return commitSha
    } catch (error) {
      // Record failed deployment
      const totalDuration = (Date.now() - startTime) / 1000
      this.metrics.recordDeployment(projectId, environmentId, 'gitops-ui', 'failed', totalDuration)
      throw error
    }
  }

  /**
   * Generate friendly commit message from changes
   * Requirement: 4.4
   */
  private generateCommitMessage(changes: DeploymentChanges, userId: string): string {
    const parts: string[] = []

    if (changes.image) {
      parts.push(`update image to ${changes.image}`)
    }
    if (changes.replicas !== undefined) {
      parts.push(`scale to ${changes.replicas} replicas`)
    }
    if (changes.env && Object.keys(changes.env).length > 0) {
      parts.push(`update ${Object.keys(changes.env).length} environment variable(s)`)
    }
    if (changes.resources) {
      parts.push('update resource limits')
    }

    const summary = parts.length > 0 ? parts.join(', ') : 'update deployment configuration'

    return `chore(deploy): ${summary}\n\nDeployed via Platform UI by user ${userId}`
  }

  /**
   * Generate or update YAML file with smart updates
   * Requirements: 4.2, 4.3, 15.1, 15.2, 15.3
   */
  private async generateOrUpdateYAML(
    filePath: string,
    changes: DeploymentChanges,
  ): Promise<string> {
    let doc: yaml.Document

    try {
      // Try to read existing file
      const existingContent = await fs.readFile(filePath, 'utf-8')
      doc = yaml.parseDocument(existingContent)
      this.logger.info('Updating existing YAML file')
    } catch {
      // File doesn't exist, create new document
      this.logger.info('Creating new YAML file')
      doc = new yaml.Document({
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: {
          name: 'app',
          labels: {
            app: 'app',
          },
        },
        spec: {
          replicas: 3,
          selector: {
            matchLabels: {
              app: 'app',
            },
          },
          template: {
            metadata: {
              labels: {
                app: 'app',
              },
            },
            spec: {
              containers: [
                {
                  name: 'app',
                  image: 'nginx:latest',
                  ports: [
                    {
                      containerPort: 80,
                    },
                  ],
                },
              ],
            },
          },
        },
      })
    }

    // Update fields based on changes
    if (changes.image) {
      doc.setIn(['spec', 'template', 'spec', 'containers', 0, 'image'], changes.image)
    }

    if (changes.replicas !== undefined) {
      doc.setIn(['spec', 'replicas'], changes.replicas)
    }

    if (changes.env) {
      const envArray = Object.entries(changes.env).map(([name, value]) => ({
        name,
        value,
      }))
      doc.setIn(['spec', 'template', 'spec', 'containers', 0, 'env'], envArray)
    }

    if (changes.resources) {
      const resources: any = {}
      if (changes.resources.requests) {
        resources.requests = changes.resources.requests
      }
      if (changes.resources.limits) {
        resources.limits = changes.resources.limits
      }
      doc.setIn(['spec', 'template', 'spec', 'containers', 0, 'resources'], resources)
    }

    // Return YAML string with preserved formatting
    return doc.toString()
  }

  /**
   * Read and parse existing YAML file
   * Requirement: 4.2, 15.1
   */
  async readYAML(filePath: string): Promise<any> {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      return yaml.parse(content)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.logger.error(`Failed to read YAML file ${filePath}:`, error)
      throw new Error(`Failed to read YAML file: ${errorMessage}`)
    }
  }

  /**
   * Validate YAML syntax
   * Requirement: 15.1, 15.2, 15.3
   */
  validateYAML(content: string): { valid: boolean; error?: string } {
    try {
      yaml.parse(content)
      return { valid: true }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return {
        valid: false,
        error: errorMessage,
      }
    }
  }

  /**
   * Detect conflicts between local and remote changes
   * Requirement: 4.1, 4.2
   */
  async detectConflicts(
    localChanges: DeploymentChanges,
    remoteChanges: DeploymentChanges,
  ): Promise<Array<{ path: string; type: string; localValue: any; remoteValue: any }>> {
    const conflicts: Array<{ path: string; type: string; localValue: any; remoteValue: any }> = []

    // Check image conflicts
    if (localChanges.image && remoteChanges.image && localChanges.image !== remoteChanges.image) {
      conflicts.push({
        path: 'spec.template.spec.containers[0].image',
        type: 'overlapping',
        localValue: localChanges.image,
        remoteValue: remoteChanges.image,
      })
    }

    // Check replicas conflicts
    if (
      localChanges.replicas !== undefined &&
      remoteChanges.replicas !== undefined &&
      localChanges.replicas !== remoteChanges.replicas
    ) {
      conflicts.push({
        path: 'spec.replicas',
        type: 'overlapping',
        localValue: localChanges.replicas,
        remoteValue: remoteChanges.replicas,
      })
    }

    // Check env conflicts
    if (localChanges.env && remoteChanges.env) {
      for (const [key, localValue] of Object.entries(localChanges.env)) {
        if (remoteChanges.env[key] && remoteChanges.env[key] !== localValue) {
          conflicts.push({
            path: `spec.template.spec.containers[0].env.${key}`,
            type: 'overlapping',
            localValue,
            remoteValue: remoteChanges.env[key],
          })
        }
      }
    }

    return conflicts
  }

  /**
   * Resolve conflicts with smart merge strategy
   * Requirement: 4.1, 4.2
   */
  async resolveConflicts(
    localChanges: DeploymentChanges,
    remoteChanges: DeploymentChanges,
  ): Promise<ConflictResolution> {
    const conflicts = await this.detectConflicts(localChanges, remoteChanges)

    if (conflicts.length === 0) {
      // No conflicts, auto-merge
      return {
        strategy: 'auto-merge',
        result: this.autoMerge(localChanges, remoteChanges),
      }
    }

    // Check if all conflicts are non-overlapping
    const canAutoResolve = conflicts.every((c) => c.type === 'non-overlapping')

    if (canAutoResolve) {
      return {
        strategy: 'smart-merge',
        result: this.smartMerge(localChanges, remoteChanges, conflicts),
      }
    }

    // Manual resolution required
    return {
      strategy: 'manual',
      conflicts,
      message: 'Conflicts detected that require manual resolution',
    }
  }

  /**
   * Auto-merge non-conflicting changes
   */
  private autoMerge(
    localChanges: DeploymentChanges,
    remoteChanges: DeploymentChanges,
  ): DeploymentChanges {
    return {
      ...remoteChanges,
      ...localChanges,
      env: {
        ...remoteChanges.env,
        ...localChanges.env,
      },
      resources: {
        ...remoteChanges.resources,
        ...localChanges.resources,
      },
    }
  }

  /**
   * Smart merge with conflict awareness
   */
  private smartMerge(
    localChanges: DeploymentChanges,
    remoteChanges: DeploymentChanges,
    conflicts: Array<{ path: string; type: string }>,
  ): DeploymentChanges {
    const merged = { ...remoteChanges }

    // Merge non-conflicting fields
    for (const [key, value] of Object.entries(localChanges)) {
      const hasConflict = conflicts.some((c) => c.path.startsWith(key))
      if (!hasConflict && key in merged) {
        ;(merged as any)[key] = value
      }
    }

    return merged
  }

  /**
   * Get Git credentials from K8s Secret
   * Requirement: 2.2, 2.3
   * Note: This method is deprecated and should use K3sService instead
   */
  private async getGitCredentials(_secretRef: string): Promise<{
    username?: string
    password?: string
    sshKey?: string
  }> {
    // TODO: Implement using K3sService.getSecret()
    this.logger.warn('getGitCredentials is not yet implemented with BunK8sClient')
    throw new Error(
      'Git credentials from K8s Secret not yet implemented. Use environment variables instead.',
    )
  }

  /**
   * Preview changes before committing
   * Requirement: 4.1, 4.2
   */
  async previewChanges(input: {
    projectId: string
    environmentId: string
    changes: DeploymentChanges
  }): Promise<{
    diff: string
    summary: Array<{
      field: string
      oldValue: any
      newValue: any
      type: 'add' | 'modify' | 'remove'
    }>
  }> {
    const { projectId, environmentId, changes } = input

    // Get current YAML
    const gitConfig = await this.getProjectGitConfig(projectId, environmentId)
    const localPath = path.join(this.repoBasePath, projectId)
    const yamlPath = path.join(localPath, gitConfig.path, 'deployment.yaml')

    let currentYAML: any = {}
    try {
      currentYAML = await this.readYAML(yamlPath)
    } catch {
      // File doesn't exist yet
    }

    // Generate new YAML
    const newYAMLContent = await this.generateOrUpdateYAML(yamlPath, changes)

    // Generate summary
    const summary: Array<{
      field: string
      oldValue: any
      newValue: any
      type: 'add' | 'modify' | 'remove'
    }> = []

    if (changes.image) {
      const oldImage = currentYAML.spec?.template?.spec?.containers?.[0]?.image
      summary.push({
        field: 'image',
        oldValue: oldImage || 'none',
        newValue: changes.image,
        type: oldImage ? 'modify' : 'add',
      })
    }

    if (changes.replicas !== undefined) {
      const oldReplicas = currentYAML.spec?.replicas
      summary.push({
        field: 'replicas',
        oldValue: oldReplicas || 'none',
        newValue: changes.replicas,
        type: oldReplicas ? 'modify' : 'add',
      })
    }

    return {
      diff: `--- Current\n+++ New\n${newYAMLContent}`,
      summary,
    }
  }
}
