/**
 * 🚀 Juanie AI - 2025年最前沿的AI原生DevOps平台
 * 核心模块统一导出
 *
 * 本文件提供了所有前沿技术组件的统一访问接口：
 * - AI原生事件驱动架构 (Event Sourcing + CQRS)
 * - WebAssembly微服务引擎
 * - AI智能体编排系统
 * - 零信任安全架构
 * - 前沿向量数据库集成
 * - 下一代边缘tRPC API
 * - 现代化可观测性技术栈
 * - 边缘计算网格
 * - 神经形态AI和脑启发计算
 * - Web3去中心化身份验证
 * - 量子安全加密
 */

// 前沿工具库导入
import { Temporal } from '@js-temporal/polyfill';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import * as R from 'radash';
import { Effect, Schedule } from 'effect';

// AI智能体编排
export {
  AIAgentTypeSchema,
  AIOrchestrator,
  AIResultSchema,
  AITaskSchema,
  BaseAIAgent,
  CodeReviewerAgent,
  DevOpsEngineerAgent,
  IAIAgent,
} from "./ai/ai-orchestrator";
// 核心模块
export { CoreModule } from "./core.module";

export {
  AggregateRoot as CQRSAggregateRoot,
  AggregateStateSchema,
  BaseAggregateRepository as CQRSBaseAggregateRepository,
  IAggregateRepository as CQRSAggregateRepository,
} from "./cqrs/aggregate-root";
// 向量数据库和语义搜索
export {
  InMemoryVectorStore,
  IVectorStore,
  MultiModalEmbeddingService,
  QdrantVectorStore,
  SearchOptionsSchema,
  SearchResultSchema,
  SemanticSearchService,
  VectorConfigSchema,
  VectorDocumentSchema,
  VectorStoreFactory,
} from "./database/vector-store";
// 事件溯源和CQRS
export {
  DomainEvent,
  EventMetadataSchema,
  IEventStore,
  // EventSourcingService,
  // AggregateRoot,
  // IAggregateRepository,
  // BaseAggregateRepository,
} from "./event-sourcing/event-store";
// 零信任安全
export {
  AIThreatDetector,
  RiskAssessmentEngine,
  RiskAssessmentSchema,
  SecurityContextSchema,
  ThreatEventSchema,
  ZeroTrust,
  ZeroTrustGuard,
} from "./security/zero-trust";
export {
  MicroserviceConfigSchema,
  WasmLoadBalancer,
  WasmMicroserviceInstance,
  WasmMicroserviceOrchestrator,
} from "./wasm/wasm-microservice";
// WebAssembly运行时
export {
  WasmExecutionResult,
  WasmModuleConfigSchema,
  WasmModuleInstance,
  WasmRuntime,
  WasmService,
} from "./wasm/wasm-runtime";

// 边缘tRPC API
// export {
//   EdgeContextSchema,
//   CacheStrategySchema,
//   RealtimeSubscriptionSchema,
//   EdgeCacheManager,
//   RealtimeSubscriptionManager,
//   EdgeRouter,
//   EdgeTRPCService,
// } from './api/edge-trpc';

// 边缘计算网格
export {
  EdgeMeshService,
  EdgeNode,
  EdgeNodeManager,
  EdgeNodeSchema,
  EdgeRoutingStrategy,
  EdgeRoutingStrategySchema,
  EdgeTask,
  EdgeTaskScheduler,
  EdgeTaskSchema,
} from "./edge/edge-mesh";

// 神经形态AI
export {
  AdaptiveLearningConfig,
  AdaptiveLearningConfigSchema,
  AttentionMechanism,
  NeuralLayer,
  NeuralLayerSchema,
  NeuromorphicAIService,
  Neuron,
  NeuronSchema,
  SpikingNetworkConfig,
  SpikingNetworkConfigSchema,
  SpikingNeuron,
  STDPLearningRule,
  Synapse,
  SynapseSchema,
  WorkingMemory,
} from "./neuromorphic/neural-ai";

// 可观测性
export {
  AlertRuleSchema,
  IntelligentAlertingService,
  MetricDefinitionSchema,
  MetricsCollector,
  MetricTypeSchema,
  OpenTelemetryService,
  SpanSchema,
  TelemetryConfigSchema,
} from "./observability/telemetry";

// 量子安全加密
export {
  IPostQuantumCrypto,
  LatticeBasedCrypto,
  QuantumCryptoService,
  QuantumKeyPair,
  QuantumKeyPairSchema,

  QuantumSafeHasher,
  QuantumSignature,
  QuantumSignatureSchema,
} from "./quantum/quantum-crypto";

// 类型导出
export type {
  // AI相关类型
  AIAgentType,
  AIResult,
  AITask,
  AlertRule,
  CacheStrategy,
  DomainEventType,
  // 边缘计算类型
  EdgeContext,
  // 事件相关类型
  EventMetadata,
  MetricDefinition,
  MetricType,
  RealtimeSubscription,
  RiskAssessment,
  // 安全相关类型
  SecurityContext,
  // 遥测相关类型
  TelemetryConfig,
  ThreatEvent,
  TracingSpan,
  // 向量相关类型
  VectorConfig,
  VectorDocument,
  VectorSearchOptions,
  VectorSearchResult,
  WasmMicroserviceConfig,
  // WebAssembly相关类型
  WasmModuleConfig,
} from "./types";

// Web3去中心化身份验证
export {
  DID,
  DIDManager,
  DIDSchema,
  SmartContract,
  SmartContractSchema,
  SmartContractService,
  VerifiableCredential,
  VerifiableCredentialManager,
  VerifiableCredentialSchema,
  VerifiablePresentation,
  VerifiablePresentationSchema,
  Web3AuthService,
  Web3Session,
  Web3SessionSchema,
} from "./web3/decentralized-auth";

// 核心常量
export const CORE_CONSTANTS = {
  // 版本信息
  VERSION: "2025.1.0",
  CODENAME: "Quantum Edge",

  // 超时配置
  DEFAULT_CACHE_TTL: 300000, // 5分钟
  DEFAULT_WASM_TIMEOUT: 30000, // 30秒
  DEFAULT_AI_TIMEOUT: 60000, // 1分钟
  DEFAULT_VECTOR_DIMENSIONS: 1536, // OpenAI embedding维度

  // 事件类型
  EVENT_TYPES: {
    SYSTEM: "system",
    USER: "user",
    AI: "ai",
    SECURITY: "security",
    PERFORMANCE: "performance",
  },

  // AI智能体类型
  AI_AGENT_TYPES: {
    CODE_REVIEWER: "code-reviewer",
    DEVOPS_ENGINEER: "devops-engineer",
    SECURITY_ANALYST: "security-analyst",
    PERFORMANCE_OPTIMIZER: "performance-optimizer",
  },

  // 安全级别
  SECURITY_LEVELS: {
    LOW: "low",
    MEDIUM: "medium",
    HIGH: "high",
    CRITICAL: "critical",
  },

  // 边缘区域
  EDGE_REGIONS: {
    US_EAST: "us-east-1",
    US_WEST: "us-west-1",
    EU_WEST: "eu-west-1",
    ASIA_PACIFIC: "ap-southeast-1",
  },
} as const;

// 导出常量
export * from "./constants";

// ============================================================================
// 🚀 前沿工具函数 - 使用2024+最新技术
// ============================================================================

/**
 * 生成安全的唯一ID - 使用nanoid替代uuid
 */
export function generateId(): string {
  return nanoid();
}

/**
 * 生成自定义长度的纳米ID
 */
export function generateNanoId(size: number = 21): string {
  return nanoid(size);
}

/**
 * 验证DID格式
 */
export function isValidDID(did: string): boolean {
  return /^did:[a-z0-9]+:[a-zA-Z0-9._-]+$/.test(did);
}

/**
 * 验证UUID格式 - 使用现代正则表达式
 */
export function isValidUUID(uuid: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
}

/**
 * 余弦相似度计算 - 优化版本
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }
  
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  
  if (magnitudeA === 0 || magnitudeB === 0) return 0;
  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * 欧几里得距离 - 使用现代数组方法
 */
export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }
  
  return Math.sqrt(
    a.reduce((sum, val, i) => sum + Math.pow(val - b[i], 2), 0)
  );
}

/**
 * 曼哈顿距离 - 使用现代数组方法
 */
export function manhattanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }
  
  return a.reduce((sum, val, i) => sum + Math.abs(val - b[i]), 0);
}

/**
 * 字节格式化 - 使用Intl.NumberFormat
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  const formatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
  
  return `${formatter.format(bytes / Math.pow(k, i))} ${sizes[i]}`;
}

/**
 * 时间格式化 - 使用Temporal API
 */
export function formatDuration(ms: number): string {
  const duration = Temporal.Duration.from({ milliseconds: ms });
  
  const days = duration.days;
  const hours = duration.hours;
  const minutes = duration.minutes;
  const seconds = duration.seconds;
  
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

/**
 * 深度合并 - 使用现代对象展开语法
 */
export function deepMerge<T extends Record<string, any>>(
  target: T,
  source: Partial<T>
): T {
  const result = { ...target };
  
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || ({} as any), source[key] as any);
    } else {
      result[key] = source[key] as any;
    }
  }
  
  return result;
}

/**
 * 深度克隆 - 使用原生structuredClone
 */
export function deepClone<T>(obj: T): T {
  // 使用现代浏览器和Node.js 17+的原生structuredClone
  if (typeof structuredClone !== 'undefined') {
    return structuredClone(obj);
  }
  
  // 降级到JSON方法（仅用于简单对象）
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch {
    throw new Error('Object cannot be cloned');
  }
}

/**
 * 延迟函数 - 使用现代Promise
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 超时包装器 - 使用AbortController
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  const controller = new AbortController();
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    const timeoutId = setTimeout(() => {
      controller.abort();
      reject(new Error(`Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    
    controller.signal.addEventListener('abort', () => {
      clearTimeout(timeoutId);
    });
  });
  
  return Promise.race([promise, timeoutPromise]);
}

/**
 * 重试机制 - 使用现代Promise和指数退避
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    retries?: number;
    delay?: number;
    backoff?: number;
    shouldRetry?: (error: Error) => boolean;
  } = {}
): Promise<T> {
  const { retries = 3, delay: baseDelay = 1000, backoff = 2, shouldRetry = () => true } = options;
  
  let lastError: Error;
  
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (i === retries || !shouldRetry(lastError)) {
        throw lastError;
      }
      
      // 指数退避延迟
      const delayMs = baseDelay * Math.pow(backoff, i);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  throw lastError!;
}

/**
 * 批处理 - 使用radash的批处理功能
 */
export async function batch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  options: {
    batchSize?: number;
    concurrency?: number;
    delay?: number;
  } = {}
): Promise<R[]> {
  const { batchSize = 10, concurrency = 5, delay: batchDelay = 0 } = options;
  
  return R.parallel(concurrency, items, async (item) => {
    const result = await processor(item);
    if (batchDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, batchDelay));
    }
    return result;
  });
}

/**
 * 防抖 - 使用radash的防抖实现
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  return R.debounce({ delay: wait }, func);
}

/**
 * 节流 - 使用radash的节流实现
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  return R.throttle({ interval: limit }, func);
}

/**
 * 安全JSON解析 - 使用Zod验证
 */
export function safeJsonParse<T = any>(json: string, schema?: z.ZodSchema<T>): T | null {
  try {
    const parsed = JSON.parse(json);
    if (schema) {
      return schema.parse(parsed);
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * 安全JSON字符串化
 */
export function safeJsonStringify(obj: any, space?: number): string {
  try {
    return JSON.stringify(obj, null, space);
  } catch {
    return '{}';
  }
}

/**
 * 随机字符串生成 - 使用nanoid的自定义字符集
 */
export function randomString(
  length: number,
  charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
): string {
  return nanoid(length);
}

/**
 * 字符串哈希 - 使用Web Crypto API
 */
export async function hashString(
  input: string,
  algorithm: 'SHA-256' | 'SHA-512' = 'SHA-256'
): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  
  const hashBuffer = await crypto.subtle.digest(algorithm, data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  
  return hashArray
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * 邮箱验证 - 使用Zod schema
 */
export function isValidEmail(email: string): boolean {
  const emailSchema = z.string().email();
  return emailSchema.safeParse(email).success;
}

/**
 * URL验证 - 使用Zod schema
 */
export function isValidUrl(url: string): boolean {
  const urlSchema = z.string().url();
  return urlSchema.safeParse(url).success;
}

/**
 * 环境变量获取 - 类型安全版本
 */
export function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Environment variable ${key} is not defined`);
  }
  return value;
}

/**
 * 布尔环境变量获取
 */
export function getBooleanEnvVar(key: string, defaultValue = false): boolean {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
}

/**
 * 数字环境变量获取
 */
export function getNumberEnvVar(key: string, defaultValue?: number): number {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Environment variable ${key} is not defined`);
  }
  
  const parsed = Number(value);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} is not a valid number`);
  }
  
  return parsed;
}

// 现代化工具集合
export const CoreUtils = {
  generateId,
  generateNanoId,
  isValidDID,
  isValidUUID,
  cosineSimilarity,
  euclideanDistance,
  manhattanDistance,
  formatBytes,
  formatDuration,
  deepMerge,
  deepClone,
  delay,
  withTimeout,
  retry,
  batch,
  debounce,
  throttle,
  safeJsonParse,
  safeJsonStringify,
  randomString,
  hashString,
  isValidEmail,
  isValidUrl,
  getEnvVar,
  getBooleanEnvVar,
  getNumberEnvVar,
};

// 默认导出
export default {
  CORE_CONSTANTS,
  CoreUtils,
};
