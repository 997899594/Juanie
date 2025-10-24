/**
 * 🚀 Juanie AI - 嵌入向量服务
 * 支持多种AI模型的向量生成和管理
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { z } from 'zod';
import { 
  withTimeout, 
  retry, 
  CONSTANTS,
  getEnvVar,
  getBooleanEnvVar,
  getNumberEnvVar,
  cosineSimilarity,
  euclideanDistance,
  manhattanDistance,
} from '../core';
import { OllamaService } from './ollama.service';

// ============================================================================
// 嵌入向量Schema
// ============================================================================

export const EmbeddingRequestSchema = z.object({
  text: z.string().min(1).max(8192),
  model: z.string().optional(),
  dimensions: z.number().int().min(1).max(4096).optional(),
  encoding_format: z.enum(['float', 'base64']).default('float'),
  user: z.string().optional(),
});

export const EmbeddingResponseSchema = z.object({
  object: z.literal('list'),
  data: z.array(z.object({
    object: z.literal('embedding'),
    embedding: z.array(z.number()),
    index: z.number(),
  })),
  model: z.string(),
  usage: z.object({
    prompt_tokens: z.number(),
    total_tokens: z.number(),
  }),
});

export const BatchEmbeddingRequestSchema = z.object({
  texts: z.array(z.string().min(1).max(8192)).min(1).max(100),
  model: z.string().optional(),
  dimensions: z.number().int().min(1).max(4096).optional(),
  encoding_format: z.enum(['float', 'base64']).default('float'),
  user: z.string().optional(),
});

export const SimilaritySearchRequestSchema = z.object({
  query: z.string().min(1),
  embeddings: z.array(z.object({
    id: z.string(),
    vector: z.array(z.number()),
    metadata: z.record(z.any()).optional(),
  })),
  top_k: z.number().int().min(1).max(100).default(10),
  threshold: z.number().min(0).max(1).optional(),
  metric: z.enum(['cosine', 'euclidean', 'manhattan']).default('cosine'),
});

export const SimilaritySearchResultSchema = z.object({
  results: z.array(z.object({
    id: z.string(),
    score: z.number(),
    metadata: z.record(z.any()).optional(),
  })),
  query_vector: z.array(z.number()),
  total_results: z.number(),
});

export type EmbeddingRequest = z.infer<typeof EmbeddingRequestSchema>;
export type EmbeddingResponse = z.infer<typeof EmbeddingResponseSchema>;
export type BatchEmbeddingRequest = z.infer<typeof BatchEmbeddingRequestSchema>;
export type SimilaritySearchRequest = z.infer<typeof SimilaritySearchRequestSchema>;
export type SimilaritySearchResult = z.infer<typeof SimilaritySearchResultSchema>;

// ============================================================================
// 嵌入向量提供者接口
// ============================================================================

export interface EmbeddingProvider {
  name: string;
  models: string[];
  maxTokens: number;
  dimensions: number;
  generateEmbedding(text: string, model?: string): Promise<number[]>;
  generateBatchEmbeddings(texts: string[], model?: string): Promise<number[][]>;
  isAvailable(): boolean;
}

// ============================================================================
// OpenAI嵌入向量提供者
// ============================================================================

class OpenAIEmbeddingProvider implements EmbeddingProvider {
  name = 'openai';
  models = ['text-embedding-3-small', 'text-embedding-3-large', 'text-embedding-ada-002'];
  maxTokens = 8192;
  dimensions = 1536;
  
  private apiKey: string;
  private baseURL: string;
  
  constructor() {
    this.apiKey = getEnvVar('OPENAI_API_KEY', '');
    this.baseURL = getEnvVar('OPENAI_BASE_URL', 'https://api.openai.com/v1');
  }
  
  isAvailable(): boolean {
    return !!this.apiKey;
  }
  
  async generateEmbedding(text: string, model = 'text-embedding-3-small'): Promise<number[]> {
    const response = await fetch(`${this.baseURL}/embeddings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: text,
        model,
        encoding_format: 'float',
      }),
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.data[0].embedding;
  }
  
  async generateBatchEmbeddings(texts: string[], model = 'text-embedding-3-small'): Promise<number[][]> {
    const response = await fetch(`${this.baseURL}/embeddings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: texts,
        model,
        encoding_format: 'float',
      }),
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.data.map((item: any) => item.embedding);
  }
}

// ============================================================================
// Ollama嵌入向量提供者
// ============================================================================

class OllamaEmbeddingProvider implements EmbeddingProvider {
  name = 'ollama';
  models = ['nomic-embed-text', 'mxbai-embed-large', 'all-minilm'];
  maxTokens = 2048;
  dimensions = 768;
  
  constructor(private ollamaService: OllamaService) {}
  
  isAvailable(): boolean {
    return this.ollamaService.getStatus().connected;
  }
  
  async generateEmbedding(text: string, model = 'nomic-embed-text'): Promise<number[]> {
    return await this.ollamaService.generateEmbeddings(model, text);
  }
  
  async generateBatchEmbeddings(texts: string[], model = 'nomic-embed-text'): Promise<number[][]> {
    const embeddings: number[][] = [];
    
    // 批量处理，避免并发过多
    const batchSize = 5;
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchPromises = batch.map(text => this.generateEmbedding(text, model));
      const batchResults = await Promise.all(batchPromises);
      embeddings.push(...batchResults);
    }
    
    return embeddings;
  }
}

// ============================================================================
// 嵌入向量服务
// ============================================================================

@Injectable()
export class EmbeddingService implements OnModuleInit {
  private readonly logger = new Logger(EmbeddingService.name);
  
  private providers: Map<string, EmbeddingProvider> = new Map();
  private defaultProvider: string;
  private cache: Map<string, { vector: number[]; timestamp: Date }> = new Map();
  private cacheEnabled: boolean;
  private cacheTTL: number; // 缓存过期时间（毫秒）
  private maxCacheSize: number;
  
  // 统计信息
  private stats = {
    totalRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    totalTokens: 0,
    averageLatency: 0,
    errorCount: 0,
    providerStats: new Map<string, {
      requests: number;
      tokens: number;
      errors: number;
      latency: number;
    }>(),
  };

  constructor(
    private eventEmitter: EventEmitter2,
    private ollamaService: OllamaService,
  ) {
    this.defaultProvider = getEnvVar('DEFAULT_EMBEDDING_PROVIDER', 'openai');
    this.cacheEnabled = getBooleanEnvVar('EMBEDDING_CACHE_ENABLED', true);
    this.cacheTTL = getNumberEnvVar('EMBEDDING_CACHE_TTL', 3600000); // 1小时
    this.maxCacheSize = getNumberEnvVar('EMBEDDING_MAX_CACHE_SIZE', 10000);
  }

  async onModuleInit() {
    await this.initialize();
  }

  /**
   * 初始化嵌入向量服务
   */
  private async initialize(): Promise<void> {
    this.logger.log('Initializing Embedding service...');
    
    // 注册提供者
    this.providers.set('openai', new OpenAIEmbeddingProvider());
    this.providers.set('ollama', new OllamaEmbeddingProvider(this.ollamaService));
    
    // 检查默认提供者是否可用
    const defaultProvider = this.providers.get(this.defaultProvider);
    if (!defaultProvider?.isAvailable()) {
      // 寻找可用的提供者
      for (const [name, provider] of this.providers) {
        if (provider.isAvailable()) {
          this.defaultProvider = name;
          this.logger.warn(`Default provider not available, switching to: ${name}`);
          break;
        }
      }
    }
    
    // 启动缓存清理任务
    if (this.cacheEnabled) {
      this.startCacheCleanup();
    }
    
    this.logger.log(`Embedding service initialized with provider: ${this.defaultProvider}`);
  }

  /**
   * 生成单个文本的嵌入向量
   */
  async generateEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    const startTime = Date.now();
    const providerName = this.getProviderName(request.model);
    const provider = this.providers.get(providerName);
    
    if (!provider) {
      throw new Error(`Provider ${providerName} not found`);
    }
    
    if (!provider.isAvailable()) {
      throw new Error(`Provider ${providerName} is not available`);
    }
    
    try {
      this.stats.totalRequests++;
      
      // 检查缓存
      const cacheKey = this.getCacheKey(request.text, request.model || 'default');
      if (this.cacheEnabled) {
        const cached = this.getFromCache(cacheKey);
        if (cached) {
          this.stats.cacheHits++;
          
          const latency = Date.now() - startTime;
          this.updateStats(providerName, latency, request.text.length, false);
          
          return {
            object: 'list',
            data: [{
              object: 'embedding',
              embedding: cached,
              index: 0,
            }],
            model: request.model || provider.models[0],
            usage: {
              prompt_tokens: this.estimateTokens(request.text),
              total_tokens: this.estimateTokens(request.text),
            },
          };
        }
        this.stats.cacheMisses++;
      }
      
      // 生成嵌入向量
      const embedding = await withTimeout(
        provider.generateEmbedding(request.text, request.model),
        30000 // 30秒超时
      );
      
      // 缓存结果
      if (this.cacheEnabled) {
        this.setCache(cacheKey, embedding);
      }
      
      const latency = Date.now() - startTime;
      const tokens = this.estimateTokens(request.text);
      
      this.updateStats(providerName, latency, tokens, false);
      
      this.eventEmitter.emit('embedding.generated', {
        provider: providerName,
        model: request.model,
        tokens,
        latency,
        cached: false,
      });
      
      return {
        object: 'list',
        data: [{
          object: 'embedding',
          embedding,
          index: 0,
        }],
        model: request.model || provider.models[0],
        usage: {
          prompt_tokens: tokens,
          total_tokens: tokens,
        },
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      this.updateStats(providerName, latency, 0, true);
      
      this.logger.error(`Failed to generate embedding with provider ${providerName}`, error);
      throw error;
    }
  }

  /**
   * 批量生成嵌入向量
   */
  async generateBatchEmbeddings(request: BatchEmbeddingRequest): Promise<EmbeddingResponse> {
    const startTime = Date.now();
    const providerName = this.getProviderName(request.model);
    const provider = this.providers.get(providerName);
    
    if (!provider) {
      throw new Error(`Provider ${providerName} not found`);
    }
    
    if (!provider.isAvailable()) {
      throw new Error(`Provider ${providerName} is not available`);
    }
    
    try {
      this.stats.totalRequests++;
      
      // 检查缓存
      const embeddings: number[][] = [];
      const uncachedTexts: string[] = [];
      const uncachedIndices: number[] = [];
      
      if (this.cacheEnabled) {
        for (let i = 0; i < request.texts.length; i++) {
          const text = request.texts[i];
          const cacheKey = this.getCacheKey(text, request.model || 'default');
          const cached = this.getFromCache(cacheKey);
          
          if (cached) {
            embeddings[i] = cached;
            this.stats.cacheHits++;
          } else {
            uncachedTexts.push(text);
            uncachedIndices.push(i);
            this.stats.cacheMisses++;
          }
        }
      } else {
        uncachedTexts.push(...request.texts);
        uncachedIndices.push(...request.texts.map((_, i) => i));
      }
      
      // 生成未缓存的嵌入向量
      if (uncachedTexts.length > 0) {
        const newEmbeddings = await withTimeout(
          provider.generateBatchEmbeddings(uncachedTexts, request.model),
          60000 // 60秒超时
        );
        
        // 填充结果并缓存
        for (let i = 0; i < uncachedIndices.length; i++) {
          const index = uncachedIndices[i];
          const embedding = newEmbeddings[i];
          embeddings[index] = embedding;
          
          if (this.cacheEnabled) {
            const cacheKey = this.getCacheKey(uncachedTexts[i], request.model || 'default');
            this.setCache(cacheKey, embedding);
          }
        }
      }
      
      const latency = Date.now() - startTime;
      const totalTokens = request.texts.reduce((sum, text) => sum + this.estimateTokens(text), 0);
      
      this.updateStats(providerName, latency, totalTokens, false);
      
      this.eventEmitter.emit('embedding.batch.generated', {
        provider: providerName,
        model: request.model,
        count: request.texts.length,
        tokens: totalTokens,
        latency,
        cacheHits: this.stats.cacheHits,
        cacheMisses: this.stats.cacheMisses,
      });
      
      return {
        object: 'list',
        data: embeddings.map((embedding, index) => ({
          object: 'embedding' as const,
          embedding,
          index,
        })),
        model: request.model || provider.models[0],
        usage: {
          prompt_tokens: totalTokens,
          total_tokens: totalTokens,
        },
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      this.updateStats(providerName, latency, 0, true);
      
      this.logger.error(`Failed to generate batch embeddings with provider ${providerName}`, error);
      throw error;
    }
  }

  /**
   * 相似度搜索
   */
  async similaritySearch(request: SimilaritySearchRequest): Promise<SimilaritySearchResult> {
    try {
      // 生成查询向量
      const queryEmbedding = await this.generateEmbedding({
        text: request.query,
      });
      
      const queryVector = queryEmbedding.data[0].embedding;
      
      // 计算相似度
      const similarities = request.embeddings.map(item => {
        let score: number;
        
        switch (request.metric) {
          case 'cosine':
            score = cosineSimilarity(queryVector, item.vector);
            break;
          case 'euclidean':
            score = 1 / (1 + euclideanDistance(queryVector, item.vector));
            break;
          case 'manhattan':
            score = 1 / (1 + manhattanDistance(queryVector, item.vector));
            break;
          default:
            score = cosineSimilarity(queryVector, item.vector);
        }
        
        return {
          id: item.id,
          score,
          metadata: item.metadata,
        };
      });
      
      // 过滤和排序
      let results = similarities;
      
      if (request.threshold !== undefined) {
        results = results.filter(item => item.score >= request.threshold!);
      }
      
      results.sort((a, b) => b.score - a.score);
      results = results.slice(0, request.top_k);
      
      this.eventEmitter.emit('embedding.similarity.search', {
        query: request.query,
        totalCandidates: request.embeddings.length,
        resultsCount: results.length,
        metric: request.metric,
        threshold: request.threshold,
      });
      
      return {
        results,
        query_vector: queryVector,
        total_results: results.length,
      };
    } catch (error) {
      this.logger.error('Failed to perform similarity search', error);
      throw error;
    }
  }

  /**
   * 获取提供者名称
   */
  private getProviderName(model?: string): string {
    if (!model) {
      return this.defaultProvider;
    }
    
    // 根据模型名称推断提供者
    for (const [name, provider] of this.providers) {
      if (provider.models.includes(model)) {
        return name;
      }
    }
    
    return this.defaultProvider;
  }

  /**
   * 生成缓存键
   */
  private getCacheKey(text: string, model: string): string {
    return `${model}:${Buffer.from(text).toString('base64')}`;
  }

  /**
   * 从缓存获取
   */
  private getFromCache(key: string): number[] | null {
    const cached = this.cache.get(key);
    if (!cached) {
      return null;
    }
    
    // 检查是否过期
    if (Date.now() - cached.timestamp.getTime() > this.cacheTTL) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.vector;
  }

  /**
   * 设置缓存
   */
  private setCache(key: string, vector: number[]): void {
    // 检查缓存大小限制
    if (this.cache.size >= this.maxCacheSize) {
      // 删除最旧的条目
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
    
    this.cache.set(key, {
      vector,
      timestamp: new Date(),
    });
  }

  /**
   * 启动缓存清理任务
   */
  private startCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      const expiredKeys: string[] = [];
      
      for (const [key, cached] of this.cache) {
        if (now - cached.timestamp.getTime() > this.cacheTTL) {
          expiredKeys.push(key);
        }
      }
      
      for (const key of expiredKeys) {
        this.cache.delete(key);
      }
      
      if (expiredKeys.length > 0) {
        this.logger.debug(`Cleaned up ${expiredKeys.length} expired cache entries`);
      }
    }, 300000); // 每5分钟清理一次
  }

  /**
   * 估算token数量
   */
  private estimateTokens(text: string): number {
    // 简单估算：平均4个字符为1个token
    return Math.ceil(text.length / 4);
  }

  /**
   * 更新统计信息
   */
  private updateStats(
    provider: string, 
    latency: number, 
    tokens: number, 
    isError: boolean
  ): void {
    if (isError) {
      this.stats.errorCount++;
    } else {
      this.stats.totalTokens += tokens;
      
      // 更新平均延迟
      const totalLatency = this.stats.averageLatency * (this.stats.totalRequests - 1) + latency;
      this.stats.averageLatency = totalLatency / this.stats.totalRequests;
    }
    
    // 更新提供者统计
    if (!this.stats.providerStats.has(provider)) {
      this.stats.providerStats.set(provider, {
        requests: 0,
        tokens: 0,
        errors: 0,
        latency: 0,
      });
    }
    
    const providerStats = this.stats.providerStats.get(provider)!;
    providerStats.requests++;
    
    if (isError) {
      providerStats.errors++;
    } else {
      providerStats.tokens += tokens;
      
      const totalLatency = providerStats.latency * (providerStats.requests - 1) + latency;
      providerStats.latency = totalLatency / providerStats.requests;
    }
  }

  /**
   * 获取可用提供者
   */
  getAvailableProviders(): Array<{ name: string; models: string[]; available: boolean }> {
    return Array.from(this.providers.entries()).map(([name, provider]) => ({
      name,
      models: provider.models,
      available: provider.isAvailable(),
    }));
  }

  /**
   * 获取服务状态
   */
  getStatus() {
    return {
      defaultProvider: this.defaultProvider,
      providers: this.getAvailableProviders(),
      cacheEnabled: this.cacheEnabled,
      cacheSize: this.cache.size,
      maxCacheSize: this.maxCacheSize,
      cacheTTL: this.cacheTTL,
    };
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      ...this.stats,
      cacheHitRate: this.stats.totalRequests > 0 
        ? this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses) 
        : 0,
      errorRate: this.stats.totalRequests > 0 
        ? this.stats.errorCount / this.stats.totalRequests 
        : 0,
      providerStats: Object.fromEntries(this.stats.providerStats),
    };
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.cache.clear();
    this.logger.log('Embedding cache cleared');
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      totalTokens: 0,
      averageLatency: 0,
      errorCount: 0,
      providerStats: new Map(),
    };
    this.logger.log('Embedding stats reset');
  }
}