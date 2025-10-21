import { Injectable, OnModuleInit } from "@nestjs/common";
import { ModuleRef } from '@nestjs/core';
import { DiscoveryService, MetadataScanner } from '@nestjs/core';
import type { AnyRouter } from '@trpc/server';
import { AuthRouter } from "./routers/auth.decorator.router";
import { GitLabRouter } from "./routers/gitlab.decorator.router";
import { DocumentsRouter } from "./routers/documents.decorator.router";

@Injectable()
export class TrpcService implements OnModuleInit {
  private _appRouter: AnyRouter | null = null;
  private _routers: Map<string, AnyRouter> = new Map();

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly discoveryService: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
    private readonly authRouter: AuthRouter,
    private readonly gitlabRouter: GitLabRouter,
    private readonly documentsRouter: DocumentsRouter
  ) {}

  async onModuleInit() {
    // 手动注册路由器
    this.registerRouters([
      this.authRouter,
      this.gitlabRouter,
      this.documentsRouter,
    ]);
  }

  /**
   * 手动注册路由器数组
   */
  registerRouters(routers: any[]) {
    // 这里暂时使用简单的实现，实际应该根据装饰器元数据构建路由器
    // 由于缺少完整的@trpc/nest包实现，这里提供基本结构
    console.log('Registering routers:', routers.map(r => r.constructor.name));
  }

  /**
   * 获取应用路由器
   */
  get appRouter(): AnyRouter {
    if (!this._appRouter) {
      // 创建一个基本的空路由器作为占位符
      // 实际实现需要根据注册的路由器构建
      return {} as AnyRouter;
    }
    return this._appRouter;
  }

  /**
   * 获取路由器统计信息
   */
  getStats() {
    return {
      totalRouters: this._routers.size,
      routerNames: Array.from(this._routers.keys()),
      hasAppRouter: !!this._appRouter,
    };
  }
}

export type AppRouter = TrpcService["appRouter"];
