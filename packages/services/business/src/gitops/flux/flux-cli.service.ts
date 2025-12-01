import { exec } from 'node:child_process'
import { promisify } from 'node:util'
// K8s client removed - using K3sService instead
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

const execAsync = promisify(exec)

export interface FluxInstallOptions {
  namespace?: string
  version?: string
  export?: boolean
}

export interface FluxStatus {
  installed: boolean
  version?: string
  components: Array<{
    name: string
    status: string
  }>
}

@Injectable()
export class FluxCliService {
  private kubeconfig: string

  constructor(private config: ConfigService) {
    // Get kubeconfig path from environment
    this.kubeconfig =
      this.config.get<string>('KUBECONFIG_PATH') ||
      this.config.get<string>('K3S_KUBECONFIG_PATH') ||
      ''

    // Expand ~ symbol
    if (this.kubeconfig.startsWith('~')) {
      const homeDir = process.env.HOME || process.env.USERPROFILE
      this.kubeconfig = this.kubeconfig.replace('~', homeDir || '')
    }
  }

  /**
   * Install Flux to the cluster
   */
  async install(options: FluxInstallOptions = {}): Promise<void> {
    const namespace = options.namespace || 'flux-system'
    const exportFlag = options.export !== false

    const cmd = [
      'flux',
      'install',
      `--namespace=${namespace}`,
      options.version ? `--version=${options.version}` : '',
      exportFlag ? '--export' : '',
    ]
      .filter(Boolean)
      .join(' ')

    try {
      const { stdout, stderr } = await execAsync(cmd, {
        env: { ...process.env, KUBECONFIG: this.kubeconfig },
      })

      if (stderr && !stderr.includes('context deadline exceeded')) {
        console.warn('Flux install stderr:', stderr)
      }

      // If export flag is set, apply the manifests using kubectl
      if (exportFlag && stdout) {
        await this.applyManifests(stdout)
      }

      console.log('✅ Flux installed successfully')
    } catch (error: any) {
      console.error('Failed to install Flux:', error.message)
      throw new Error(`Flux installation failed: ${error.message}`)
    }
  }

  /**
   * Check Flux installation status
   */
  async check(): Promise<FluxStatus> {
    try {
      const cmd = 'flux check --pre'
      const { stdout } = await execAsync(cmd, {
        env: { ...process.env, KUBECONFIG: this.kubeconfig },
      })

      return this.parseFluxStatus(stdout)
    } catch (error: any) {
      // If flux check fails, Flux is likely not installed
      return {
        installed: false,
        components: [],
      }
    }
  }

  /**
   * Uninstall Flux from the cluster
   */
  async uninstall(options: { namespace?: string } = {}): Promise<void> {
    const namespace = options.namespace || 'flux-system'

    try {
      const cmd = `flux uninstall --namespace=${namespace} --silent`
      await execAsync(cmd, {
        env: { ...process.env, KUBECONFIG: this.kubeconfig },
      })

      console.log('✅ Flux uninstalled successfully')
    } catch (error: any) {
      console.error('Failed to uninstall Flux:', error.message)
      throw new Error(`Flux uninstallation failed: ${error.message}`)
    }
  }

  /**
   * Manually trigger reconciliation for a resource
   */
  async reconcile(kind: string, name: string, namespace: string): Promise<void> {
    try {
      const cmd = `flux reconcile ${kind.toLowerCase()} ${name} -n ${namespace}`
      await execAsync(cmd, {
        env: { ...process.env, KUBECONFIG: this.kubeconfig },
      })

      console.log(`✅ Reconciliation triggered for ${kind}/${name}`)
    } catch (error: any) {
      console.error(`Failed to reconcile ${kind}/${name}:`, error.message)
      throw new Error(`Reconciliation failed: ${error.message}`)
    }
  }

  /**
   * Get Flux version
   */
  async getVersion(): Promise<string> {
    try {
      const cmd = 'flux version --client'
      const { stdout } = await execAsync(cmd)
      return stdout.trim()
    } catch (error: any) {
      throw new Error(`Failed to get Flux version: ${error.message}`)
    }
  }

  /**
   * Apply Kubernetes manifests using kubectl
   */
  private async applyManifests(yaml: string): Promise<void> {
    try {
      // Create a temporary file with the YAML content
      const { writeFile, unlink } = await import('node:fs/promises')
      const tmpFile = `/tmp/flux-install-${Date.now()}.yaml`

      await writeFile(tmpFile, yaml)

      try {
        const cmd = `kubectl apply -f ${tmpFile}`
        await execAsync(cmd, {
          env: { ...process.env, KUBECONFIG: this.kubeconfig },
        })
      } finally {
        // Clean up temporary file
        await unlink(tmpFile).catch(() => {})
      }
    } catch (error: any) {
      throw new Error(`Failed to apply manifests: ${error.message}`)
    }
  }

  /**
   * Alternative method: Apply manifests using kubectl (deprecated)
   * Note: This method is kept for reference but not used anymore
   */
  private async applyManifestsWithKubectl(yaml: string): Promise<void> {
    // This method is deprecated - use applyManifests() instead
    throw new Error('This method is deprecated. Use applyManifests() instead.')
  }

  /**
   * Parse Flux status output
   */
  private parseFluxStatus(output: string): FluxStatus {
    const lines = output.split('\n')
    const components: Array<{ name: string; status: string }> = []

    let installed = false
    let version: string | undefined

    for (const line of lines) {
      // Check for version
      if (line.includes('flux:')) {
        const match = line.match(/flux:\s+v?([\d.]+)/)
        if (match) {
          version = match[1]
          installed = true
        }
      }

      // Check for component status
      if (line.includes('✔') || line.includes('✓')) {
        const match = line.match(/✔\s+(.+?)\s+/)
        if (match && match[1]) {
          components.push({
            name: match[1].trim(),
            status: 'ready',
          })
        }
      } else if (line.includes('✗')) {
        const match = line.match(/✗\s+(.+?)\s+/)
        if (match && match[1]) {
          components.push({
            name: match[1].trim(),
            status: 'failed',
          })
        }
      }
    }

    return {
      installed,
      version,
      components,
    }
  }
}
