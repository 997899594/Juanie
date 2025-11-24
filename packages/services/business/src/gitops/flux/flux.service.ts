import { FluxEvents, K3sEvents } from '@juanie/core/events'
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter'
import { K3sService } from '../k3s/k3s.service'
import { FluxCliService } from './flux-cli.service'
import { FluxMetricsService } from './flux-metrics.service'

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
 */
@Injectable()
export class FluxService implements OnModuleInit {
  private fluxStatus: 'unknown' | 'checking' | 'installed' | 'not-installed' = 'unknown'
  private readonly logger = new Logger(FluxService.name)

  constructor(
    private k3s: K3sService,
    private fluxCli: FluxCliService,
    private metrics: FluxMetricsService,
    private eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit() {
    // 不在这里检查，等待 K3s 连接事件
  }

  /**
   * 监听 K3s 连接成功事件
   * 当 K3s 连接成功后，自动检查 Flux 安装状态
   */
  @OnEvent(K3sEvents.CONNECTED)
  async handleK3sConnected() {
    this.logger.log('收到 K3s 连接成功事件，开始检查 Flux 状态')
    await this.checkFluxInstallationAsync()
  }

  /**
   * 监听 K3s 连接失败事件
   */
  @OnEvent(K3sEvents.CONNECTION_FAILED)
  handleK3sConnectionFailed() {
    this.logger.warn('K3s 连接失败，Flux 功能不可用')
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
      .then((installed) => {
        this.fluxStatus = installed ? 'installed' : 'not-installed'
        this.logger.log(`Flux status: ${this.fluxStatus}`)

        // 发出 Flux 状态检查完成事件
        const event = installed ? FluxEvents.INSTALLED : FluxEvents.NOT_INSTALLED
        this.eventEmitter.emit(event, {
          timestamp: new Date(),
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
    if (!this.k3s.isK3sConnected()) {
      this.logger.debug('K3s not connected, cannot check Flux')
      return false
    }

    try {
      const namespaces = await this.k3s.listNamespaces()
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
    if (!this.k3s.isK3sConnected()) {
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
            const deployment = await this.k3s.getDeployment('flux-system', name)
            const ready =
              deployment.status?.readyReplicas === deployment.spec?.replicas &&
              (deployment.status?.readyReplicas || 0) > 0

            // 记录组件健康状态指标
            this.metrics.updateComponentHealth(name, ready)

            return {
              name,
              ready,
              replicas: deployment.status?.replicas || 0,
            }
          } catch (error) {
            // 记录组件不健康
            this.metrics.updateComponentHealth(name, false)
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
