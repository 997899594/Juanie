/**
 * 🚀 Juanie AI - Ollama本地AI服务
 * 集成和管理本地Ollama AI模型
 */

import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { z } from 'zod';
import { 
  withTimeout, 
  retry, 
  CONSTANTS,
  getEnvVar,
  getBooleanEnvVar,
  type AITask,
  type AIResult,
} from '../core';

// ============================================================================
// Ollama配置Schema
// ============================================================================

export const OllamaModelSchema = z.object({
  name: z.string(),
  tag: z.string().default('latest'),
  size: z.number().optional(),
  digest: z.string().optional(),
  modified_at: z.string().optional(),
  details: z.object({
    parent_model: z.string().optional(),
    format: z.string().optional(),
    family: z.string().optional(),
    families: z.array(z.string()).optional(),
    parameter_size: z.string().optional(),
    quantization_level: z.string().optional(),
  }).optional(),
});

export const OllamaGenerateRequestSchema = z.object({
  model: z.string(),
  prompt: z.string(),
  suffix: z.string().optional(),
  images: z.array(z.string()).optional(), // Base64编码的图片
  format: z.enum(['json']).optional(),
  options: z.object({
    temperature: z.number().min(0).max(2).optional(),
    top_k: z.number().optional(),
    top_p: z.number().min(0).max(1).optional(),
    repeat_penalty: z.number().optional(),
    seed: z.number().optional(),
    num_predict: z.number().optional(),
    stop: z.array(z.string()).optional(),
  }).optional(),
  system: z.string().optional(),
  template: z.string().optional(),
  context: z.array(z.number()).optional(),
  stream: z.boolean().default(false),
  raw: z.boolean().default(false),
  keep_alive: z.string().optional(),
});

export const OllamaGenerateResponseSchema = z.object({
  model: z.string(),
  created_at: z.string(),
  response: z.string(),
  done: z.boolean(),
  context: z.array(z.number()).optional(),
  total_duration: z.number().optional(),
  load_duration: z.number().optional(),
  prompt_eval_count: z.number().optional(),
  prompt_eval_duration: z.number().optional(),
  eval_count: z.number().optional(),
  eval_duration: z.number().optional(),
});

export const OllamaChatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string(),
  images: z.array(z.string()).optional(),
});

export const OllamaChatRequestSchema = z.object({
  model: z.string(),
  messages: z.array(OllamaChatMessageSchema),
  format: z.enum(['json']).optional(),
  options: z.object({
    temperature: z.number().min(0).max(2).optional(),
    top_k: z.number().optional(),
    top_p: z.number().min(0).max(1).optional(),
    repeat_penalty: z.number().optional(),
    seed: z.number().optional(),
    num_predict: z.number().optional(),
    stop: z.array(z.string()).optional(),
  }).optional(),
  stream: z.boolean().default(false),
  keep_alive: z.string().optional(),
});

export type OllamaModel = z.infer<typeof OllamaModelSchema>;
export type OllamaGenerateRequest = z.infer<typeof OllamaGenerateRequestSchema>;
export type OllamaGenerateResponse = z.infer<typeof OllamaGenerateResponseSchema>;
export type OllamaChatMessage = z.infer<typeof OllamaChatMessageSchema>;
export type OllamaChatRequest = z.infer<typeof OllamaChatRequestSchema>;

// ============================================================================
// Ollama服务
// ============================================================================

@Injectable()
export class OllamaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OllamaService.name);
  
  private baseURL: string;
  private enabled: boolean;
  private availableModels: Map<string, OllamaModel> = new Map();
  private modelStats: Map<string, {
    totalRequests: number;
    totalTokens: number;
    averageLatency: number;
    errorCount: number;
    lastUsed: Date;
  }> = new Map();
  
  // 连接状态
  private isConnected = false;
  private connectionCheckInterval: NodeJS.Timeout | null = null;
  
  // 请求队列和限流
  private requestQueue: Array<{
    id: string;
    request: () => Promise<any>;
    resolve: (value: any) => void;
    reject: (error: any) => void;
    timestamp: Date;
  }> = [];
  private processingRequests = 0;
  private maxConcurrentRequests = 5;

  constructor(
    private eventEmitter: EventEmitter2,
  ) {
    this.baseURL = getEnvVar('OLLAMA_BASE_URL', 'http://localhost:11434');
    this.enabled = getBooleanEnvVar('OLLAMA_ENABLED', true);
  }

  async onModuleInit() {
    if (this.enabled) {
      await this.initialize();
    }
  }

  async onModuleDestroy() {
    await this.cleanup();
  }

  /**
   * 初始化Ollama服务
   */
  private async initialize(): Promise<void> {
    try {
      this.logger.log('Initializing Ollama service...');
      
      // 检查Ollama服务连接
      await this.checkConnection();
      
      // 获取可用模型
      await this.loadAvailableModels();
      
      // 启动连接监控
      this.startConnectionMonitoring();
      
      // 启动请求处理器
      this.startRequestProcessor();
      
      this.logger.log(`Ollama service initialized with ${this.availableModels.size} models`);
    } catch (error) {
      this.logger.error('Failed to initialize Ollama service', error);
      this.enabled = false;
    }
  }

  /**
   * 检查连接状态
   */
  private async checkConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/api/version`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000), // 5秒超时
      });
      
      if (response.ok) {
        const version = await response.json();
        this.isConnected = true;
        this.logger.debug(`Connected to Ollama version: ${version.version || 'unknown'}`);
        return true;
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      this.isConnected = false;
      this.logger.warn('Ollama connection failed', error);
      return false;
    }
  }

  /**
   * 加载可用模型
   */
  private async loadAvailableModels(): Promise<void> {
    try {
      const response = await fetch(`${this.baseURL}/api/tags`);
      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status}`);
      }
      
      const data = await response.json();
      const models = data.models || [];
      
      this.availableModels.clear();
      
      for (const model of models) {
        const parsedModel = OllamaModelSchema.parse(model);
        this.availableModels.set(parsedModel.name, parsedModel);
        
        // 初始化模型统计
        if (!this.modelStats.has(parsedModel.name)) {
          this.modelStats.set(parsedModel.name, {
            totalRequests: 0,
            totalTokens: 0,
            averageLatency: 0,
            errorCount: 0,
            lastUsed: new Date(),
          });
        }
      }
      
      this.logger.log(`Loaded ${this.availableModels.size} Ollama models: ${Array.from(this.availableModels.keys()).join(', ')}`);
    } catch (error) {
      this.logger.error('Failed to load available models', error);
      throw error;
    }
  }

  /**
   * 启动连接监控
   */
  private startConnectionMonitoring(): void {
    this.connectionCheckInterval = setInterval(async () => {
      const wasConnected = this.isConnected;
      await this.checkConnection();
      
      if (wasConnected !== this.isConnected) {
        this.eventEmitter.emit('ollama.connection.changed', {
          connected: this.isConnected,
          timestamp: new Date(),
        });
        
        if (this.isConnected) {
          this.logger.log('Ollama connection restored');
          await this.loadAvailableModels();
        } else {
          this.logger.warn('Ollama connection lost');
        }
      }
    }, 30000); // 每30秒检查一次
  }

  /**
   * 启动请求处理器
   */
  private startRequestProcessor(): void {
    setInterval(() => {
      this.processRequestQueue();
    }, 100); // 每100ms处理一次队列
  }

  /**
   * 处理请求队列
   */
  private async processRequestQueue(): Promise<void> {
    if (this.requestQueue.length === 0 || this.processingRequests >= this.maxConcurrentRequests) {
      return;
    }
    
    const availableSlots = this.maxConcurrentRequests - this.processingRequests;
    const requestsToProcess = this.requestQueue.splice(0, availableSlots);
    
    for (const queueItem of requestsToProcess) {
      this.processingRequests++;
      
      queueItem.request()
        .then(result => queueItem.resolve(result))
        .catch(error => queueItem.reject(error))
        .finally(() => {
          this.processingRequests--;
        });
    }
  }

  /**
   * 添加请求到队列
   */
  private queueRequest<T>(request: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        id: crypto.randomUUID(),
        request,
        resolve,
        reject,
        timestamp: new Date(),
      });
    });
  }

  /**
   * 生成文本
   */
  async generate(request: OllamaGenerateRequest): Promise<OllamaGenerateResponse> {
    if (!this.enabled || !this.isConnected) {
      throw new Error('Ollama service is not available');
    }
    
    if (!this.availableModels.has(request.model)) {
      throw new Error(`Model ${request.model} is not available`);
    }
    
    return this.queueRequest(async () => {
      const startTime = Date.now();
      
      try {
        this.logger.debug(`Generating text with model: ${request.model}`);
        
        const response = await withTimeout(
          fetch(`${this.baseURL}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request),
          }),
          60000 // 60秒超时
        );
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        const parsedResult = OllamaGenerateResponseSchema.parse(result);
        
        const latency = Date.now() - startTime;
        this.updateModelStats(request.model, latency, parsedResult.eval_count || 0, false);
        
        this.eventEmitter.emit('ollama.generate.completed', {
          model: request.model,
          latency,
          tokens: parsedResult.eval_count,
        });
        
        return parsedResult;
      } catch (error) {
        const latency = Date.now() - startTime;
        this.updateModelStats(request.model, latency, 0, true);
        
        this.logger.error(`Generate request failed for model ${request.model}`, error);
        throw error;
      }
    });
  }

  /**
   * 聊天对话
   */
  async chat(request: OllamaChatRequest): Promise<OllamaGenerateResponse> {
    if (!this.enabled || !this.isConnected) {
      throw new Error('Ollama service is not available');
    }
    
    if (!this.availableModels.has(request.model)) {
      throw new Error(`Model ${request.model} is not available`);
    }
    
    return this.queueRequest(async () => {
      const startTime = Date.now();
      
      try {
        this.logger.debug(`Chat request with model: ${request.model}`);
        
        const response = await withTimeout(
          fetch(`${this.baseURL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request),
          }),
          60000 // 60秒超时
        );
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        const parsedResult = OllamaGenerateResponseSchema.parse(result);
        
        const latency = Date.now() - startTime;
        this.updateModelStats(request.model, latency, parsedResult.eval_count || 0, false);
        
        this.eventEmitter.emit('ollama.chat.completed', {
          model: request.model,
          latency,
          tokens: parsedResult.eval_count,
        });
        
        return parsedResult;
      } catch (error) {
        const latency = Date.now() - startTime;
        this.updateModelStats(request.model, latency, 0, true);
        
        this.logger.error(`Chat request failed for model ${request.model}`, error);
        throw error;
      }
    });
  }

  /**
   * 流式生成文本
   */
  async *generateStream(request: OllamaGenerateRequest): AsyncGenerator<string, void, unknown> {
    if (!this.enabled || !this.isConnected) {
      throw new Error('Ollama service is not available');
    }
    
    if (!this.availableModels.has(request.model)) {
      throw new Error(`Model ${request.model} is not available`);
    }
    
    const streamRequest = { ...request, stream: true };
    
    try {
      this.logger.debug(`Streaming text generation with model: ${request.model}`);
      
      const response = await fetch(`${this.baseURL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(streamRequest),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Failed to get response reader');
      }
      
      const decoder = new TextDecoder();
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter(line => line.trim());
          
          for (const line of lines) {
            try {
              const data = JSON.parse(line);
              if (data.response) {
                yield data.response;
              }
              
              if (data.done) {
                return;
              }
            } catch (parseError) {
              this.logger.warn('Failed to parse streaming response line', parseError);
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      this.logger.error(`Stream generation failed for model ${request.model}`, error);
      throw error;
    }
  }

  /**
   * 拉取模型
   */
  async pullModel(modelName: string): Promise<void> {
    if (!this.enabled || !this.isConnected) {
      throw new Error('Ollama service is not available');
    }
    
    try {
      this.logger.log(`Pulling model: ${modelName}`);
      
      const response = await fetch(`${this.baseURL}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to pull model: ${response.status}`);
      }
      
      // 拉取完成后重新加载模型列表
      await this.loadAvailableModels();
      
      this.eventEmitter.emit('ollama.model.pulled', {
        model: modelName,
        timestamp: new Date(),
      });
      
      this.logger.log(`Successfully pulled model: ${modelName}`);
    } catch (error) {
      this.logger.error(`Failed to pull model ${modelName}`, error);
      throw error;
    }
  }

  /**
   * 删除模型
   */
  async deleteModel(modelName: string): Promise<void> {
    if (!this.enabled || !this.isConnected) {
      throw new Error('Ollama service is not available');
    }
    
    try {
      this.logger.log(`Deleting model: ${modelName}`);
      
      const response = await fetch(`${this.baseURL}/api/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete model: ${response.status}`);
      }
      
      // 从本地缓存中移除
      this.availableModels.delete(modelName);
      this.modelStats.delete(modelName);
      
      this.eventEmitter.emit('ollama.model.deleted', {
        model: modelName,
        timestamp: new Date(),
      });
      
      this.logger.log(`Successfully deleted model: ${modelName}`);
    } catch (error) {
      this.logger.error(`Failed to delete model ${modelName}`, error);
      throw error;
    }
  }

  /**
   * 获取模型信息
   */
  async getModelInfo(modelName: string): Promise<any> {
    if (!this.enabled || !this.isConnected) {
      throw new Error('Ollama service is not available');
    }
    
    try {
      const response = await fetch(`${this.baseURL}/api/show`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to get model info: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      this.logger.error(`Failed to get model info for ${modelName}`, error);
      throw error;
    }
  }

  /**
   * 生成嵌入向量
   */
  async generateEmbeddings(model: string, prompt: string): Promise<number[]> {
    if (!this.enabled || !this.isConnected) {
      throw new Error('Ollama service is not available');
    }
    
    return this.queueRequest(async () => {
      try {
        this.logger.debug(`Generating embeddings with model: ${model}`);
        
        const response = await fetch(`${this.baseURL}/api/embeddings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, prompt }),
        });
        
        if (!response.ok) {
          throw new Error(`Failed to generate embeddings: ${response.status}`);
        }
        
        const result = await response.json();
        return result.embedding || [];
      } catch (error) {
        this.logger.error(`Failed to generate embeddings with model ${model}`, error);
        throw error;
      }
    });
  }

  /**
   * 更新模型统计信息
   */
  private updateModelStats(
    modelName: string, 
    latency: number, 
    tokens: number, 
    isError: boolean
  ): void {
    const stats = this.modelStats.get(modelName);
    if (!stats) return;
    
    stats.totalRequests++;
    stats.lastUsed = new Date();
    
    if (isError) {
      stats.errorCount++;
    } else {
      stats.totalTokens += tokens;
      
      // 更新平均延迟
      const totalLatency = stats.averageLatency * (stats.totalRequests - 1) + latency;
      stats.averageLatency = totalLatency / stats.totalRequests;
    }
  }

  /**
   * 获取可用模型列表
   */
  getAvailableModels(): OllamaModel[] {
    return Array.from(this.availableModels.values());
  }

  /**
   * 检查模型是否可用
   */
  isModelAvailable(modelName: string): boolean {
    return this.availableModels.has(modelName);
  }

  /**
   * 获取服务状态
   */
  getStatus() {
    return {
      enabled: this.enabled,
      connected: this.isConnected,
      baseURL: this.baseURL,
      availableModels: Array.from(this.availableModels.keys()),
      queueSize: this.requestQueue.length,
      processingRequests: this.processingRequests,
      maxConcurrentRequests: this.maxConcurrentRequests,
    };
  }

  /**
   * 获取模型统计信息
   */
  getModelStats(modelName?: string) {
    if (modelName) {
      return this.modelStats.get(modelName) || null;
    }
    
    return Object.fromEntries(this.modelStats);
  }

  /**
   * 获取服务统计信息
   */
  getServiceStats() {
    const totalRequests = Array.from(this.modelStats.values())
      .reduce((sum, stats) => sum + stats.totalRequests, 0);
    
    const totalTokens = Array.from(this.modelStats.values())
      .reduce((sum, stats) => sum + stats.totalTokens, 0);
    
    const totalErrors = Array.from(this.modelStats.values())
      .reduce((sum, stats) => sum + stats.errorCount, 0);
    
    const averageLatency = Array.from(this.modelStats.values())
      .reduce((sum, stats) => sum + stats.averageLatency, 0) / this.modelStats.size;
    
    return {
      totalRequests,
      totalTokens,
      totalErrors,
      averageLatency: averageLatency || 0,
      errorRate: totalRequests > 0 ? totalErrors / totalRequests : 0,
      modelsCount: this.availableModels.size,
      queueSize: this.requestQueue.length,
      processingRequests: this.processingRequests,
    };
  }

  /**
   * 清理资源
   */
  private async cleanup(): Promise<void> {
    this.logger.log('Cleaning up Ollama service...');
    
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
    }
    
    // 清空请求队列
    this.requestQueue.length = 0;
    
    this.logger.log('Ollama service cleaned up');
  }
}