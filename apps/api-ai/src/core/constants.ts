/**
 * 🚀 Juanie AI - 核心常量定义
 * 统一管理系统级别的常量配置
 */

// ============================================================================
// 系统常量
// ============================================================================

export const SYSTEM = {
  NAME: 'Juanie AI',
  VERSION: '2025.1.0',
  DESCRIPTION: 'Next-Generation AI-Native DevOps Platform',
  AUTHOR: 'Juanie Team',
  LICENSE: 'MIT',
  REPOSITORY: 'https://github.com/juanie/juanie-ai',
  DOCUMENTATION: 'https://docs.juanie.ai',
  SUPPORT: 'https://support.juanie.ai',
} as const;

// ============================================================================
// API常量
// ============================================================================

export const API = {
  VERSION: 'v1',
  PREFIX: '/api/v1',
  TIMEOUT: 30000, // 30秒
  MAX_PAYLOAD_SIZE: 10 * 1024 * 1024, // 10MB
  RATE_LIMIT: {
    WINDOW_MS: 15 * 60 * 1000, // 15分钟
    MAX_REQUESTS: 1000,
    SKIP_SUCCESSFUL_REQUESTS: false,
    SKIP_FAILED_REQUESTS: false,
  },
  CORS: {
    ORIGIN: ['http://localhost:3000', 'https://app.juanie.ai'],
    METHODS: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    ALLOWED_HEADERS: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-API-Key'],
    CREDENTIALS: true,
  },
} as const;

// ============================================================================
// 数据库常量
// ============================================================================

export const DATABASE = {
  CONNECTION: {
    POOL_SIZE: 20,
    TIMEOUT: 30000,
    IDLE_TIMEOUT: 10000,
    MAX_LIFETIME: 3600000, // 1小时
    SSL: true,
  },
  MIGRATIONS: {
    TABLE_NAME: 'migrations',
    DIRECTORY: './src/database/migrations',
    EXTENSION: '.sql',
  },
  SCHEMAS: {
    PUBLIC: 'public',
    EVENTS: 'events',
    ANALYTICS: 'analytics',
    SECURITY: 'security',
  },
} as const;

// ============================================================================
// 缓存常量
// ============================================================================

export const CACHE = {
  REDIS: {
    KEY_PREFIX: 'juanie:',
    DEFAULT_TTL: 3600, // 1小时
    MAX_MEMORY_POLICY: 'allkeys-lru',
    COMPRESSION_THRESHOLD: 1024, // 1KB
  },
  MEMORY: {
    MAX_SIZE: 100 * 1024 * 1024, // 100MB
    TTL: 300, // 5分钟
    CHECK_PERIOD: 60, // 1分钟
  },
  KEYS: {
    USER_SESSION: 'session:user:',
    API_RATE_LIMIT: 'rate_limit:api:',
    VECTOR_SEARCH: 'vector:search:',
    AI_RESPONSE: 'ai:response:',
    EDGE_NODE: 'edge:node:',
    QUANTUM_KEY: 'quantum:key:',
  },
} as const;

// ============================================================================
// 事件常量
// ============================================================================

export const EVENTS = {
  DOMAIN: {
    USER_CREATED: 'UserCreated',
    USER_UPDATED: 'UserUpdated',
    USER_DELETED: 'UserDeleted',
    PROJECT_CREATED: 'ProjectCreated',
    PROJECT_UPDATED: 'ProjectUpdated',
    PROJECT_DELETED: 'ProjectDeleted',
    DEPLOYMENT_STARTED: 'DeploymentStarted',
    DEPLOYMENT_COMPLETED: 'DeploymentCompleted',
    DEPLOYMENT_FAILED: 'DeploymentFailed',
    SECURITY_THREAT_DETECTED: 'SecurityThreatDetected',
    PERFORMANCE_ISSUE_DETECTED: 'PerformanceIssueDetected',
    AI_RECOMMENDATION_GENERATED: 'AIRecommendationGenerated',
    EDGE_TASK_SCHEDULED: 'EdgeTaskScheduled',
    EDGE_TASK_COMPLETED: 'EdgeTaskCompleted',
    NEURAL_NETWORK_TRAINED: 'NeuralNetworkTrained',
    WEB3_SESSION_CREATED: 'Web3SessionCreated',
    QUANTUM_KEY_GENERATED: 'QuantumKeyGenerated',
  },
  SYSTEM: {
    SERVICE_STARTED: 'ServiceStarted',
    SERVICE_STOPPED: 'ServiceStopped',
    HEALTH_CHECK_FAILED: 'HealthCheckFailed',
    MEMORY_THRESHOLD_EXCEEDED: 'MemoryThresholdExceeded',
    CPU_THRESHOLD_EXCEEDED: 'CPUThresholdExceeded',
    DISK_THRESHOLD_EXCEEDED: 'DiskThresholdExceeded',
  },
  CHANNELS: {
    REALTIME_UPDATES: 'realtime:updates',
    SYSTEM_ALERTS: 'system:alerts',
    USER_NOTIFICATIONS: 'user:notifications',
    AI_INSIGHTS: 'ai:insights',
    SECURITY_EVENTS: 'security:events',
    PERFORMANCE_METRICS: 'performance:metrics',
  },
} as const;

// ============================================================================
// AI常量
// ============================================================================

export const AI = {
  MODELS: {
    OPENAI: {
      GPT_4_TURBO: 'gpt-4-turbo-preview',
      GPT_4: 'gpt-4',
      GPT_3_5_TURBO: 'gpt-3.5-turbo',
    },
    ANTHROPIC: {
      CLAUDE_3_OPUS: 'claude-3-opus-20240229',
      CLAUDE_3_SONNET: 'claude-3-sonnet-20240229',
      CLAUDE_3_HAIKU: 'claude-3-haiku-20240307',
    },
    OLLAMA: {
      LLAMA_2: 'llama2',
      CODELLAMA: 'codellama',
      MISTRAL: 'mistral',
      NEURAL_CHAT: 'neural-chat',
    },
  },
  LIMITS: {
    MAX_TOKENS: 4096,
    MAX_CONTEXT_LENGTH: 128000,
    TEMPERATURE: 0.7,
    TOP_P: 0.9,
    FREQUENCY_PENALTY: 0.0,
    PRESENCE_PENALTY: 0.0,
  },
  TIMEOUTS: {
    COMPLETION: 60000, // 1分钟
    EMBEDDING: 30000, // 30秒
    FINE_TUNING: 3600000, // 1小时
  },
  AGENT_TYPES: {
    CODE_REVIEWER: 'code-reviewer',
    DEVOPS_ENGINEER: 'devops-engineer',
    SECURITY_ANALYST: 'security-analyst',
    PERFORMANCE_OPTIMIZER: 'performance-optimizer',
    COST_OPTIMIZER: 'cost-optimizer',
    INCIDENT_RESPONDER: 'incident-responder',
    COMPLIANCE_AUDITOR: 'compliance-auditor',
    DATA_SCIENTIST: 'data-scientist',
  },
} as const;

// ============================================================================
// 安全常量
// ============================================================================

export const SECURITY = {
  JWT: {
    ALGORITHM: 'HS256',
    EXPIRES_IN: '24h',
    REFRESH_EXPIRES_IN: '7d',
    ISSUER: 'juanie-ai',
    AUDIENCE: 'juanie-users',
  },
  BCRYPT: {
    ROUNDS: 12,
  },
  RATE_LIMITING: {
    AUTH: {
      WINDOW_MS: 15 * 60 * 1000, // 15分钟
      MAX_ATTEMPTS: 5,
    },
    API: {
      WINDOW_MS: 15 * 60 * 1000, // 15分钟
      MAX_REQUESTS: 1000,
    },
    AI: {
      WINDOW_MS: 60 * 1000, // 1分钟
      MAX_REQUESTS: 60,
    },
  },
  ZERO_TRUST: {
    RISK_THRESHOLDS: {
      LOW: 0.3,
      MEDIUM: 0.6,
      HIGH: 0.8,
      CRITICAL: 0.9,
    },
    SESSION_TIMEOUT: 8 * 60 * 60 * 1000, // 8小时
    CONTINUOUS_AUTH_INTERVAL: 30 * 60 * 1000, // 30分钟
  },
  ENCRYPTION: {
    ALGORITHM: 'aes-256-gcm',
    KEY_LENGTH: 32,
    IV_LENGTH: 16,
    TAG_LENGTH: 16,
  },
} as const;

// ============================================================================
// WebAssembly常量
// ============================================================================

export const WASM = {
  RUNTIME: {
    DEFAULT_MEMORY_PAGES: 256, // 16MB
    MAX_MEMORY_PAGES: 65536, // 4GB
    DEFAULT_TIMEOUT: 30000, // 30秒
    MAX_TIMEOUT: 300000, // 5分钟
  },
  FEATURES: {
    BULK_MEMORY: true,
    SIMD: true,
    THREADS: false, // 默认关闭多线程
    REFERENCE_TYPES: true,
  },
  MICROSERVICES: {
    DEFAULT_REPLICAS: 3,
    MIN_REPLICAS: 1,
    MAX_REPLICAS: 100,
    HEALTH_CHECK_INTERVAL: 30000, // 30秒
    HEALTH_CHECK_TIMEOUT: 5000, // 5秒
    HEALTH_CHECK_RETRIES: 3,
  },
} as const;

// ============================================================================
// 向量数据库常量
// ============================================================================

export const VECTOR = {
  DIMENSIONS: {
    OPENAI_ADA_002: 1536,
    OPENAI_TEXT_3_SMALL: 1536,
    OPENAI_TEXT_3_LARGE: 3072,
    SENTENCE_TRANSFORMERS: 384,
    CUSTOM: 768,
  },
  METRICS: {
    COSINE: 'cosine',
    EUCLIDEAN: 'euclidean',
    DOT_PRODUCT: 'dot',
    MANHATTAN: 'manhattan',
  },
  SEARCH: {
    DEFAULT_LIMIT: 10,
    MAX_LIMIT: 100,
    DEFAULT_THRESHOLD: 0.7,
    MIN_THRESHOLD: 0.0,
    MAX_THRESHOLD: 1.0,
  },
  BATCH: {
    DEFAULT_SIZE: 100,
    MAX_SIZE: 1000,
    TIMEOUT: 30000, // 30秒
  },
} as const;

// ============================================================================
// 边缘计算常量
// ============================================================================

export const EDGE = {
  REGIONS: {
    US_EAST_1: 'us-east-1',
    US_WEST_1: 'us-west-1',
    EU_WEST_1: 'eu-west-1',
    AP_SOUTHEAST_1: 'ap-southeast-1',
    LOCAL: 'local',
  },
  NODE: {
    HEARTBEAT_INTERVAL: 30000, // 30秒
    HEARTBEAT_TIMEOUT: 90000, // 90秒
    MAX_OFFLINE_TIME: 300000, // 5分钟
    HEALTH_CHECK_INTERVAL: 60000, // 1分钟
  },
  TASK: {
    DEFAULT_TIMEOUT: 300000, // 5分钟
    MAX_TIMEOUT: 3600000, // 1小时
    MAX_RETRIES: 3,
    RETRY_DELAY: 5000, // 5秒
    PRIORITY_LEVELS: ['low', 'normal', 'high', 'critical'],
  },
  ROUTING: {
    STRATEGIES: ['nearest', 'least-loaded', 'round-robin', 'weighted', 'ai-optimized'],
    LOAD_BALANCE_THRESHOLD: 0.8,
    LATENCY_THRESHOLD: 100, // 100ms
  },
} as const;

// ============================================================================
// 神经形态AI常量
// ============================================================================

export const NEURAL = {
  NETWORK: {
    DEFAULT_TIME_STEP: 1.0, // ms
    DEFAULT_SIMULATION_TIME: 1000.0, // ms
    DEFAULT_THRESHOLD: -55.0, // mV
    DEFAULT_REFRACTORY_PERIOD: 2.0, // ms
    DEFAULT_DECAY_RATE: 0.95,
    DEFAULT_NOISE_LEVEL: 0.01,
  },
  LEARNING: {
    STDP_WINDOW: 20.0, // ms
    LEARNING_RATE: 0.01,
    FORGETTING_RATE: 0.001,
    HOMEOSTASIS_TARGET: 10.0, // Hz
    METAPLASTICITY_THRESHOLD: 0.5,
  },
  ATTENTION: {
    HEAD_COUNT: 8,
    KEY_DIM: 64,
    VALUE_DIM: 64,
    DROPOUT_RATE: 0.1,
    TEMPERATURE: 1.0,
  },
  MEMORY: {
    WORKING_CAPACITY: 7, // Miller's magic number
    CONSOLIDATION_THRESHOLD: 0.8,
    DECAY_RATE: 0.1,
    REHEARSAL_STRENGTH: 1.2,
  },
} as const;

// ============================================================================
// Web3常量
// ============================================================================

export const WEB3 = {
  NETWORKS: {
    ETHEREUM_MAINNET: 1,
    ETHEREUM_GOERLI: 5,
    ETHEREUM_SEPOLIA: 11155111,
    POLYGON_MAINNET: 137,
    POLYGON_MUMBAI: 80001,
    BSC_MAINNET: 56,
    BSC_TESTNET: 97,
    AVALANCHE_MAINNET: 43114,
    AVALANCHE_FUJI: 43113,
  },
  DID: {
    METHODS: ['did:ethr', 'did:key', 'did:web', 'did:ion'],
    DEFAULT_METHOD: 'did:ethr',
    KEY_TYPES: ['secp256k1', 'ed25519', 'rsa'],
    DEFAULT_KEY_TYPE: 'secp256k1',
  },
  CREDENTIALS: {
    CONTEXTS: [
      'https://www.w3.org/2018/credentials/v1',
      'https://w3id.org/security/suites/jws-2020/v1',
    ],
    TYPES: ['VerifiableCredential', 'IdentityCredential', 'AccessCredential'],
    PROOF_TYPES: ['JsonWebSignature2020', 'EcdsaSecp256k1Signature2019'],
  },
  SESSION: {
    DEFAULT_EXPIRY: 24 * 60 * 60 * 1000, // 24小时
    MAX_EXPIRY: 7 * 24 * 60 * 60 * 1000, // 7天
    NONCE_LENGTH: 32,
    CHALLENGE_LENGTH: 32,
  },
} as const;

// ============================================================================
// 量子加密常量
// ============================================================================

export const QUANTUM = {
  ALGORITHMS: {
    KYBER: {
      KYBER_512: { keySize: 512, securityLevel: 1 },
      KYBER_768: { keySize: 768, securityLevel: 3 },
      KYBER_1024: { keySize: 1024, securityLevel: 5 },
    },
    DILITHIUM: {
      DILITHIUM_2: { keySize: 2420, securityLevel: 2 },
      DILITHIUM_3: { keySize: 3293, securityLevel: 3 },
      DILITHIUM_5: { keySize: 4595, securityLevel: 5 },
    },
    FALCON: {
      FALCON_512: { keySize: 512, securityLevel: 1 },
      FALCON_1024: { keySize: 1024, securityLevel: 5 },
    },
    SPHINCS: {
      SPHINCS_128S: { keySize: 128, securityLevel: 1 },
      SPHINCS_192S: { keySize: 192, securityLevel: 3 },
      SPHINCS_256S: { keySize: 256, securityLevel: 5 },
    },
  },
  HASH: {
    SHAKE256: { outputLength: 32 },
    BLAKE3: { outputLength: 32 },
    SHA3_256: { outputLength: 32 },
    SHA3_512: { outputLength: 64 },
  },
  KEY_DERIVATION: {
    ITERATIONS: 100000,
    SALT_LENGTH: 32,
    KEY_LENGTH: 32,
  },
} as const;

// ============================================================================
// 可观测性常量
// ============================================================================

export const OBSERVABILITY = {
  TRACING: {
    SERVICE_NAME: 'juanie-ai',
    SAMPLE_RATE: 0.1, // 10%
    MAX_SPANS: 1000,
    SPAN_TIMEOUT: 30000, // 30秒
  },
  METRICS: {
    COLLECTION_INTERVAL: 15000, // 15秒
    RETENTION_PERIOD: 30 * 24 * 60 * 60 * 1000, // 30天
    BATCH_SIZE: 100,
    MAX_LABELS: 10,
  },
  LOGGING: {
    MAX_LOG_SIZE: 10 * 1024 * 1024, // 10MB
    ROTATION_SIZE: 100 * 1024 * 1024, // 100MB
    RETENTION_DAYS: 30,
    STRUCTURED_FORMAT: true,
  },
  ALERTS: {
    EVALUATION_INTERVAL: 60000, // 1分钟
    NOTIFICATION_COOLDOWN: 300000, // 5分钟
    MAX_ALERTS_PER_RULE: 10,
    DEFAULT_SEVERITY: 'medium',
  },
} as const;

// ============================================================================
// 性能常量
// ============================================================================

export const PERFORMANCE = {
  THRESHOLDS: {
    CPU_WARNING: 70, // %
    CPU_CRITICAL: 90, // %
    MEMORY_WARNING: 80, // %
    MEMORY_CRITICAL: 95, // %
    DISK_WARNING: 85, // %
    DISK_CRITICAL: 95, // %
    RESPONSE_TIME_WARNING: 1000, // ms
    RESPONSE_TIME_CRITICAL: 5000, // ms
  },
  MONITORING: {
    COLLECTION_INTERVAL: 30000, // 30秒
    RETENTION_PERIOD: 7 * 24 * 60 * 60 * 1000, // 7天
    AGGREGATION_WINDOW: 300000, // 5分钟
  },
  OPTIMIZATION: {
    AUTO_SCALING_THRESHOLD: 80, // %
    SCALE_UP_COOLDOWN: 300000, // 5分钟
    SCALE_DOWN_COOLDOWN: 600000, // 10分钟
    MIN_INSTANCES: 1,
    MAX_INSTANCES: 10,
  },
} as const;

// ============================================================================
// 错误代码
// ============================================================================

export const ERROR_CODES = {
  // 通用错误 (1000-1999)
  INTERNAL_SERVER_ERROR: 'E1000',
  INVALID_REQUEST: 'E1001',
  VALIDATION_ERROR: 'E1002',
  NOT_FOUND: 'E1003',
  TIMEOUT: 'E1004',
  RATE_LIMIT_EXCEEDED: 'E1005',

  // 认证错误 (2000-2999)
  UNAUTHORIZED: 'E2000',
  INVALID_TOKEN: 'E2001',
  TOKEN_EXPIRED: 'E2002',
  INSUFFICIENT_PERMISSIONS: 'E2003',
  ACCOUNT_LOCKED: 'E2004',
  INVALID_CREDENTIALS: 'E2005',

  // 业务逻辑错误 (3000-3999)
  RESOURCE_CONFLICT: 'E3000',
  BUSINESS_RULE_VIOLATION: 'E3001',
  QUOTA_EXCEEDED: 'E3002',
  DEPENDENCY_FAILURE: 'E3003',
  OPERATION_NOT_ALLOWED: 'E3004',

  // AI服务错误 (4000-4999)
  AI_SERVICE_UNAVAILABLE: 'E4000',
  AI_MODEL_ERROR: 'E4001',
  AI_QUOTA_EXCEEDED: 'E4002',
  AI_CONTENT_FILTERED: 'E4003',
  AI_TIMEOUT: 'E4004',

  // 数据库错误 (5000-5999)
  DATABASE_CONNECTION_ERROR: 'E5000',
  DATABASE_QUERY_ERROR: 'E5001',
  DATABASE_CONSTRAINT_VIOLATION: 'E5002',
  DATABASE_TIMEOUT: 'E5003',
  DATABASE_MIGRATION_ERROR: 'E5004',

  // 外部服务错误 (6000-6999)
  EXTERNAL_SERVICE_ERROR: 'E6000',
  NETWORK_ERROR: 'E6001',
  SERVICE_UNAVAILABLE: 'E6002',
  INTEGRATION_ERROR: 'E6003',
  WEBHOOK_ERROR: 'E6004',
} as const;

// ============================================================================
// 导出所有常量
// ============================================================================

export const CONSTANTS = {
  SYSTEM,
  API,
  DATABASE,
  CACHE,
  EVENTS,
  AI,
  SECURITY,
  WASM,
  VECTOR,
  EDGE,
  NEURAL,
  WEB3,
  QUANTUM,
  OBSERVABILITY,
  PERFORMANCE,
  ERROR_CODES,
} as const;

export default CONSTANTS;