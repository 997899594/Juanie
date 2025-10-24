/**
 * 🚀 Juanie AI - 核心类型定义
 * 统一管理所有前沿组件的TypeScript类型
 */

import { z } from 'zod';

// ============================================================================
// 基础类型
// ============================================================================

export type UUID = string;
export type Timestamp = Date;
export type JSONValue = string | number | boolean | null | JSONObject | JSONArray;
export type JSONObject = { [key: string]: JSONValue };
export type JSONArray = JSONValue[];

// ============================================================================
// 事件溯源类型
// ============================================================================

export interface EventMetadata {
  eventId: UUID;
  eventType: string;
  aggregateId: UUID;
  aggregateType: string;
  version: number;
  timestamp: Timestamp;
  userId?: UUID;
  correlationId?: UUID;
  causationId?: UUID;
  metadata?: JSONObject;
}

export type DomainEventType = 
  | 'UserCreated'
  | 'UserUpdated' 
  | 'UserDeleted'
  | 'ProjectCreated'
  | 'ProjectUpdated'
  | 'ProjectDeleted'
  | 'DeploymentStarted'
  | 'DeploymentCompleted'
  | 'DeploymentFailed'
  | 'SecurityThreatDetected'
  | 'PerformanceIssueDetected'
  | 'AIRecommendationGenerated'
  | 'EdgeTaskScheduled'
  | 'EdgeTaskCompleted'
  | 'NeuralNetworkTrained'
  | 'Web3SessionCreated'
  | 'QuantumKeyGenerated';

// ============================================================================
// WebAssembly类型
// ============================================================================

export interface WasmModuleConfig {
  name: string;
  version: string;
  wasmPath: string;
  memoryPages?: number;
  maxMemoryPages?: number;
  enableBulkMemory?: boolean;
  enableSIMD?: boolean;
  enableThreads?: boolean;
  timeout?: number;
  permissions?: string[];
  metadata?: JSONObject;
}

export interface WasmMicroserviceConfig {
  id: string;
  name: string;
  wasmModule: string;
  replicas: number;
  resources: {
    cpu: number;
    memory: number;
    storage: number;
  };
  healthCheck: {
    path: string;
    interval: number;
    timeout: number;
    retries: number;
  };
  scaling: {
    minReplicas: number;
    maxReplicas: number;
    targetCPU: number;
    targetMemory: number;
  };
  metadata?: JSONObject;
}

// ============================================================================
// AI智能体类型
// ============================================================================

export type AIAgentType = 
  | 'code-reviewer'
  | 'devops-engineer'
  | 'security-analyst'
  | 'performance-optimizer'
  | 'cost-optimizer'
  | 'incident-responder'
  | 'compliance-auditor'
  | 'data-scientist';

export interface AITask {
  id: UUID;
  type: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  input: JSONObject;
  context?: JSONObject;
  requirements?: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
    timeout?: number;
  };
  metadata?: JSONObject;
}

export interface AIResult {
  taskId: UUID;
  agentId: UUID;
  output: JSONObject;
  confidence: number;
  processingTime: number;
  tokensUsed?: number;
  model?: string;
  metadata?: JSONObject;
}

// ============================================================================
// 安全类型
// ============================================================================

export interface SecurityContext {
  userId: UUID;
  sessionId: UUID;
  ipAddress: string;
  userAgent: string;
  location?: {
    country: string;
    region: string;
    city: string;
  };
  deviceFingerprint?: string;
  riskScore: number;
  permissions: string[];
  metadata?: JSONObject;
}

export interface RiskAssessment {
  contextId: UUID;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  factors: Array<{
    factor: string;
    weight: number;
    score: number;
    description: string;
  }>;
  recommendations: string[];
  timestamp: Timestamp;
  expiresAt: Timestamp;
}

export interface ThreatEvent {
  id: UUID;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  target: string;
  description: string;
  indicators: JSONObject;
  mitigationActions: string[];
  timestamp: Timestamp;
  resolved: boolean;
  resolvedAt?: Timestamp;
}

// ============================================================================
// 向量数据库类型
// ============================================================================

export interface VectorConfig {
  provider: 'qdrant' | 'pinecone' | 'weaviate' | 'memory';
  dimensions: number;
  metric: 'cosine' | 'euclidean' | 'dot';
  indexType?: string;
  connectionString?: string;
  apiKey?: string;
  timeout?: number;
  batchSize?: number;
  metadata?: JSONObject;
}

export interface VectorDocument {
  id: UUID;
  vector: number[];
  content: string;
  contentType: 'text' | 'code' | 'image' | 'audio' | 'video';
  metadata: JSONObject;
  timestamp: Timestamp;
}

export interface VectorSearchResult {
  document: VectorDocument;
  score: number;
  distance: number;
}

export interface VectorSearchOptions {
  limit?: number;
  threshold?: number;
  filter?: JSONObject;
  includeMetadata?: boolean;
  includeVector?: boolean;
}

// ============================================================================
// 边缘API类型
// ============================================================================

export interface EdgeContext {
  requestId: UUID;
  userId?: UUID;
  sessionId?: UUID;
  region: string;
  nodeId: string;
  timestamp: Timestamp;
  metadata?: JSONObject;
}

export interface CacheStrategy {
  type: 'memory' | 'redis' | 'hybrid';
  ttl: number;
  maxSize?: number;
  compression?: boolean;
  encryption?: boolean;
  tags?: string[];
}

export interface RealtimeSubscription {
  id: UUID;
  userId: UUID;
  channel: string;
  filters?: JSONObject;
  createdAt: Timestamp;
  lastActivity: Timestamp;
  metadata?: JSONObject;
}

// ============================================================================
// 可观测性类型
// ============================================================================

export interface TelemetryConfig {
  serviceName: string;
  serviceVersion: string;
  environment: string;
  tracing: {
    enabled: boolean;
    endpoint?: string;
    sampleRate?: number;
  };
  metrics: {
    enabled: boolean;
    endpoint?: string;
    interval?: number;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    format: 'json' | 'text';
  };
}

export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';

export interface MetricDefinition {
  name: string;
  type: MetricType;
  description: string;
  unit?: string;
  labels?: string[];
}

export interface TracingSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  startTime: Timestamp;
  endTime?: Timestamp;
  duration?: number;
  tags?: JSONObject;
  logs?: Array<{
    timestamp: Timestamp;
    fields: JSONObject;
  }>;
  status?: 'ok' | 'error' | 'timeout';
}

export interface AlertRule {
  id: UUID;
  name: string;
  description: string;
  query: string;
  threshold: number;
  operator: 'gt' | 'lt' | 'eq' | 'ne' | 'gte' | 'lte';
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  notifications: Array<{
    type: 'email' | 'slack' | 'webhook' | 'sms';
    target: string;
    template?: string;
  }>;
  metadata?: JSONObject;
}

// ============================================================================
// 边缘计算类型
// ============================================================================

export interface EdgeNode {
  id: UUID;
  name: string;
  region: string;
  zone: string;
  endpoint: string;
  status: 'online' | 'offline' | 'degraded' | 'maintenance';
  capabilities: string[];
  resources: {
    cpu: number;
    memory: number;
    storage: number;
    network: number;
  };
  metadata?: JSONObject;
  lastHeartbeat: Timestamp;
  createdAt: Timestamp;
}

export interface EdgeTask {
  id: UUID;
  name: string;
  type: 'wasm' | 'container' | 'function' | 'ai-inference';
  payload: JSONObject;
  requirements: {
    cpu: number;
    memory: number;
    storage: number;
    capabilities?: string[];
    region?: string;
    latencyMs?: number;
  };
  priority: 'low' | 'normal' | 'high' | 'critical';
  timeout: number;
  retryCount: number;
  status: 'pending' | 'scheduled' | 'running' | 'completed' | 'failed' | 'cancelled';
  assignedNodeId?: UUID;
  result?: JSONObject;
  error?: string;
  createdAt: Timestamp;
  startedAt?: Timestamp;
  completedAt?: Timestamp;
}

export interface EdgeRoutingStrategy {
  type: 'nearest' | 'least-loaded' | 'round-robin' | 'weighted' | 'ai-optimized';
  parameters?: JSONObject;
}

// ============================================================================
// 神经形态AI类型
// ============================================================================

export interface Neuron {
  id: UUID;
  type: 'input' | 'hidden' | 'output' | 'memory' | 'attention';
  activation: number;
  threshold: number;
  weights: number[];
  bias: number;
  lastFired?: Timestamp;
  firingRate: number;
  plasticity: number;
  metadata?: JSONObject;
}

export interface Synapse {
  id: UUID;
  preNeuronId: UUID;
  postNeuronId: UUID;
  weight: number;
  delay: number;
  plasticity: number;
  lastActive?: Timestamp;
  strengthHistory: number[];
  type: 'excitatory' | 'inhibitory';
}

export interface NeuralLayer {
  id: UUID;
  name: string;
  type: 'input' | 'hidden' | 'output' | 'recurrent' | 'attention' | 'memory';
  neurons: UUID[];
  activationFunction: 'sigmoid' | 'tanh' | 'relu' | 'leaky_relu' | 'swish' | 'spike';
  learningRate: number;
  dropout: number;
  batchNorm: boolean;
}

export interface SpikingNetworkConfig {
  timeStep: number;
  simulationTime: number;
  refractoryPeriod: number;
  threshold: number;
  decayRate: number;
  noiseLevel: number;
}

export interface AdaptiveLearningConfig {
  algorithm: 'stdp' | 'rl-stdp' | 'bcm' | 'oja' | 'homeostatic';
  learningWindow: number;
  reinforcementSignal: number;
  homeostasisTarget: number;
  metaplasticity: boolean;
  forgettingRate: number;
}

// ============================================================================
// Web3类型
// ============================================================================

export interface DID {
  id: string;
  method: string;
  publicKey: string;
  privateKey?: string;
  address: string;
  metadata: {
    created: Timestamp;
    updated: Timestamp;
    version: string;
    controller?: string;
    service?: Array<{
      id: string;
      type: string;
      serviceEndpoint: string;
    }>;
  };
}

export interface VerifiableCredential {
  '@context': string[];
  id: UUID;
  type: string[];
  issuer: string;
  issuanceDate: Timestamp;
  expirationDate?: Timestamp;
  credentialSubject: JSONObject;
  proof: {
    type: string;
    created: Timestamp;
    verificationMethod: string;
    proofPurpose: string;
    signature: string;
  };
}

export interface VerifiablePresentation {
  '@context': string[];
  id: UUID;
  type: string[];
  holder: string;
  verifiableCredential: VerifiableCredential[];
  proof: {
    type: string;
    created: Timestamp;
    verificationMethod: string;
    proofPurpose: string;
    challenge: string;
    signature: string;
  };
}

export interface Web3Session {
  id: UUID;
  did: string;
  address: string;
  chainId: number;
  nonce: string;
  message: string;
  signature: string;
  timestamp: Timestamp;
  expiresAt: Timestamp;
  permissions: string[];
  metadata?: JSONObject;
}

export interface SmartContract {
  address: string;
  abi: JSONArray;
  chainId: number;
  network: string;
  deployedAt?: Timestamp;
  verified: boolean;
}

// ============================================================================
// 量子加密类型
// ============================================================================

export interface QuantumSafeConfig {
  algorithm: 'kyber' | 'dilithium' | 'falcon' | 'sphincs';
  keySize: 512 | 768 | 1024 | 2048 | 4096;
  securityLevel: 1 | 2 | 3 | 4 | 5;
  enableHybrid: boolean;
  classicalFallback: boolean;
  metadata?: JSONObject;
}

export interface QuantumKeyPair {
  publicKey: string;
  privateKey: string;
  algorithm: string;
  keySize: number;
  createdAt: Timestamp;
  expiresAt?: Timestamp;
}

export interface QuantumSignature {
  signature: string;
  algorithm: string;
  publicKey: string;
  message: string;
  timestamp: Timestamp;
  verified: boolean;
}

// ============================================================================
// 联合类型和工具类型
// ============================================================================

export type ServiceStatus = 'initializing' | 'running' | 'stopping' | 'stopped' | 'error';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export type Environment = 'development' | 'staging' | 'production' | 'test';

export type Region = 'us-east-1' | 'us-west-1' | 'eu-west-1' | 'ap-southeast-1' | 'local';

// 工具类型
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

// 事件类型映射
export type EventTypeMap = {
  [K in DomainEventType]: {
    type: K;
    data: JSONObject;
    metadata?: JSONObject;
  };
};

// API响应类型
export interface APIResponse<T = JSONObject> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: JSONObject;
  };
  metadata?: {
    requestId: UUID;
    timestamp: Timestamp;
    version: string;
  };
}

// 分页类型
export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filter?: JSONObject;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// 健康检查类型
export interface HealthCheck {
  service: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: Timestamp;
  responseTime: number;
  details?: JSONObject;
}

export interface SystemHealth {
  overall: 'healthy' | 'unhealthy' | 'degraded';
  services: HealthCheck[];
  timestamp: Timestamp;
  uptime: number;
  version: string;
}

// 配置类型
export interface CoreConfig {
  environment: Environment;
  debug: boolean;
  logLevel: LogLevel;
  database: {
    url: string;
    ssl: boolean;
    poolSize: number;
    timeout: number;
  };
  redis: {
    url: string;
    keyPrefix: string;
    ttl: number;
  };
  ai: {
    openaiApiKey?: string;
    anthropicApiKey?: string;
    ollamaEndpoint?: string;
    defaultModel: string;
    maxTokens: number;
    temperature: number;
  };
  security: {
    jwtSecret: string;
    jwtExpiresIn: string;
    bcryptRounds: number;
    rateLimitWindow: number;
    rateLimitMax: number;
  };
  observability: {
    jaegerEndpoint?: string;
    prometheusEndpoint?: string;
    logLevel: LogLevel;
    enableTracing: boolean;
    enableMetrics: boolean;
  };
}