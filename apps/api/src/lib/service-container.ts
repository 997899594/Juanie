import type { INestApplicationContext } from "@nestjs/common";
import { AuthService } from "../modules/auth/services/auth.service";
import { DrizzleService } from "../drizzle/drizzle.service";
import { GitService } from "../modules/git/services/git.service";
import { HealthService } from "../modules/health/services/health.service";

/**
 * 服务容器 - 管理 NestJS 服务实例的生命周期
 * 
 * 架构设计原则：
 * 1. 单一职责：专门负责服务实例的管理和缓存
 * 2. 延迟初始化：只在需要时才初始化服务
 * 3. 错误处理：提供详细的错误信息和恢复机制
 * 4. 类型安全：确保所有服务都有正确的类型定义
 */
export class ServiceContainer {
  private static instance: ServiceContainer | null = null;
  private nestApp: INestApplicationContext | null = null;
  private services: Map<string, any> = new Map();
  private initializationPromise: Promise<void> | null = null;
  private isInitialized = false;

  private constructor() {}

  /**
   * 获取服务容器单例
   */
  static getInstance(): ServiceContainer {
    if (!ServiceContainer.instance) {
      ServiceContainer.instance = new ServiceContainer();
    }
    return ServiceContainer.instance;
  }

  /**
   * 初始化服务容器
   * @param nestApp NestJS 应用上下文
   */
  async initialize(nestApp: INestApplicationContext): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._doInitialize(nestApp);
    await this.initializationPromise;
  }

  private async _doInitialize(nestApp: INestApplicationContext): Promise<void> {
    try {
      console.log("🔧 开始初始化服务容器...");
      
      this.nestApp = nestApp;
      
      // 预热关键服务，确保它们正确初始化
      await this._preloadServices();
      
      this.isInitialized = true;
      console.log("✅ 服务容器初始化完成");
    } catch (error) {
      console.error("❌ 服务容器初始化失败:", error);
      this.initializationPromise = null;
      throw error;
    }
  }

  /**
   * 预加载关键服务，确保依赖注入正确工作
   */
  private async _preloadServices(): Promise<void> {
    if (!this.nestApp) {
      throw new Error("NestJS 应用未初始化");
    }

    try {
      // 按依赖顺序预加载服务
      console.log("🔄 预加载 DrizzleService...");
      const drizzleService = this.nestApp.get(DrizzleService);
      this.services.set('DrizzleService', drizzleService);

      console.log("🔄 预加载 AuthService...");
      const authService = this.nestApp.get(AuthService);
      this.services.set('AuthService', authService);

      console.log("🔄 预加载 HealthService...");
      const healthService = this.nestApp.get(HealthService);
      this.services.set('HealthService', healthService);

      console.log("🔄 预加载 GitService...");
      const gitService = this.nestApp.get(GitService);
      this.services.set('GitService', gitService);

      console.log("✅ 所有服务预加载完成");
    } catch (error) {
      console.error("❌ 服务预加载失败:", error);
      throw new Error(`服务预加载失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 获取服务实例（带缓存）
   */
  getService<T>(serviceClass: new (...args: any[]) => T): T {
    if (!this.isInitialized || !this.nestApp) {
      throw new Error("服务容器未初始化，请先调用 initialize() 方法");
    }

    const serviceName = serviceClass.name;
    
    // 先从缓存获取
    if (this.services.has(serviceName)) {
      return this.services.get(serviceName);
    }

    // 从 NestJS 容器获取并缓存
    try {
      const service = this.nestApp.get(serviceClass);
      this.services.set(serviceName, service);
      return service;
    } catch (error) {
      throw new Error(`获取服务 ${serviceName} 失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 获取所有预加载的服务
   */
  getAllServices() {
    if (!this.isInitialized) {
      throw new Error("服务容器未初始化");
    }

    return {
      authService: this.services.get('AuthService') as AuthService,
      drizzleService: this.services.get('DrizzleService') as DrizzleService,
      healthService: this.services.get('HealthService') as HealthService,
      gitService: this.services.get('GitService') as GitService,
    };
  }

  /**
   * 检查服务容器是否已初始化
   */
  get initialized(): boolean {
    return this.isInitialized;
  }

  /**
   * 清理服务容器
   */
  async cleanup(): Promise<void> {
    this.services.clear();
    this.nestApp = null;
    this.isInitialized = false;
    this.initializationPromise = null;
    console.log("🧹 服务容器已清理");
  }

  /**
   * 重置服务容器（用于测试）
   */
  static reset(): void {
    if (ServiceContainer.instance) {
      ServiceContainer.instance.cleanup();
      ServiceContainer.instance = null;
    }
  }
}

/**
 * 便捷函数：获取服务容器实例
 */
export function getServiceContainer(): ServiceContainer {
  return ServiceContainer.getInstance();
}