import { Injectable, type OnModuleInit } from '@nestjs/common'
import { ModuleRef } from '@nestjs/core'
import { DiscoveryService, MetadataScanner } from '@nestjs/core'
import type { AnyRouter } from '@trpc/server'
import { 
  buildRouterFromService, 
  mergeRouters, 
  validateRouterConfig,
  type RouterBuilderOptions 
} from './utils/router-builder.utils.js'
import { isTrpcRouter, getTrpcRouterMetadata } from './utils/metadata.utils.js'
import type { TrpcModuleOptions } from './interfaces/trpc-options.interface.js'

/**
 * tRPC 核心服务
 * 负责发现和注册 tRPC 路由器，构建最终的路由器树
 */
@Injectable()
export class TrpcService implements OnModuleInit {
  private _appRouter: AnyRouter | null = null
  private _routers: Map<string, AnyRouter> = new Map()
  private _options: TrpcModuleOptions | null = null

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly discoveryService: DiscoveryService,
    private readonly metadataScanner: MetadataScanner
  ) {}

  /**
   * 模块初始化时自动发现和注册路由器
   */
  async onModuleInit() {
    await this.discoverRouters()
    this.buildAppRouter()
  }

  /**
   * 设置 tRPC 配置选项
   */
  setOptions(options: TrpcModuleOptions) {
    this._options = options
  }

  /**
   * 获取应用路由器
   */
  getAppRouter(): AnyRouter {
    if (!this._appRouter) {
      throw new Error('App router not initialized. Make sure TrpcModule is properly configured.')
    }
    return this._appRouter
  }

  /**
   * 获取特定名称的路由器
   */
  getRouter(name: string): AnyRouter | undefined {
    return this._routers.get(name)
  }

  /**
   * 获取所有路由器
   */
  getAllRouters(): Map<string, AnyRouter> {
    return new Map(this._routers)
  }

  /**
   * 手动注册路由器
   */
  registerRouter(name: string, router: AnyRouter) {
    this._routers.set(name, router)
    this.buildAppRouter()
  }

  /**
   * 手动注册服务类作为路由器
   */
  async registerService(serviceClass: any, serviceName?: string) {
    if (!isTrpcRouter(serviceClass)) {
      throw new Error(`Service ${serviceClass.name} is not decorated with @TrpcRouter`)
    }

    if (!validateRouterConfig(serviceClass)) {
      throw new Error(`Invalid router configuration for ${serviceClass.name}`)
    }

    const serviceInstance = await this.moduleRef.get(serviceClass, { strict: false })
    const routerMetadata = getTrpcRouterMetadata(serviceClass)
    const routerName = serviceName || routerMetadata?.name || serviceClass.name

    const router = this.buildServiceRouter(serviceClass, serviceInstance)
    this._routers.set(routerName, router)
    
    this.buildAppRouter()
  }

  /**
   * 自动发现所有 tRPC 路由器
   */
  private async discoverRouters() {
    if (!this._options) {
      throw new Error('TrpcService options not set. Make sure TrpcModule is properly configured.')
    }

    const providers = this.discoveryService.getProviders()
    
    for (const wrapper of providers) {
      if (!wrapper.metatype || !wrapper.instance) {
        continue
      }

      const { metatype, instance } = wrapper
      
      if (isTrpcRouter(metatype)) {
        if (!validateRouterConfig(metatype)) {
          console.warn(`Invalid router configuration for ${metatype.name}, skipping...`)
          continue
        }

        const routerMetadata = getTrpcRouterMetadata(metatype)
        const routerName = routerMetadata?.name || metatype.name
        
        try {
          const router = this.buildServiceRouter(metatype, instance)
          this._routers.set(routerName, router)
          
          if (this._options.development) {
            console.log(`✅ Registered tRPC router: ${routerName}`)
          }
        } catch (error) {
          console.error(`❌ Failed to register tRPC router ${routerName}:`, error)
        }
      }
    }
  }

  /**
   * 从服务类构建路由器
   */
  private buildServiceRouter(serviceClass: any, serviceInstance: any): AnyRouter {
    if (!this._options) {
      throw new Error('TrpcService options not set')
    }

    const builderOptions: RouterBuilderOptions = {
      trpc: this._options.trpc,
      createContext: this._options.createContext,
      development: this._options.development,
    }

    return buildRouterFromService(serviceClass, serviceInstance, builderOptions)
  }

  /**
   * 构建应用级路由器
   */
  private buildAppRouter() {
    if (!this._options) {
      throw new Error('TrpcService options not set')
    }

    if (this._routers.size === 0) {
      // 创建空路由器
      this._appRouter = this._options.trpc.router({})
      return
    }

    // 将所有路由器合并为一个应用路由器
    const routerObject: Record<string, AnyRouter> = {}
    
    for (const [name, router] of this._routers) {
      routerObject[name] = router
    }

    this._appRouter = mergeRouters(this._options.trpc, routerObject)

    if (this._options.development) {
      console.log(`🚀 Built tRPC app router with ${this._routers.size} sub-routers:`, 
        Array.from(this._routers.keys()).join(', '))
    }
  }

  /**
   * 获取路由器统计信息
   */
  getStats() {
    return {
      totalRouters: this._routers.size,
      routerNames: Array.from(this._routers.keys()),
      hasAppRouter: !!this._appRouter,
      options: {
        development: this._options?.development,
        prefix: this._options?.prefix,
        useGlobalPrefix: this._options?.useGlobalPrefix,
      }
    }
  }
}