/**
 * 🚀 Juanie AI - AI服务配置
 * 支持多模态AI服务、本地Ollama和智能推荐系统
 */

import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { z } from "zod";
import {
  type AIAgentType,
  type AIResult,
  type AITask,
  CONSTANTS,
  getBooleanEnvVar,
  getEnvVar,
  getNumberEnvVar,
  retry,
  withTimeout,
} from "../core";
import type { DeepPartial } from "../core/types";

// ============================================================================
// AI配置Schema
// ============================================================================

export const AIConfigSchema = z.object({
  // OpenAI配置
  openai: z.object({
    apiKey: z.string().optional(),
    baseURL: z.string().optional(),
    organization: z.string().optional(),
    models: z.object({
      chat: z.string().default("gpt-4-turbo-preview"),
      embedding: z.string().default("text-embedding-3-large"),
      vision: z.string().default("gpt-4-vision-preview"),
      tts: z.string().default("tts-1"),
      stt: z.string().default("whisper-1"),
    }),
    limits: z.object({
      maxTokens: z.number().default(4096),
      temperature: z.number().default(0.7),
      topP: z.number().default(0.9),
      frequencyPenalty: z.number().default(0.0),
      presencePenalty: z.number().default(0.0),
    }),
  }),

  // Anthropic配置
  anthropic: z.object({
    apiKey: z.string().optional(),
    baseURL: z.string().optional(),
    models: z.object({
      chat: z.string().default("claude-3-sonnet-20240229"),
      vision: z.string().default("claude-3-opus-20240229"),
    }),
    limits: z.object({
      maxTokens: z.number().default(4096),
      temperature: z.number().default(0.7),
    }),
  }),

  // Ollama配置
  ollama: z.object({
    enabled: z.boolean().default(true),
    baseURL: z.string().default("http://localhost:11434"),
    models: z
      .array(z.string())
      .default(["llama2", "codellama", "mistral", "neural-chat", "llava"]),
    defaultModel: z.string().default("llama2"),
    pullOnStartup: z.boolean().default(true),
    keepAlive: z.string().default("5m"),
  }),

  // 嵌入向量配置
  embeddings: z.object({
    provider: z.enum(["openai", "ollama", "local"]).default("openai"),
    model: z.string().default("text-embedding-3-large"),
    dimensions: z.number().default(3072),
    batchSize: z.number().default(100),
    cacheEnabled: z.boolean().default(true),
    cacheTTL: z.number().default(86400), // 24小时
  }),

  // 智能代理配置
  agents: z.object({
    enabled: z.boolean().default(true),
    maxConcurrent: z.number().default(10),
    defaultTimeout: z.number().default(60000), // 1分钟
    retryAttempts: z.number().default(3),
    retryDelay: z.number().default(1000),
    types: z
      .array(
        z.enum([
          "code-reviewer",
          "devops-engineer",
          "security-analyst",
          "performance-optimizer",
          "cost-optimizer",
          "incident-responder",
          "compliance-auditor",
          "data-scientist",
        ])
      )
      .default(["code-reviewer", "devops-engineer", "security-analyst"]),
  }),

  // 推荐系统配置
  recommendations: z.object({
    enabled: z.boolean().default(true),
    updateInterval: z.number().default(300000), // 5分钟
    maxRecommendations: z.number().default(10),
    confidenceThreshold: z.number().default(0.7),
    categories: z
      .array(
        z.enum([
          "performance",
          "security",
          "cost",
          "architecture",
          "code-quality",
          "deployment",
        ])
      )
      .default(["performance", "security", "cost", "architecture"]),
  }),

  // 多模态配置
  multimodal: z.object({
    enabled: z.boolean().default(true),
    vision: z.object({
      enabled: z.boolean().default(true),
      maxImageSize: z.number().default(20 * 1024 * 1024), // 20MB
      supportedFormats: z
        .array(z.string())
        .default(["jpg", "jpeg", "png", "webp"]),
    }),
    audio: z.object({
      enabled: z.boolean().default(true),
      maxAudioSize: z.number().default(25 * 1024 * 1024), // 25MB
      supportedFormats: z
        .array(z.string())
        .default(["mp3", "wav", "flac", "m4a"]),
    }),
    document: z.object({
      enabled: z.boolean().default(true),
      maxDocumentSize: z.number().default(50 * 1024 * 1024), // 50MB
      supportedFormats: z
        .array(z.string())
        .default(["pdf", "docx", "txt", "md"]),
    }),
  }),

  // 缓存配置
  cache: z.object({
    enabled: z.boolean().default(true),
    provider: z.enum(["redis", "memory"]).default("redis"),
    ttl: z.number().default(3600), // 1小时
    maxSize: z.number().default(1000),
    keyPrefix: z.string().default("ai:"),
  }),

  // 监控配置
  monitoring: z.object({
    enabled: z.boolean().default(true),
    logRequests: z.boolean().default(true),
    logResponses: z.boolean().default(false),
    metricsInterval: z.number().default(60000), // 1分钟
    alertThresholds: z.object({
      errorRate: z.number().default(0.05), // 5%
      latency: z.number().default(10000), // 10秒
      tokenUsage: z.number().default(1000000), // 100万tokens/小时
    }),
  }),
});

export type AIConfig = z.infer<typeof AIConfigSchema>;

// ============================================================================
// AI服务管理器
// ============================================================================

@Injectable()
export class AIServiceManager implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AIServiceManager.name);
  private config: AIConfig;
  private clients: Map<string, any> = new Map();
  private agentPool: Map<AIAgentType, any[]> = new Map();
  private taskQueue: AITask[] = [];
  private processingTasks: Set<string> = new Set();
  private metricsInterval: NodeJS.Timeout | null = null;

  // 服务统计
  private stats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    totalTokensUsed: 0,
    averageLatency: 0,
    activeAgents: 0,
    queuedTasks: 0,
    lastUpdate: new Date(),
  };

  constructor(
    private configService: ConfigService,
    private eventEmitter: EventEmitter2
  ) {
    this.config = this.loadConfig();
  }

  async onModuleInit() {
    await this.initialize();
  }

  async onModuleDestroy() {
    await this.cleanup();
  }

  /**
   * 加载AI配置
   */
  private loadConfig(): AIConfig {
    const config: DeepPartial<AIConfig> = {
      openai: {
        apiKey: getEnvVar("OPENAI_API_KEY", undefined),
        baseURL: getEnvVar("OPENAI_BASE_URL", undefined),
        organization: getEnvVar("OPENAI_ORGANIZATION", undefined),
      },
      anthropic: {
        apiKey: getEnvVar("ANTHROPIC_API_KEY", undefined),
        baseURL: getEnvVar("ANTHROPIC_BASE_URL", undefined),
      },
      ollama: {
        enabled: getBooleanEnvVar("OLLAMA_ENABLED", true),
        baseURL: getEnvVar("OLLAMA_BASE_URL", "http://localhost:11434"),
        defaultModel: getEnvVar("OLLAMA_DEFAULT_MODEL", "llama2"),
        pullOnStartup: getBooleanEnvVar("OLLAMA_PULL_ON_STARTUP", true),
        keepAlive: getEnvVar("OLLAMA_KEEP_ALIVE", "5m"),
      },
      embeddings: {
        provider: getEnvVar("EMBEDDINGS_PROVIDER", "openai") as any,
        model: getEnvVar("EMBEDDINGS_MODEL", "text-embedding-3-large"),
        dimensions: getNumberEnvVar("EMBEDDINGS_DIMENSIONS", 3072),
        batchSize: getNumberEnvVar("EMBEDDINGS_BATCH_SIZE", 100),
        cacheEnabled: getBooleanEnvVar("EMBEDDINGS_CACHE_ENABLED", true),
        cacheTTL: getNumberEnvVar("EMBEDDINGS_CACHE_TTL", 86400),
      },
      agents: {
        enabled: getBooleanEnvVar("AI_AGENTS_ENABLED", true),
        maxConcurrent: getNumberEnvVar("AI_AGENTS_MAX_CONCURRENT", 10),
        defaultTimeout: getNumberEnvVar("AI_AGENTS_TIMEOUT", 60000),
        retryAttempts: getNumberEnvVar("AI_AGENTS_RETRY_ATTEMPTS", 3),
        retryDelay: getNumberEnvVar("AI_AGENTS_RETRY_DELAY", 1000),
      },
      recommendations: {
        enabled: getBooleanEnvVar("AI_RECOMMENDATIONS_ENABLED", true),
        updateInterval: getNumberEnvVar(
          "AI_RECOMMENDATIONS_UPDATE_INTERVAL",
          300000
        ),
        maxRecommendations: getNumberEnvVar("AI_RECOMMENDATIONS_MAX", 10),
        confidenceThreshold: getNumberEnvVar(
          "AI_RECOMMENDATIONS_CONFIDENCE",
          0.7
        ),
      },
      multimodal: {
        enabled: getBooleanEnvVar("AI_MULTIMODAL_ENABLED", true),
        vision: {
          enabled: getBooleanEnvVar("AI_VISION_ENABLED", true),
          maxImageSize: getNumberEnvVar("AI_VISION_MAX_SIZE", 20 * 1024 * 1024),
        },
        audio: {
          enabled: getBooleanEnvVar("AI_AUDIO_ENABLED", true),
          maxAudioSize: getNumberEnvVar("AI_AUDIO_MAX_SIZE", 25 * 1024 * 1024),
        },
        document: {
          enabled: getBooleanEnvVar("AI_DOCUMENT_ENABLED", true),
          maxDocumentSize: getNumberEnvVar(
            "AI_DOCUMENT_MAX_SIZE",
            50 * 1024 * 1024
          ),
        },
      },
      cache: {
        enabled: getBooleanEnvVar("AI_CACHE_ENABLED", true),
        provider: getEnvVar("AI_CACHE_PROVIDER", "redis") as any,
        ttl: getNumberEnvVar("AI_CACHE_TTL", 3600),
        maxSize: getNumberEnvVar("AI_CACHE_MAX_SIZE", 1000),
        keyPrefix: getEnvVar("AI_CACHE_KEY_PREFIX", "ai:"),
      },
      monitoring: {
        enabled: getBooleanEnvVar("AI_MONITORING_ENABLED", true),
        logRequests: getBooleanEnvVar("AI_LOG_REQUESTS", true),
        logResponses: getBooleanEnvVar("AI_LOG_RESPONSES", false),
        metricsInterval: getNumberEnvVar("AI_METRICS_INTERVAL", 60000),
      },
    };

    return AIConfigSchema.parse(config);
  }

  /**
   * 初始化AI服务
   */
  private async initialize(): Promise<void> {
    try {
      this.logger.log("Initializing AI services...");

      // 初始化各个AI提供商客户端
      await this.initializeClients();

      // 初始化智能代理池
      if (this.config.agents.enabled) {
        await this.initializeAgentPool();
      }

      // 启动任务处理器
      this.startTaskProcessor();

      // 启动推荐系统
      if (this.config.recommendations.enabled) {
        this.startRecommendationEngine();
      }

      // 启动监控
      if (this.config.monitoring.enabled) {
        this.startMonitoring();
      }

      this.logger.log("AI services initialized successfully");
    } catch (error) {
      this.logger.error("Failed to initialize AI services", error);
      throw error;
    }
  }

  /**
   * 初始化AI客户端
   */
  private async initializeClients(): Promise<void> {
    // 初始化OpenAI客户端
    if (this.config.openai.apiKey) {
      try {
        // 这里可以初始化OpenAI客户端
        this.clients.set("openai", { initialized: true });
        this.logger.log("OpenAI client initialized");
      } catch (error) {
        this.logger.warn("Failed to initialize OpenAI client", error);
      }
    }

    // 初始化Anthropic客户端
    if (this.config.anthropic.apiKey) {
      try {
        // 这里可以初始化Anthropic客户端
        this.clients.set("anthropic", { initialized: true });
        this.logger.log("Anthropic client initialized");
      } catch (error) {
        this.logger.warn("Failed to initialize Anthropic client", error);
      }
    }

    // 初始化Ollama客户端
    if (this.config.ollama.enabled) {
      try {
        await this.initializeOllama();
      } catch (error) {
        this.logger.warn("Failed to initialize Ollama client", error);
      }
    }
  }

  /**
   * 初始化Ollama客户端
   */
  private async initializeOllama(): Promise<void> {
    try {
      // 检查Ollama服务是否可用
      const response = await fetch(`${this.config.ollama.baseURL}/api/tags`);
      if (!response.ok) {
        throw new Error(`Ollama service not available: ${response.status}`);
      }

      const data = await response.json();
      const availableModels = data.models?.map((m: any) => m.name) || [];

      this.logger.log(`Ollama available models: ${availableModels.join(", ")}`);

      // 如果启用了启动时拉取模型
      if (this.config.ollama.pullOnStartup) {
        await this.pullOllamaModels();
      }

      this.clients.set("ollama", {
        baseURL: this.config.ollama.baseURL,
        availableModels,
        initialized: true,
      });

      this.logger.log("Ollama client initialized successfully");
    } catch (error) {
      this.logger.error("Failed to initialize Ollama client", error);
      throw error;
    }
  }

  /**
   * 拉取Ollama模型
   */
  private async pullOllamaModels(): Promise<void> {
    for (const model of this.config.ollama.models) {
      try {
        this.logger.log(`Pulling Ollama model: ${model}`);

        const response = await fetch(`${this.config.ollama.baseURL}/api/pull`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: model }),
        });

        if (!response.ok) {
          throw new Error(`Failed to pull model ${model}: ${response.status}`);
        }

        this.logger.log(`Successfully pulled Ollama model: ${model}`);
      } catch (error) {
        this.logger.warn(`Failed to pull Ollama model ${model}`, error);
      }
    }
  }

  /**
   * 初始化智能代理池
   */
  private async initializeAgentPool(): Promise<void> {
    for (const agentType of this.config.agents.types) {
      const agents = [];

      // 为每种代理类型创建实例
      for (let i = 0; i < 3; i++) {
        // 每种类型创建3个实例
        const agent = {
          id: `${agentType}-${i}`,
          type: agentType,
          status: "idle",
          capabilities: this.getAgentCapabilities(agentType),
          createdAt: new Date(),
          lastUsed: null,
        };
        agents.push(agent);
      }

      this.agentPool.set(agentType, agents);
      this.logger.log(
        `Initialized ${agents.length} agents for type: ${agentType}`
      );
    }
  }

  /**
   * 获取代理能力
   */
  private getAgentCapabilities(agentType: AIAgentType): string[] {
    const capabilities: Record<AIAgentType, string[]> = {
      "code-reviewer": [
        "code-analysis",
        "security-scan",
        "best-practices",
        "performance-review",
      ],
      "devops-engineer": [
        "deployment",
        "infrastructure",
        "monitoring",
        "automation",
      ],
      "security-analyst": [
        "vulnerability-scan",
        "threat-detection",
        "compliance-check",
        "risk-assessment",
      ],
      "performance-optimizer": [
        "performance-analysis",
        "bottleneck-detection",
        "optimization-suggestions",
      ],
      "cost-optimizer": [
        "cost-analysis",
        "resource-optimization",
        "budget-planning",
      ],
      "incident-responder": [
        "incident-analysis",
        "root-cause-analysis",
        "mitigation-strategies",
      ],
      "compliance-auditor": [
        "compliance-check",
        "audit-trail",
        "policy-validation",
      ],
      "data-scientist": [
        "data-analysis",
        "ml-modeling",
        "statistical-analysis",
        "insights-generation",
      ],
    };

    return capabilities[agentType] || [];
  }

  /**
   * 启动任务处理器
   */
  private startTaskProcessor(): void {
    setInterval(() => {
      this.processTaskQueue();
    }, 1000); // 每秒处理一次任务队列
  }

  /**
   * 处理任务队列
   */
  private async processTaskQueue(): Promise<void> {
    if (this.taskQueue.length === 0) {
      return;
    }

    const availableSlots =
      this.config.agents.maxConcurrent - this.processingTasks.size;
    if (availableSlots <= 0) {
      return;
    }

    const tasksToProcess = this.taskQueue.splice(0, availableSlots);

    for (const task of tasksToProcess) {
      this.processTask(task).catch((error) => {
        this.logger.error(`Failed to process task ${task.id}`, error);
      });
    }
  }

  /**
   * 处理单个任务
   */
  private async processTask(task: AITask): Promise<void> {
    this.processingTasks.add(task.id);

    try {
      const startTime = Date.now();

      // 选择合适的代理
      const agent = this.selectAgent(task);
      if (!agent) {
        throw new Error("No available agent for task");
      }

      // 执行任务
      const result = await this.executeTask(task, agent);

      const processingTime = Date.now() - startTime;

      // 更新统计
      this.updateStats(true, processingTime, result.tokensUsed || 0);

      // 发送结果事件
      this.eventEmitter.emit("ai.task.completed", {
        taskId: task.id,
        agentId: agent.id,
        result,
        processingTime,
      });

      this.logger.debug(`Task ${task.id} completed in ${processingTime}ms`);
    } catch (error) {
      this.updateStats(false, 0, 0);

      this.eventEmitter.emit("ai.task.failed", {
        taskId: task.id,
        error: error.message,
      });

      this.logger.error(`Task ${task.id} failed`, error);
    } finally {
      this.processingTasks.delete(task.id);
    }
  }

  /**
   * 选择合适的代理
   */
  private selectAgent(task: AITask): any | null {
    // 这里实现代理选择逻辑
    // 可以基于任务类型、代理负载、能力匹配等因素

    for (const [agentType, agents] of this.agentPool) {
      const availableAgent = agents.find((agent) => agent.status === "idle");
      if (availableAgent) {
        availableAgent.status = "busy";
        availableAgent.lastUsed = new Date();
        return availableAgent;
      }
    }

    return null;
  }

  /**
   * 执行任务
   */
  private async executeTask(task: AITask, agent: any): Promise<AIResult> {
    const timeout =
      task.requirements?.timeout || this.config.agents.defaultTimeout;

    return await withTimeout(
      retry(
        async () => {
          // 这里实现具体的任务执行逻辑
          // 根据任务类型调用相应的AI服务

          return {
            taskId: task.id,
            agentId: agent.id,
            output: { message: "Task completed successfully" },
            confidence: 0.95,
            processingTime: 1000,
            tokensUsed: 100,
            model: "gpt-4-turbo-preview",
            metadata: {
              agentType: agent.type,
              capabilities: agent.capabilities,
            },
          };
        },
        {
          retries: this.config.agents.retryAttempts,
          delay: this.config.agents.retryDelay,
        }
      ),
      timeout
    );
  }

  /**
   * 启动推荐引擎
   */
  private startRecommendationEngine(): void {
    setInterval(() => {
      this.generateRecommendations();
    }, this.config.recommendations.updateInterval);
  }

  /**
   * 生成推荐
   */
  private async generateRecommendations(): Promise<void> {
    try {
      this.logger.debug("Generating AI recommendations...");

      // 这里实现推荐生成逻辑
      // 可以基于用户行为、系统状态、历史数据等

      const recommendations = [];

      this.eventEmitter.emit("ai.recommendations.generated", {
        recommendations,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error("Failed to generate recommendations", error);
    }
  }

  /**
   * 启动监控
   */
  private startMonitoring(): void {
    this.metricsInterval = setInterval(() => {
      this.collectMetrics();
    }, this.config.monitoring.metricsInterval);
  }

  /**
   * 收集指标
   */
  private collectMetrics(): void {
    try {
      this.stats.queuedTasks = this.taskQueue.length;
      this.stats.activeAgents = this.processingTasks.size;
      this.stats.lastUpdate = new Date();

      this.eventEmitter.emit("ai.metrics.collected", this.stats);

      this.logger.debug("AI metrics collected", this.stats);
    } catch (error) {
      this.logger.error("Failed to collect AI metrics", error);
    }
  }

  /**
   * 更新统计信息
   */
  private updateStats(
    success: boolean,
    latency: number,
    tokensUsed: number
  ): void {
    this.stats.totalRequests++;

    if (success) {
      this.stats.successfulRequests++;
    } else {
      this.stats.failedRequests++;
    }

    this.stats.totalTokensUsed += tokensUsed;

    // 计算平均延迟
    const totalLatency =
      this.stats.averageLatency * (this.stats.totalRequests - 1) + latency;
    this.stats.averageLatency = totalLatency / this.stats.totalRequests;
  }

  /**
   * 提交AI任务
   */
  async submitTask(task: Omit<AITask, "id">): Promise<string> {
    const taskWithId: AITask = {
      ...task,
      id: crypto.randomUUID(),
    };

    this.taskQueue.push(taskWithId);

    this.logger.debug(
      `Task submitted: ${taskWithId.id}, queue size: ${this.taskQueue.length}`
    );

    return taskWithId.id;
  }

  /**
   * 获取嵌入向量
   */
  async getEmbedding(text: string): Promise<number[]> {
    try {
      // 这里实现嵌入向量生成逻辑
      // 根据配置的提供商调用相应的API

      this.logger.debug(
        `Generating embedding for text: ${text.substring(0, 50)}...`
      );

      // 模拟返回嵌入向量
      return new Array(this.config.embeddings.dimensions)
        .fill(0)
        .map(() => Math.random());
    } catch (error) {
      this.logger.error("Failed to generate embedding", error);
      throw error;
    }
  }

  /**
   * 批量获取嵌入向量
   */
  async getBatchEmbeddings(texts: string[]): Promise<number[][]> {
    const batchSize = this.config.embeddings.batchSize;
    const results: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((text) => this.getEmbedding(text))
      );
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * 获取服务统计信息
   */
  getStats() {
    return {
      ...this.stats,
      config: {
        enabledProviders: Array.from(this.clients.keys()),
        agentTypes: Array.from(this.agentPool.keys()),
        totalAgents: Array.from(this.agentPool.values()).reduce(
          (sum, agents) => sum + agents.length,
          0
        ),
      },
    };
  }

  /**
   * 清理资源
   */
  private async cleanup(): Promise<void> {
    this.logger.log("Cleaning up AI services...");

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    // 清理客户端连接
    this.clients.clear();
    this.agentPool.clear();
    this.taskQueue.length = 0;
    this.processingTasks.clear();

    this.logger.log("AI services cleaned up successfully");
  }
}

// ============================================================================
// AI模块导出
// ============================================================================

export const AIProviders = [AIServiceManager];
