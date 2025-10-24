import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { performance } from 'perf_hooks';
import * as fs from 'fs/promises';
import * as path from 'path';

// WASM模块配置Schema
export const WasmModuleConfigSchema = z.object({
  name: z.string(),
  path: z.string(),
  memory: z.object({
    initial: z.number().default(1), // 初始内存页数
    maximum: z.number().optional(), // 最大内存页数
  }).default({ initial: 1 }),
  imports: z.record(z.any()).optional(),
  exports: z.array(z.string()).optional(),
  timeout: z.number().default(5000), // 执行超时时间(ms)
});

export type WasmModuleConfig = z.infer<typeof WasmModuleConfigSchema>;

// WASM执行结果
export interface WasmExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
  executionTime: number;
  memoryUsage: number;
}

// WASM模块实例
export class WasmModuleInstance {
  private instance: WebAssembly.Instance | null = null;
  private memory: WebAssembly.Memory | null = null;
  private readonly logger: Logger;

  constructor(
    private config: WasmModuleConfig,
    private wasmBytes: Uint8Array,
  ) {
    this.logger = new Logger(`WasmModule:${this.config.name}`);
  }

  async initialize(): Promise<void> {
    try {
      const startTime = performance.now();

      // 创建内存实例
      this.memory = new WebAssembly.Memory({
        initial: this.config.memory.initial,
        maximum: this.config.memory.maximum,
      });

      // 准备导入对象
      const imports = {
        env: {
          memory: this.memory,
          // 标准库函数
          abort: () => {
            throw new Error('WASM module aborted');
          },
          // 日志函数
          console_log: (ptr: number, len: number) => {
            const bytes = new Uint8Array(this.memory!.buffer, ptr, len);
            const message = new TextDecoder().decode(bytes);
            this.logger.log(`[WASM] ${message}`);
          },
          // 性能计时
          performance_now: () => performance.now(),
          ...this.config.imports,
        },
      };

      // 编译和实例化WASM模块
      const module = await WebAssembly.compile(this.wasmBytes as BufferSource);
      this.instance = await WebAssembly.instantiate(module, imports);

      const initTime = performance.now() - startTime;
      this.logger.log(`WASM module '${this.config.name}' initialized in ${initTime.toFixed(2)}ms`);
    } catch (error) {
      this.logger.error(`Failed to initialize WASM module '${this.config.name}':`, error);
      throw error;
    }
  }

  async execute(functionName: string, ...args: any[]): Promise<WasmExecutionResult> {
    if (!this.instance) {
      throw new Error(`WASM module '${this.config.name}' not initialized`);
    }

    const startTime = performance.now();
    const initialMemory = this.getMemoryUsage();

    try {
      // 获取导出的函数
      const exports = this.instance.exports as any;
      const func = exports[functionName];

      if (!func || typeof func !== 'function') {
        throw new Error(`Function '${functionName}' not found in WASM module`);
      }

      // 执行函数（带超时控制）
      const result = await this.executeWithTimeout(func, args, this.config.timeout);
      
      const executionTime = performance.now() - startTime;
      const memoryUsage = this.getMemoryUsage() - initialMemory;

      this.logger.debug(
        `Executed ${functionName} in ${executionTime.toFixed(2)}ms, memory: ${memoryUsage} bytes`
      );

      return {
        success: true,
        result,
        executionTime,
        memoryUsage,
      };
    } catch (error) {
      const executionTime = performance.now() - startTime;
      const memoryUsage = this.getMemoryUsage() - initialMemory;

      this.logger.error(`WASM execution failed for ${functionName}:`, error);

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime,
        memoryUsage,
      };
    }
  }

  private async executeWithTimeout(func: Function, args: any[], timeout: number): Promise<any> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`WASM execution timeout after ${timeout}ms`));
      }, timeout);

      try {
        const result = func(...args);
        clearTimeout(timer);
        resolve(result);
      } catch (error) {
        clearTimeout(timer);
        reject(error);
      }
    });
  }

  private getMemoryUsage(): number {
    return this.memory ? this.memory.buffer.byteLength : 0;
  }

  getExports(): string[] {
    if (!this.instance) {
      return [];
    }
    return Object.keys(this.instance.exports);
  }

  dispose(): void {
    this.instance = null;
    this.memory = null;
    this.logger.debug(`WASM module '${this.config.name}' disposed`);
  }
}

// WASM运行时管理器
@Injectable()
export class WasmRuntime implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WasmRuntime.name);
  private modules = new Map<string, WasmModuleInstance>();
  private moduleConfigs = new Map<string, WasmModuleConfig>();

  constructor(private configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    await this.loadModules();
  }

  async onModuleDestroy(): Promise<void> {
    this.disposeAllModules();
  }

  private async loadModules(): Promise<void> {
    const wasmDir = this.configService.get<string>('WASM_MODULES_DIR', './wasm-modules');
    
    try {
      // 检查WASM模块目录是否存在
      await fs.access(wasmDir);
      
      // 扫描WASM文件
      const files = await fs.readdir(wasmDir);
      const wasmFiles = files.filter(file => file.endsWith('.wasm'));

      this.logger.log(`Found ${wasmFiles.length} WASM modules in ${wasmDir}`);

      // 加载每个WASM模块
      for (const file of wasmFiles) {
        await this.loadModule(path.join(wasmDir, file));
      }
    } catch (error) {
      this.logger.warn(`WASM modules directory not found: ${wasmDir}`);
      // 创建示例模块配置
      await this.createExampleModules();
    }
  }

  private async loadModule(filePath: string): Promise<void> {
    try {
      const moduleName = path.basename(filePath, '.wasm');
      const wasmBytes = await fs.readFile(filePath);

      // 默认配置
      const config: WasmModuleConfig = {
        name: moduleName,
        path: filePath,
        memory: { initial: 1 },
        timeout: 5000,
      };

      // 尝试加载配置文件
      const configPath = filePath.replace('.wasm', '.config.json');
      try {
        const configData = await fs.readFile(configPath, 'utf-8');
        const userConfig = JSON.parse(configData);
        Object.assign(config, userConfig);
      } catch {
        // 配置文件不存在，使用默认配置
      }

      // 验证配置
      const validatedConfig = WasmModuleConfigSchema.parse(config);
      
      // 创建模块实例
      const moduleInstance = new WasmModuleInstance(validatedConfig, wasmBytes);
      await moduleInstance.initialize();

      // 注册模块
      this.modules.set(moduleName, moduleInstance);
      this.moduleConfigs.set(moduleName, validatedConfig);

      this.logger.log(`Loaded WASM module: ${moduleName}`);
    } catch (error) {
      this.logger.error(`Failed to load WASM module from ${filePath}:`, error);
    }
  }

  private async createExampleModules(): Promise<void> {
    // 创建示例WASM模块（简单的数学计算）
    const exampleWasm = new Uint8Array([
      0x00, 0x61, 0x73, 0x6d, // WASM魔数
      0x01, 0x00, 0x00, 0x00, // 版本
      // 这里应该是实际的WASM字节码
      // 为了演示，我们创建一个空的模块
    ]);

    const config: WasmModuleConfig = {
      name: 'example',
      path: 'example.wasm',
      memory: { initial: 1 },
      timeout: 1000,
    };

    // 注意：这只是示例，实际应用中需要真正的WASM字节码
    this.logger.warn('Using example WASM module - replace with actual WASM files');
  }

  // 执行WASM函数
  async execute(
    moduleName: string,
    functionName: string,
    ...args: any[]
  ): Promise<WasmExecutionResult> {
    const module = this.modules.get(moduleName);
    if (!module) {
      throw new Error(`WASM module '${moduleName}' not found`);
    }

    return module.execute(functionName, ...args);
  }

  // 获取模块信息
  getModuleInfo(moduleName: string) {
    const module = this.modules.get(moduleName);
    const config = this.moduleConfigs.get(moduleName);
    
    if (!module || !config) {
      return null;
    }

    return {
      name: config.name,
      path: config.path,
      exports: module.getExports(),
      config,
    };
  }

  // 获取所有模块列表
  getModules(): string[] {
    return Array.from(this.modules.keys());
  }

  // 重新加载模块
  async reloadModule(moduleName: string): Promise<void> {
    const config = this.moduleConfigs.get(moduleName);
    if (!config) {
      throw new Error(`Module config for '${moduleName}' not found`);
    }

    // 销毁旧模块
    const oldModule = this.modules.get(moduleName);
    if (oldModule) {
      oldModule.dispose();
    }

    // 重新加载
    await this.loadModule(config.path);
  }

  // 销毁所有模块
  private disposeAllModules(): void {
    for (const [name, module] of this.modules) {
      module.dispose();
      this.logger.debug(`Disposed WASM module: ${name}`);
    }
    this.modules.clear();
    this.moduleConfigs.clear();
  }

  // 获取运行时统计信息
  getStats() {
    return {
      totalModules: this.modules.size,
      modules: Array.from(this.modules.keys()).map(name => ({
        name,
        info: this.getModuleInfo(name),
      })),
    };
  }
}

// WASM服务装饰器
export function WasmService(moduleName: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const wasmRuntime = this.wasmRuntime as WasmRuntime;
      if (!wasmRuntime) {
        throw new Error('WasmRuntime not injected');
      }

      // 执行WASM函数
      const result = await wasmRuntime.execute(moduleName, propertyKey, ...args);
      
      if (!result.success) {
        throw new Error(`WASM execution failed: ${result.error}`);
      }

      return result.result;
    };

    return descriptor;
  };
}