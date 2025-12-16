import * as schema from '@juanie/core/database'
import { SystemEvents } from '@juanie/core/events'
import { Logger } from '@juanie/core/logger'
import { DEPLOYMENT_QUEUE } from '@juanie/core/queue'
import { DATABASE } from '@juanie/core/tokens'
import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { OnEvent } from '@nestjs/event-emitter'
import type { Queue } from 'bullmq'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { K3sService } from '../k3s/k3s.service'
import { FluxMetricsService } from './flux-metrics.service'

@Injectable()
export class FluxWatcherService implements OnModuleInit, OnModuleDestroy {
  private watchers: Map<string, AbortController> = new Map()
  private isWatching = false

  constructor(
    @Inject(DATABASE) _db: PostgresJsDatabase<typeof schema>,
    @Inject(DEPLOYMENT_QUEUE) _queue: Queue,
    private config: ConfigService,
    private k3s: K3sService,
    _metrics: FluxMetricsService,
    private readonly logger: Logger,
  ) {
    this.logger.setContext(FluxWatcherService.name)
  }

  async onModuleInit() {
    // 检查是否启用 Flux Watcher
    const enableFluxWatcher = this.config.get<string>('ENABLE_FLUX_WATCHER') !== 'false'

    if (!enableFluxWatcher) {
      this.logger.info('ℹ️  Flux Watcher 已禁用（ENABLE_FLUX_WATCHER=false）')
      return
    }

    this.logger.info('ℹ️  Flux Watcher 已初始化，等待 K3s 连接')
  }

  /**
   * 监听 K3s 连接成功事件
   * 当 K3s 连接成功后，自动启动 Flux 监听
   */
  @OnEvent(SystemEvents.K3S_CONNECTED)
  async handleK3sConnected() {
    this.logger.info('收到 K3s 连接成功事件，启动 Flux 监听')
    await this.startWatching()
  }

  async onModuleDestroy() {
    await this.stopWatching()
  }

  /**
   * 启动监听所有 Flux 资源
   */
  async startWatching() {
    if (!this.k3s.isK3sConnected()) {
      this.logger.info('ℹ️  K3s 未连接，跳过 Flux 监听')
      return
    }

    if (this.isWatching) {
      this.logger.info('ℹ️  Flux Watcher 已在运行')
      return
    }

    try {
      // 监听 GitRepository 资源
      await this.watchResource('source.toolkit.fluxcd.io', 'v1', 'gitrepositories')

      // 监听 Kustomization 资源
      await this.watchResource('kustomize.toolkit.fluxcd.io', 'v1', 'kustomizations')

      // 监听 HelmRelease 资源
      await this.watchResource('helm.toolkit.fluxcd.io', 'v2', 'helmreleases')

      this.isWatching = true
      this.logger.info('✅ Flux Watcher 启动成功')
    } catch (_error: any) {
      // 静默失败
      this.logger.info('ℹ️  Flux Watcher 启动失败（Flux 可能未安装）')
    }
  }

  /**
   * 停止所有监听
   */
  async stopWatching() {
    for (const [key, controller] of this.watchers.entries()) {
      try {
        controller.abort()
        this.logger.info(`✅ 停止监听: ${key}`)
      } catch (error: any) {
        this.logger.warn(`⚠️  停止监听失败 ${key}:`, error.message)
      }
    }

    this.watchers.clear()
    this.isWatching = false
  }

  /**
   * 监听特定类型的 Flux 资源
   * Note: This is a placeholder implementation. Full watch functionality requires
   * implementing a custom watch mechanism using BunK8sClient or kubectl.
   */
  private async watchResource(group: string, version: string, plural: string) {
    const key = `${group}/${version}/${plural}`

    this.logger.info(`ℹ️  Flux Watcher for ${key} is not yet implemented with BunK8sClient`)
    this.logger.info(`ℹ️  Consider using polling or kubectl watch as an alternative`)

    // TODO: Implement watch using one of these approaches:
    // 1. Polling with listCustomResources and comparing resourceVersion
    // 2. Using kubectl watch command and parsing output
    // 3. Implementing WebSocket-based watch with BunK8sClient

    // For now, we'll skip watching to avoid errors
    return
  }

  /**
   * 获取监听状态
   */
  getWatcherStatus(): {
    isWatching: boolean
    watchers: string[]
  } {
    return {
      isWatching: this.isWatching,
      watchers: Array.from(this.watchers.keys()),
    }
  }
}
