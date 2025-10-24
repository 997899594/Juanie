import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { z } from 'zod';
import { performance } from 'perf_hooks';
import { WasmRuntime, WasmExecutionResult } from './wasm-runtime';

// 微服务配置Schema
export const MicroserviceConfigSchema = z.object({
  name: z.string(),
  version: z.string(),
  wasmModule: z.string(),
  endpoints: z.array(z.object({
    path: z.string(),
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
    handler: z.string(), // WASM函数名
    middleware: z.array(z.string()).optional(),
    rateLimit: z.object({
      requests: z.number(),
      window: z.number(), // 时间窗口(秒)
    }).optional(),
    auth: z.object({
      required: z.boolean(),
      roles: z.array(z.string()).optional(),
    }).optional(),
  })),
  resources: z.object({
    memory: z.number().default(64), // MB
    cpu: z.number().default(100), // CPU单位
    timeout: z.number().default(30000), // 超时时间(ms)
  }),
  scaling: z.object({
    minInstances: z.number().default(1),
    maxInstances: z.number().default(10),
    targetCPU: z.number().default(70), // CPU使用率阈值
    targetMemory: z.number().default(80), // 内存使用率阈值
  }),
  healthCheck: z.object({
    path: z.string().default('/health'),
    interval: z.number().default(30000), // 健康检查间隔(ms)
    timeout: z.number().default(5000), // 健康检查超时(ms)
    retries: z.number().default(3),
  }),
});

export type MicroserviceConfig = z.infer<typeof MicroserviceConfigSchema>;

// 微服务实例状态
export enum InstanceStatus {
  STARTING = 'starting',
  RUNNING = 'running',
  STOPPING = 'stopping',
  STOPPED = 'stopped',
  ERROR = 'error',
}

// 微服务实例
export class WasmMicroserviceInstance {
  private readonly logger: Logger;
  private status: InstanceStatus = InstanceStatus.STOPPED;
  private lastHealthCheck: Date | null = null;
  private requestCount = 0;
  private errorCount = 0;
  private totalExecutionTime = 0;

  constructor(
    public readonly id: string,
    private config: MicroserviceConfig,
    private wasmRuntime: WasmRuntime,
  ) {
    this.logger = new Logger(`WasmService:${this.config.name}`);
  }

  async start(): Promise<void> {
    try {
      this.status = InstanceStatus.STARTING;
      this.logger.log(`Starting microservice instance: ${this.id}`);

      // 预热WASM模块
      await this.warmup();

      this.status = InstanceStatus.RUNNING;
      this.logger.log(`Microservice instance started: ${this.id}`);
    } catch (error) {
      this.status = InstanceStatus.ERROR;
      this.logger.error(`Failed to start microservice instance ${this.id}:`, error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    this.status = InstanceStatus.STOPPING;
    this.logger.log(`Stopping microservice instance: ${this.id}`);
    
    // 清理资源
    this.status = InstanceStatus.STOPPED;
    this.logger.log(`Microservice instance stopped: ${this.id}`);
  }

  async handleRequest(
    endpoint: string,
    method: string,
    data: any,
    context: any
  ): Promise<any> {
    if (this.status !== InstanceStatus.RUNNING) {
      throw new Error(`Instance ${this.id} is not running (status: ${this.status})`);
    }

    const startTime = performance.now();
    this.requestCount++;

    try {
      // 查找匹配的端点
      const endpointConfig = this.config.endpoints.find(
        ep => ep.path === endpoint && ep.method === method
      );

      if (!endpointConfig) {
        throw new Error(`Endpoint not found: ${method} ${endpoint}`);
      }

      // 执行WASM函数
      const result = await this.wasmRuntime.execute(
        this.config.wasmModule,
        endpointConfig.handler,
        data,
        context
      );

      if (!result.success) {
        this.errorCount++;
        throw new Error(`WASM execution failed: ${result.error}`);
      }

      const executionTime = performance.now() - startTime;
      this.totalExecutionTime += executionTime;

      this.logger.debug(
        `Request handled: ${method} ${endpoint} in ${executionTime.toFixed(2)}ms`
      );

      return result.result;
    } catch (error) {
      this.errorCount++;
      this.logger.error(`Request failed: ${method} ${endpoint}:`, error);
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (this.status !== InstanceStatus.RUNNING) {
        return false;
      }

      // 执行健康检查
      const result = await this.wasmRuntime.execute(
        this.config.wasmModule,
        'health_check'
      );

      this.lastHealthCheck = new Date();
      return result.success;
    } catch (error) {
      this.logger.warn(`Health check failed for instance ${this.id}:`, error);
      return false;
    }
  }

  private async warmup(): Promise<void> {
    // 预热WASM模块，执行一些初始化操作
    try {
      await this.wasmRuntime.execute(this.config.wasmModule, 'init');
    } catch (error) {
      // 初始化函数可能不存在，这是正常的
      this.logger.debug(`No init function found for ${this.config.wasmModule}`);
    }
  }

  getMetrics() {
    const avgExecutionTime = this.requestCount > 0 
      ? this.totalExecutionTime / this.requestCount 
      : 0;

    return {
      id: this.id,
      status: this.status,
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      errorRate: this.requestCount > 0 ? this.errorCount / this.requestCount : 0,
      avgExecutionTime,
      lastHealthCheck: this.lastHealthCheck,
    };
  }
}

// 负载均衡器
export class WasmLoadBalancer {
  private readonly logger = new Logger(WasmLoadBalancer.name);
  private instances: WasmMicroserviceInstance[] = [];
  private currentIndex = 0;

  addInstance(instance: WasmMicroserviceInstance): void {
    this.instances.push(instance);
    this.logger.debug(`Added instance to load balancer: ${instance.id}`);
  }

  removeInstance(instanceId: string): void {
    const index = this.instances.findIndex(i => i.id === instanceId);
    if (index !== -1) {
      this.instances.splice(index, 1);
      this.logger.debug(`Removed instance from load balancer: ${instanceId}`);
    }
  }

  getNextInstance(): WasmMicroserviceInstance | null {
    const healthyInstances = this.instances.filter(
      i => i.getMetrics().status === InstanceStatus.RUNNING
    );

    if (healthyInstances.length === 0) {
      return null;
    }

    // 轮询负载均衡
    const instance = healthyInstances[this.currentIndex % healthyInstances.length];
    this.currentIndex++;
    
    return instance;
  }

  getInstanceByLeastConnections(): WasmMicroserviceInstance | null {
    const healthyInstances = this.instances.filter(
      i => i.getMetrics().status === InstanceStatus.RUNNING
    );

    if (healthyInstances.length === 0) {
      return null;
    }

    // 选择请求数最少的实例
    return healthyInstances.reduce((min, current) => 
      current.getMetrics().requestCount < min.getMetrics().requestCount ? current : min
    );
  }

  getStats() {
    return {
      totalInstances: this.instances.length,
      healthyInstances: this.instances.filter(
        i => i.getMetrics().status === InstanceStatus.RUNNING
      ).length,
      instances: this.instances.map(i => i.getMetrics()),
    };
  }
}

// 微服务编排器
@Injectable()
export class WasmMicroserviceOrchestrator implements OnModuleInit {
  private readonly logger = new Logger(WasmMicroserviceOrchestrator.name);
  private services = new Map<string, WasmLoadBalancer>();
  private configs = new Map<string, MicroserviceConfig>();
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(
    private wasmRuntime: WasmRuntime,
    private configService: ConfigService,
    private eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.loadMicroservices();
    this.startHealthChecks();
  }

  private async loadMicroservices(): Promise<void> {
    // 从配置文件加载微服务定义
    const servicesConfig = this.configService.get<MicroserviceConfig[]>('microservices', []);
    
    for (const config of servicesConfig) {
      await this.deployMicroservice(config);
    }

    this.logger.log(`Loaded ${servicesConfig.length} microservices`);
  }

  async deployMicroservice(config: MicroserviceConfig): Promise<void> {
    try {
      // 验证配置
      const validatedConfig = MicroserviceConfigSchema.parse(config);
      
      // 创建负载均衡器
      const loadBalancer = new WasmLoadBalancer();
      
      // 创建初始实例
      for (let i = 0; i < validatedConfig.scaling.minInstances; i++) {
        const instance = await this.createInstance(validatedConfig);
        await instance.start();
        loadBalancer.addInstance(instance);
      }

      // 注册服务
      this.services.set(validatedConfig.name, loadBalancer);
      this.configs.set(validatedConfig.name, validatedConfig);

      // 发布部署事件
      await this.eventEmitter.emitAsync('microservice.deployed', {
        name: validatedConfig.name,
        version: validatedConfig.version,
        instances: validatedConfig.scaling.minInstances,
      });

      this.logger.log(`Deployed microservice: ${validatedConfig.name} v${validatedConfig.version}`);
    } catch (error) {
      this.logger.error(`Failed to deploy microservice ${config.name}:`, error);
      throw error;
    }
  }

  private async createInstance(config: MicroserviceConfig): Promise<WasmMicroserviceInstance> {
    const instanceId = `${config.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    return new WasmMicroserviceInstance(instanceId, config, this.wasmRuntime);
  }

  async handleRequest(
    serviceName: string,
    endpoint: string,
    method: string,
    data: any,
    context: any = {}
  ): Promise<any> {
    const loadBalancer = this.services.get(serviceName);
    if (!loadBalancer) {
      throw new Error(`Microservice not found: ${serviceName}`);
    }

    // 获取可用实例
    const instance = loadBalancer.getNextInstance();
    if (!instance) {
      throw new Error(`No healthy instances available for service: ${serviceName}`);
    }

    try {
      // 处理请求
      const result = await instance.handleRequest(endpoint, method, data, context);
      
      // 发布请求事件
      await this.eventEmitter.emitAsync('microservice.request.completed', {
        serviceName,
        instanceId: instance.id,
        endpoint,
        method,
        success: true,
      });

      return result;
    } catch (error) {
      // 发布错误事件
      await this.eventEmitter.emitAsync('microservice.request.failed', {
        serviceName,
        instanceId: instance.id,
        endpoint,
        method,
        error: error.message,
      });

      throw error;
    }
  }

  async scaleService(serviceName: string, targetInstances: number): Promise<void> {
    const loadBalancer = this.services.get(serviceName);
    const config = this.configs.get(serviceName);
    
    if (!loadBalancer || !config) {
      throw new Error(`Service not found: ${serviceName}`);
    }

    const currentStats = loadBalancer.getStats();
    const currentInstances = currentStats.totalInstances;

    if (targetInstances > currentInstances) {
      // 扩容
      const instancesToAdd = targetInstances - currentInstances;
      for (let i = 0; i < instancesToAdd; i++) {
        const instance = await this.createInstance(config);
        await instance.start();
        loadBalancer.addInstance(instance);
      }
      this.logger.log(`Scaled up ${serviceName}: ${currentInstances} -> ${targetInstances}`);
    } else if (targetInstances < currentInstances) {
      // 缩容
      const instancesToRemove = currentInstances - targetInstances;
      const instances = currentStats.instances
        .sort((a, b) => a.requestCount - b.requestCount) // 优先移除请求少的实例
        .slice(0, instancesToRemove);

      for (const instanceMetrics of instances) {
        loadBalancer.removeInstance(instanceMetrics.id);
      }
      this.logger.log(`Scaled down ${serviceName}: ${currentInstances} -> ${targetInstances}`);
    }

    // 发布扩缩容事件
    await this.eventEmitter.emitAsync('microservice.scaled', {
      serviceName,
      previousInstances: currentInstances,
      currentInstances: targetInstances,
    });
  }

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      for (const [serviceName, loadBalancer] of this.services) {
        const stats = loadBalancer.getStats();
        
        // 检查是否需要自动扩缩容
        await this.checkAutoScaling(serviceName, stats);
      }
    }, 30000); // 每30秒检查一次

    this.logger.debug('Health check scheduler started');
  }

  private async checkAutoScaling(serviceName: string, stats: any): Promise<void> {
    const config = this.configs.get(serviceName);
    if (!config) return;

    const healthyInstances = stats.healthyInstances;
    const { minInstances, maxInstances, targetCPU } = config.scaling;

    // 简单的自动扩缩容逻辑
    const avgErrorRate = stats.instances.reduce((sum: number, i: any) => sum + i.errorRate, 0) / stats.instances.length;
    
    if (avgErrorRate > 0.1 && healthyInstances < maxInstances) {
      // 错误率高，扩容
      await this.scaleService(serviceName, Math.min(healthyInstances + 1, maxInstances));
    } else if (avgErrorRate < 0.01 && healthyInstances > minInstances) {
      // 错误率低，缩容
      await this.scaleService(serviceName, Math.max(healthyInstances - 1, minInstances));
    }
  }

  // 获取服务列表
  getServices(): Array<{ name: string; config: MicroserviceConfig; stats: any }> {
    return Array.from(this.services.entries()).map(([name, loadBalancer]) => ({
      name,
      config: this.configs.get(name)!,
      stats: loadBalancer.getStats(),
    }));
  }

  // 获取服务详情
  getServiceDetails(serviceName: string) {
    const loadBalancer = this.services.get(serviceName);
    const config = this.configs.get(serviceName);
    
    if (!loadBalancer || !config) {
      return null;
    }

    return {
      name: serviceName,
      config,
      stats: loadBalancer.getStats(),
    };
  }

  // 停止服务
  async stopService(serviceName: string): Promise<void> {
    const loadBalancer = this.services.get(serviceName);
    if (!loadBalancer) {
      throw new Error(`Service not found: ${serviceName}`);
    }

    // 停止所有实例
    const stats = loadBalancer.getStats();
    for (const instanceMetrics of stats.instances) {
      loadBalancer.removeInstance(instanceMetrics.id);
    }

    // 移除服务
    this.services.delete(serviceName);
    this.configs.delete(serviceName);

    await this.eventEmitter.emitAsync('microservice.stopped', { serviceName });
    this.logger.log(`Stopped microservice: ${serviceName}`);
  }

  // 清理资源
  async cleanup(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // 停止所有服务
    for (const serviceName of this.services.keys()) {
      await this.stopService(serviceName);
    }

    this.logger.log('Microservice orchestrator cleaned up');
  }
}