import { CacheModule } from "@nestjs/cache-manager";
import { Global, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { EventEmitter2, EventEmitterModule } from "@nestjs/event-emitter";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerModule } from "@nestjs/throttler";
// AI智能体编排
import {
  AIOrchestrator,
  CodeReviewerAgent,
  DevOpsEngineerAgent,
} from "./ai/ai-orchestrator";
import { AggregateRoot, BaseAggregateRepository } from "./cqrs/aggregate-root";
// 向量数据库和语义搜索
import {
  MultiModalEmbeddingService,
  SemanticSearchService,
  VectorStoreFactory,
} from "./database/vector-store";
// 边缘计算网格
import {
  EdgeMeshService,
  EdgeNodeManager,
  EdgeTaskScheduler,
} from "./edge/edge-mesh";
// 事件溯源和CQRS
import {
  IEventStore,
  InMemoryEventStore,
  PostgreSQLEventStore,
} from "./event-sourcing/event-store";
// 神经形态AI
import { NeuromorphicAIService } from "./neuromorphic/neural-ai";
// 可观测性
import {
  IntelligentAlertingService,
  MetricsCollector,
  OpenTelemetryService,
} from "./observability/telemetry";
// 量子加密
import { QuantumCryptoService } from "./quantum/quantum-crypto";
// 零信任安全
import {
  AIThreatDetector,
  RiskAssessmentEngine,
  ZeroTrustGuard,
} from "./security/zero-trust";
// 边缘tRPC
import {
  EdgeCacheManager,
  EdgeRouter,
  EdgeTRPCService,
  RealtimeSubscriptionManager,
} from "./trpc/edge-trpc";
import { WasmMicroserviceOrchestrator } from "./wasm/wasm-microservice";
// WebAssembly运行时
import { WasmRuntime } from "./wasm/wasm-runtime";
// Web3去中心化认证
import {
  DIDManager,
  SmartContractService,
  VerifiableCredentialManager,
  Web3AuthService,
} from "./web3/decentralized-auth";

// 核心配置
const coreConfig = () => ({
  // 数据库配置
  database: {
    postgresql: {
      url: process.env.DATABASE_URL || "postgresql://localhost:5432/juanie_dev",
      ssl: process.env.NODE_ENV === "production",
      maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || "20"),
    },
    eventStore: {
      provider: process.env.EVENT_STORE_PROVIDER || "memory", // memory | postgresql
      batchSize: parseInt(process.env.EVENT_STORE_BATCH_SIZE || "100"),
      snapshotFrequency: parseInt(process.env.SNAPSHOT_FREQUENCY || "10"),
    },
  },

  // 向量数据库配置
  vectorStore: {
    provider: process.env.VECTOR_STORE_PROVIDER || "qdrant", // qdrant | pinecone | weaviate
    url: process.env.VECTOR_STORE_URL || "http://localhost:6333",
    apiKey: process.env.VECTOR_STORE_API_KEY,
    collections: {
      documents: "documents",
      code: "code_embeddings",
      conversations: "conversations",
    },
  },

  // WebAssembly配置
  wasm: {
    enabled: process.env.WASM_ENABLED !== "false",
    runtime: process.env.WASM_RUNTIME || "wasmtime", // wasmtime | wasmer
    maxMemory: parseInt(process.env.WASM_MAX_MEMORY || "64"), // MB
    maxInstances: parseInt(process.env.WASM_MAX_INSTANCES || "100"),
    moduleCache: process.env.WASM_MODULE_CACHE !== "false",
  },

  // AI服务配置
  ai: {
    providers: {
      openai: {
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL || "gpt-4-turbo-preview",
        maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || "4096"),
      },
      anthropic: {
        apiKey: process.env.ANTHROPIC_API_KEY,
        model: process.env.ANTHROPIC_MODEL || "claude-3-sonnet-20240229",
      },
      ollama: {
        url: process.env.OLLAMA_URL || "http://localhost:11434",
        model: process.env.OLLAMA_MODEL || "llama2",
      },
    },
    orchestration: {
      maxConcurrentTasks: parseInt(process.env.AI_MAX_CONCURRENT_TASKS || "10"),
      taskTimeout: parseInt(process.env.AI_TASK_TIMEOUT || "300000"), // 5分钟
      retryAttempts: parseInt(process.env.AI_RETRY_ATTEMPTS || "3"),
    },
  },

  // 安全配置
  security: {
    zeroTrust: {
      enabled: process.env.ZERO_TRUST_ENABLED !== "false",
      riskThreshold: parseFloat(process.env.RISK_THRESHOLD || "0.7"),
      sessionTimeout: parseInt(process.env.SESSION_TIMEOUT || "3600000"), // 1小时
      mfaRequired: process.env.MFA_REQUIRED === "true",
    },
    threatDetection: {
      enabled: process.env.THREAT_DETECTION_ENABLED !== "false",
      aiModel: process.env.THREAT_DETECTION_MODEL || "anomaly-detector",
      sensitivity: parseFloat(process.env.THREAT_SENSITIVITY || "0.8"),
    },
  },

  // 缓存配置
  cache: {
    redis: {
      url: process.env.REDIS_URL || "redis://localhost:6379",
      ttl: parseInt(process.env.CACHE_TTL || "300"), // 5分钟
      maxMemory: process.env.REDIS_MAX_MEMORY || "256mb",
    },
    edge: {
      enabled: process.env.EDGE_CACHE_ENABLED !== "false",
      nodes: process.env.EDGE_CACHE_NODES?.split(",") || ["localhost"],
      replication: parseInt(process.env.EDGE_CACHE_REPLICATION || "2"),
    },
  },

  // 实时通信配置
  realtime: {
    websocket: {
      enabled: process.env.WEBSOCKET_ENABLED !== "false",
      maxConnections: parseInt(process.env.WS_MAX_CONNECTIONS || "1000"),
      heartbeatInterval: parseInt(process.env.WS_HEARTBEAT_INTERVAL || "30000"),
    },
    subscriptions: {
      maxChannels: parseInt(process.env.MAX_SUBSCRIPTION_CHANNELS || "100"),
      throttleMs: parseInt(process.env.SUBSCRIPTION_THROTTLE || "100"),
    },
  },

  // 可观测性配置
  observability: {
    tracing: {
      enabled: process.env.TRACING_ENABLED !== "false",
      jaegerEndpoint:
        process.env.JAEGER_ENDPOINT || "http://localhost:14268/api/traces",
      sampleRate: parseFloat(process.env.TRACE_SAMPLE_RATE || "1.0"),
    },
    metrics: {
      enabled: process.env.METRICS_ENABLED !== "false",
      prometheusPort: parseInt(process.env.PROMETHEUS_PORT || "9464"),
      exportInterval: parseInt(process.env.METRICS_EXPORT_INTERVAL || "10000"),
    },
    logging: {
      level: process.env.LOG_LEVEL || "info",
      structured: process.env.STRUCTURED_LOGGING === "true",
      elasticsearch: process.env.ELASTICSEARCH_URL,
    },
  },

  // 微服务配置
  microservices: [
    {
      name: "code-analyzer",
      version: "1.0.0",
      wasmModule: "code-analyzer.wasm",
      endpoints: [
        {
          path: "/analyze",
          method: "POST",
          handler: "analyze_code",
          rateLimit: { requests: 100, window: 60 },
          auth: { required: true },
        },
      ],
      resources: { memory: 128, cpu: 200, timeout: 30000 },
      scaling: { minInstances: 2, maxInstances: 10, targetCPU: 70 },
    },
    {
      name: "security-scanner",
      version: "1.0.0",
      wasmModule: "security-scanner.wasm",
      endpoints: [
        {
          path: "/scan",
          method: "POST",
          handler: "scan_vulnerabilities",
          rateLimit: { requests: 50, window: 60 },
          auth: { required: true, roles: ["security", "admin"] },
        },
      ],
      resources: { memory: 256, cpu: 300, timeout: 60000 },
      scaling: { minInstances: 1, maxInstances: 5, targetCPU: 80 },
    },
  ],
});

@Global()
@Module({
  imports: [
    // 基础配置
    ConfigModule.forRoot({
      isGlobal: true,
      load: [coreConfig],
      envFilePath: [".env.local", ".env"],
    }),

    // 事件系统
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: ".",
      newListener: false,
      removeListener: false,
      maxListeners: 20,
      verboseMemoryLeak: false,
      ignoreErrors: false,
    }),

    // 任务调度
    ScheduleModule.forRoot(),

    // 缓存系统
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const redisUrl = configService.get<string>("cache.redis.url");

        if (redisUrl) {
          // Redis缓存配置
          const { redisStore } = await import("cache-manager-redis-store");
          return {
            store: redisStore as any,
            url: redisUrl,
            ttl: configService.get<number>("cache.redis.ttl", 300),
            max: 1000,
          } as any;
        } else {
          // 内存缓存配置
          return {
            ttl: 300,
            max: 1000,
          };
        }
      },
      inject: [ConfigService],
    }),

    // 限流系统
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) =>
        ({
          ttl: 60,
          limit:
            configService.get<string>("NODE_ENV") === "production" ? 100 : 1000,
        } as any),
      inject: [ConfigService],
    }),
  ],

  providers: [
    // 事件溯源和CQRS
    {
      provide: "EVENT_STORE",
      useFactory: (
        configService: ConfigService,
        eventEmitter: EventEmitter2
      ) => {
        const provider = configService.get<string>(
          "database.eventStore.provider",
          "memory"
        );

        switch (provider) {
          case "postgresql":
            return new PostgreSQLEventStore(eventEmitter);
          default:
            return new InMemoryEventStore(eventEmitter);
        }
      },
      inject: [ConfigService, EventEmitter2],
    },
    // BaseAggregateRepository,

    // WebAssembly运行时
    WasmRuntime,
    WasmMicroserviceOrchestrator,

    // AI智能体编排
    AIOrchestrator,
    CodeReviewerAgent,
    DevOpsEngineerAgent,

    // 零信任安全
    AIThreatDetector,
    RiskAssessmentEngine,
    ZeroTrustGuard,

    // 向量数据库和语义搜索
    MultiModalEmbeddingService,
    SemanticSearchService,
    {
      provide: "VECTOR_STORE_FACTORY",
      useValue: VectorStoreFactory,
    },

    // 边缘tRPC
    EdgeCacheManager,
    RealtimeSubscriptionManager,
    EdgeRouter,
    EdgeTRPCService,

    // 可观测性
    OpenTelemetryService,
    MetricsCollector,
    IntelligentAlertingService,

    // 边缘计算网格
    EdgeNodeManager,
    EdgeTaskScheduler,
    EdgeMeshService,

    // 神经形态AI
    NeuromorphicAIService,

    // Web3去中心化认证
    DIDManager,
    VerifiableCredentialManager,
    Web3AuthService,
    SmartContractService,

    // 量子安全加密
    QuantumCryptoService,

    // 核心服务工厂
    {
      provide: "CORE_SERVICES",
      useFactory: (
        eventStore: IEventStore,
        wasmOrchestrator: WasmMicroserviceOrchestrator,
        aiOrchestrator: AIOrchestrator,
        threatDetector: AIThreatDetector,
        semanticSearch: SemanticSearchService,
        edgeTRPC: EdgeTRPCService,
        telemetry: OpenTelemetryService
      ) => ({
        eventStore,
        wasmOrchestrator,
        aiOrchestrator,
        threatDetector,
        semanticSearch,
        edgeTRPC,
        telemetry,
      }),
      inject: [
        "EVENT_STORE",
        WasmMicroserviceOrchestrator,
        AIOrchestrator,
        AIThreatDetector,
        SemanticSearchService,
        EdgeTRPCService,
        OpenTelemetryService,
      ],
    },
  ],

  exports: [
    // 配置
    ConfigService,
    "EVENT_STORE",
    // BaseAggregateRepository,
    WasmRuntime,
    WasmMicroserviceOrchestrator,
    AIOrchestrator,
    CodeReviewerAgent,
    DevOpsEngineerAgent,
    AIThreatDetector,
    RiskAssessmentEngine,
    ZeroTrustGuard,
    MultiModalEmbeddingService,
    SemanticSearchService,
    EdgeCacheManager,
    RealtimeSubscriptionManager,
    EdgeRouter,
    EdgeTRPCService,
    OpenTelemetryService,
    MetricsCollector,
    IntelligentAlertingService,
    EdgeNodeManager,
    EdgeTaskScheduler,
    EdgeMeshService,
    NeuromorphicAIService,
    DIDManager,
    VerifiableCredentialManager,
    Web3AuthService,
    SmartContractService,
    QuantumCryptoService,
    "VECTOR_STORE_FACTORY",
    "CORE_SERVICES",
  ],
})
export class CoreModule {
  constructor(
    private readonly configService: ConfigService,
    private readonly telemetryService: OpenTelemetryService
  ) {
    this.logStartupInfo();
  }

  private logStartupInfo(): void {
    const environment = this.configService.get<string>(
      "NODE_ENV",
      "development"
    );
    const serviceName = this.configService.get<string>(
      "observability.serviceName",
      "juanie-api-ai"
    );

    console.log();
  }
}
