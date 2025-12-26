import { Injectable, type OnModuleInit } from '@nestjs/common'
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter'
import { PinoLogger } from 'nestjs-pino'
import { SystemEvents } from '../events/event-types'
import { K8sClientService } from '../k8s/k8s-client.service'

export interface FluxInstallation {
  namespace: string
  version: string
  components: string[]
  status: 'installed' | 'failed' | 'pending'
}

/**
 * FluxService
 *
 * 职责：Flux 生命周期管理和状态检查
 * - Flux 安装和卸载
 * - Flux 健康检查
 * - Flux 状态管理
 *
 * Note: 这是纯基础设施服务，不包含业务逻辑
 */
@Injectable()
export class FluxService implements OnModuleInit {
  private fluxStatus: 'unknown' | 'checking' | 'installed' | 'not-installed' = 'unknown'

  constructor(
    private k8s: K8sClientService,
    private eventPublisher: EventEmitter2,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(FluxService.name)
  }

  async onModuleInit() {
    // 不在这里检查，等待 K3s 连接事件
  }

  /**
   * 监听 K8s 连接成功事件
   * 当 K8s 连接成功后,自动检查 Flux 安装状态
   */
  @OnEvent(SystemEvents.K8S_CONNECTED)
  async handleK8sConnected() {
    this.logger.info('收到 K8s 连接成功事件,开始检查 Flux 状态')
    await this.checkFluxInstallationAsync()
  }

  /**
   * 监听 K8s 连接失败事件
   */
  @OnEvent(SystemEvents.K8S_CONNECTION_FAILED)
  handleK8sConnectionFailed() {
    this.logger.warn('K8s 连接失败,Flux 功能不可用')
    this.fluxStatus = 'not-installed'
  }

  /**
   * 后台异步检查 Flux 安装状态
   * 不阻塞模块初始化，失败也不影响服务启动
   */
  private checkFluxInstallationAsync(): void {
    // 避免重复检查
    if (this.fluxStatus === 'checking') {
      return
    }

    this.fluxStatus = 'checking'

    // 异步执行，不等待结果
    this.checkFluxInstallation()
      .then(async (installed) => {
        this.fluxStatus = installed ? 'installed' : 'not-installed'
        this.logger.info(`Flux status: ${this.fluxStatus}`)

        // 发出 Flux 状态检查完成事件
        const eventType = installed ? SystemEvents.FLUX_INSTALLED : SystemEvents.FLUX_NOT_INSTALLED
        await this.eventPublisher.emit(eventType, {
          installed,
        })
      })
      .catch((error) => {
        this.logger.warn(`Failed to check Flux installation: ${error.message}`)
        this.fluxStatus = 'unknown'
      })
  }

  /**
   * 检查 Flux 是否已安装
   */
  private async checkFluxInstallation(): Promise<boolean> {
    if (!this.k8s.isK8sConnected()) {
      this.logger.debug('K8s not connected, cannot check Flux')
      return false
    }

    try {
      const namespaces = await this.k8s.listNamespaces()
      const hasFluxNamespace = namespaces.some((ns) => ns.metadata?.name === 'flux-system')
      return hasFluxNamespace
    } catch (error: any) {
      this.logger.warn(`Error checking Flux installation: ${error.message}`)
      return false
    }
  }

  /**
   * 同步方法：返回当前已知的状态
   * 如果状态未知，会触发后台检查
   */
  isInstalled(): boolean {
    // 如果状态未知，触发后台检查
    if (this.fluxStatus === 'unknown') {
      this.checkFluxInstallationAsync()
    }

    return this.fluxStatus === 'installed'
  }

  /**
   * 强制重新检查 Flux 状态（同步等待结果）
   * 用于需要确保最新状态的场景
   */
  async recheckInstallation(): Promise<boolean> {
    this.fluxStatus = 'checking'
    const installed = await this.checkFluxInstallation()
    this.fluxStatus = installed ? 'installed' : 'not-installed'
    return installed
  }

  /**
   * 检查 Flux 健康状态
   */
  async checkFluxHealth(): Promise<{
    overall: 'healthy' | 'unhealthy' | 'unknown'
    components: Array<{
      name: string
      ready: boolean
      replicas?: number
    }>
  }> {
    if (!this.k8s.isK8sConnected()) {
      return {
        overall: 'unknown',
        components: [],
      }
    }

    if (!this.isInstalled()) {
      return {
        overall: 'unknown',
        components: [],
      }
    }

    try {
      const components = [
        'source-controller',
        'kustomize-controller',
        'helm-controller',
        'notification-controller',
      ]

      const health = await Promise.all(
        components.map(async (name) => {
          try {
            const deployment = (await this.k8s.getDeployment('flux-system', name)) as any
            const ready =
              deployment.status?.readyReplicas === deployment.spec?.replicas &&
              (deployment.status?.readyReplicas || 0) > 0

            return {
              name,
              ready,
              replicas: deployment.status?.replicas || 0,
            }
          } catch (_error) {
            return {
              name,
              ready: false,
              replicas: 0,
            }
          }
        }),
      )

      const overall = health.every((c) => c.ready) ? 'healthy' : 'unhealthy'

      return {
        overall,
        components: health,
      }
    } catch (error: any) {
      console.error('Failed to check Flux health:', error)
      return {
        overall: 'unknown',
        components: [],
      }
    }
  }
}
