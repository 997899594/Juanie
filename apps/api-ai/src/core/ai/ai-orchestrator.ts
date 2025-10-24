import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { z } from 'zod';
import { performance } from 'perf_hooks';

// AI智能体类型Schema
export const AIAgentTypeSchema = z.enum([
  'code-reviewer',      // 代码审查专家
  'devops-engineer',    // DevOps工程师
  'security-analyst',   // 安全分析师
  'cost-optimizer',     // 成本优化师
  'incident-responder', // 事件响应专家
  'architect',          // 架构师
  'qa-engineer',        // 质量保证工程师
  'data-analyst',       // 数据分析师
]);

export type AIAgentType = z.infer<typeof AIAgentTypeSchema>;

// AI任务Schema
export const AITaskSchema = z.object({
  id: z.string(),
  type: z.string(),
  agentType: AIAgentTypeSchema,
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  context: z.record(z.any()),
  input: z.any(),
  metadata: z.object({
    userId: z.string().optional(),
    projectId: z.string().optional(),
    correlationId: z.string().optional(),
    timeout: z.number().default(30000),
    retries: z.number().default(3),
  }),
  createdAt: z.date(),
});

export type AITask = z.infer<typeof AITaskSchema>;

// AI执行结果Schema
export const AIResultSchema = z.object({
  taskId: z.string(),
  success: z.boolean(),
  result: z.any().optional(),
  error: z.string().optional(),
  confidence: z.number().min(0).max(1),
  executionTime: z.number(),
  tokensUsed: z.number().optional(),
  cost: z.number().optional(),
  metadata: z.record(z.any()).optional(),
  completedAt: z.date(),
});

export type AIResult = z.infer<typeof AIResultSchema>;

// AI智能体接口
export interface IAIAgent {
  readonly type: AIAgentType;
  readonly name: string;
  readonly description: string;
  readonly capabilities: string[];
  
  canHandle(task: AITask): boolean;
  execute(task: AITask): Promise<AIResult>;
  getSystemPrompt(): string;
  getExamples(): Array<{ input: any; output: any }>;
}

// 基础AI智能体抽象类
export abstract class BaseAIAgent implements IAIAgent {
  protected readonly logger: Logger;

  constructor(
    public readonly type: AIAgentType,
    public readonly name: string,
    public readonly description: string,
    public readonly capabilities: string[],
    protected llmService: any, // LLM服务接口
  ) {
    this.logger = new Logger(`AIAgent:${this.type}`);
  }

  abstract canHandle(task: AITask): boolean;
  abstract getSystemPrompt(): string;
  abstract getExamples(): Array<{ input: any; output: any }>;

  async execute(task: AITask): Promise<AIResult> {
    const startTime = performance.now();
    
    try {
      this.logger.debug(`Executing task ${task.id} with agent ${this.name}`);

      // 构建提示词
      const prompt = this.buildPrompt(task);
      
      // 调用LLM服务
      const llmResult = await this.llmService.complete({
        messages: [
          { role: 'system', content: this.getSystemPrompt() },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1, // 低温度确保一致性
        maxTokens: 4000,
        timeout: task.metadata.timeout,
      });

      // 解析结果
      const result = this.parseResult(llmResult.content, task);
      const executionTime = performance.now() - startTime;

      this.logger.log(
        `Task ${task.id} completed in ${executionTime.toFixed(2)}ms, confidence: ${result.confidence}`
      );

      return {
        taskId: task.id,
        success: true,
        result: result.data,
        confidence: result.confidence,
        executionTime,
        tokensUsed: llmResult.tokensUsed,
        cost: llmResult.cost,
        completedAt: new Date(),
      };
    } catch (error) {
      const executionTime = performance.now() - startTime;
      
      this.logger.error(`Task ${task.id} failed:`, error);

      return {
        taskId: task.id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        confidence: 0,
        executionTime,
        completedAt: new Date(),
      };
    }
  }

  protected buildPrompt(task: AITask): string {
    const examples = this.getExamples();
    const exampleText = examples.length > 0 
      ? `\n\nExamples:\n${examples.map(ex => 
          `Input: ${JSON.stringify(ex.input)}\nOutput: ${JSON.stringify(ex.output)}`
        ).join('\n\n')}`
      : '';

    return `
Task Type: ${task.type}
Context: ${JSON.stringify(task.context, null, 2)}
Input: ${JSON.stringify(task.input, null, 2)}
${exampleText}

Please analyze the above and provide your response in JSON format with the following structure:
{
  "analysis": "Your detailed analysis",
  "recommendations": ["List of actionable recommendations"],
  "confidence": 0.95,
  "reasoning": "Explanation of your reasoning"
}
    `.trim();
  }

  protected parseResult(content: string, task: AITask): { data: any; confidence: number } {
    try {
      // 尝试解析JSON响应
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          data: parsed,
          confidence: parsed.confidence || 0.8,
        };
      }

      // 如果不是JSON格式，返回原始文本
      return {
        data: { analysis: content },
        confidence: 0.6,
      };
    } catch (error) {
      this.logger.warn(`Failed to parse AI result for task ${task.id}:`, error);
      return {
        data: { analysis: content },
        confidence: 0.5,
      };
    }
  }
}

// 代码审查智能体
@Injectable()
export class CodeReviewerAgent extends BaseAIAgent {
  constructor(llmService: any) {
    super(
      'code-reviewer',
      'Code Reviewer',
      'Expert code reviewer with deep knowledge of best practices, security, and performance',
      ['code-analysis', 'security-review', 'performance-optimization', 'best-practices'],
      llmService
    );
  }

  canHandle(task: AITask): boolean {
    return task.agentType === 'code-reviewer' && 
           ['code-review', 'security-scan', 'quality-check'].includes(task.type);
  }

  getSystemPrompt(): string {
    return `
You are an expert code reviewer with extensive experience in software development, security, and performance optimization.

Your responsibilities:
1. Analyze code for bugs, security vulnerabilities, and performance issues
2. Ensure adherence to coding standards and best practices
3. Provide constructive feedback and actionable recommendations
4. Assess code maintainability and readability
5. Identify potential technical debt

Focus areas:
- Security vulnerabilities (OWASP Top 10)
- Performance bottlenecks
- Code smells and anti-patterns
- Documentation and comments
- Test coverage and quality
- Dependency management
- Error handling and logging

Always provide specific, actionable feedback with examples when possible.
    `.trim();
  }

  getExamples(): Array<{ input: any; output: any }> {
    return [
      {
        input: {
          code: "function getUserData(id) { return db.query('SELECT * FROM users WHERE id = ' + id); }",
          language: "javascript"
        },
        output: {
          analysis: "SQL injection vulnerability detected",
          recommendations: [
            "Use parameterized queries to prevent SQL injection",
            "Add input validation for the id parameter",
            "Consider using an ORM for safer database operations"
          ],
          confidence: 0.95,
          reasoning: "Direct string concatenation in SQL queries is a critical security vulnerability"
        }
      }
    ];
  }
}

// DevOps工程师智能体
@Injectable()
export class DevOpsEngineerAgent extends BaseAIAgent {
  constructor(llmService: any) {
    super(
      'devops-engineer',
      'DevOps Engineer',
      'Expert in CI/CD, infrastructure automation, and deployment strategies',
      ['ci-cd-optimization', 'infrastructure-analysis', 'deployment-strategies', 'monitoring-setup'],
      llmService
    );
  }

  canHandle(task: AITask): boolean {
    return task.agentType === 'devops-engineer' && 
           ['pipeline-optimization', 'deployment-analysis', 'infrastructure-review'].includes(task.type);
  }

  getSystemPrompt(): string {
    return `
You are an expert DevOps engineer with deep knowledge of CI/CD pipelines, infrastructure automation, and cloud platforms.

Your expertise includes:
1. CI/CD pipeline optimization and troubleshooting
2. Infrastructure as Code (IaC) best practices
3. Container orchestration and microservices
4. Cloud platform optimization (AWS, GCP, Azure)
5. Monitoring and observability setup
6. Security and compliance in DevOps workflows

Focus on:
- Pipeline efficiency and reliability
- Infrastructure scalability and cost optimization
- Security and compliance integration
- Monitoring and alerting strategies
- Disaster recovery and backup strategies

Provide practical, implementable solutions with clear steps.
    `.trim();
  }

  getExamples(): Array<{ input: any; output: any }> {
    return [
      {
        input: {
          pipeline: "build -> test -> deploy to production",
          issues: ["slow builds", "flaky tests", "deployment failures"]
        },
        output: {
          analysis: "Pipeline lacks staging environment and proper error handling",
          recommendations: [
            "Add staging environment for pre-production testing",
            "Implement parallel test execution to reduce build time",
            "Add rollback mechanism for failed deployments",
            "Set up proper monitoring and alerting"
          ],
          confidence: 0.9,
          reasoning: "Missing staging environment increases production deployment risks"
        }
      }
    ];
  }
}

// AI编排器主服务
@Injectable()
export class AIOrchestrator implements OnModuleInit {
  private readonly logger = new Logger(AIOrchestrator.name);
  private agents = new Map<AIAgentType, IAIAgent>();
  private taskQueue: AITask[] = [];
  private activeExecutions = new Map<string, Promise<AIResult>>();

  constructor(
    private configService: ConfigService,
    private eventEmitter: EventEmitter2,
    // 注入各种智能体
    private codeReviewerAgent: CodeReviewerAgent,
    private devopsEngineerAgent: DevOpsEngineerAgent,
  ) {}

  async onModuleInit(): Promise<void> {
    // 注册智能体
    this.registerAgent(this.codeReviewerAgent);
    this.registerAgent(this.devopsEngineerAgent);

    this.logger.log(`AI Orchestrator initialized with ${this.agents.size} agents`);
  }

  private registerAgent(agent: IAIAgent): void {
    this.agents.set(agent.type, agent);
    this.logger.debug(`Registered AI agent: ${agent.name}`);
  }

  // 提交AI任务
  async submitTask(task: Omit<AITask, 'id' | 'createdAt'>): Promise<string> {
    const fullTask: AITask = {
      ...task,
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
    };

    // 验证任务
    AITaskSchema.parse(fullTask);

    // 检查是否有合适的智能体
    const agent = this.findAgent(fullTask);
    if (!agent) {
      throw new Error(`No suitable agent found for task type: ${fullTask.agentType}`);
    }

    // 添加到队列
    this.taskQueue.push(fullTask);
    
    // 发布任务创建事件
    await this.eventEmitter.emitAsync('ai.task.created', fullTask);

    this.logger.debug(`Task ${fullTask.id} submitted to queue`);
    
    // 异步处理任务
    this.processTask(fullTask);

    return fullTask.id;
  }

  // 执行AI任务
  async executeTask(taskId: string): Promise<AIResult> {
    // 检查是否已在执行中
    const activeExecution = this.activeExecutions.get(taskId);
    if (activeExecution) {
      return activeExecution;
    }

    // 从队列中找到任务
    const taskIndex = this.taskQueue.findIndex(t => t.id === taskId);
    if (taskIndex === -1) {
      throw new Error(`Task ${taskId} not found in queue`);
    }

    const task = this.taskQueue[taskIndex];
    this.taskQueue.splice(taskIndex, 1);

    // 创建执行Promise
    const executionPromise = this.doExecuteTask(task);
    this.activeExecutions.set(taskId, executionPromise);

    try {
      const result = await executionPromise;
      return result;
    } finally {
      this.activeExecutions.delete(taskId);
    }
  }

  private async doExecuteTask(task: AITask): Promise<AIResult> {
    const agent = this.findAgent(task);
    if (!agent) {
      throw new Error(`No suitable agent found for task: ${task.id}`);
    }

    try {
      // 发布任务开始事件
      await this.eventEmitter.emitAsync('ai.task.started', task);

      // 执行任务
      const result = await agent.execute(task);

      // 发布任务完成事件
      await this.eventEmitter.emitAsync('ai.task.completed', { task, result });

      return result;
    } catch (error) {
      // 发布任务失败事件
      await this.eventEmitter.emitAsync('ai.task.failed', { task, error });
      throw error;
    }
  }

  private async processTask(task: AITask): Promise<void> {
    // 根据优先级处理任务
    setTimeout(async () => {
      try {
        await this.executeTask(task.id);
      } catch (error) {
        this.logger.error(`Failed to process task ${task.id}:`, error);
      }
    }, this.getPriorityDelay(task.priority));
  }

  private getPriorityDelay(priority: AITask['priority']): number {
    switch (priority) {
      case 'critical': return 0;
      case 'high': return 100;
      case 'medium': return 500;
      case 'low': return 2000;
      default: return 1000;
    }
  }

  private findAgent(task: AITask): IAIAgent | null {
    const agent = this.agents.get(task.agentType);
    return agent && agent.canHandle(task) ? agent : null;
  }

  // 获取智能体列表
  getAgents(): Array<{ type: AIAgentType; name: string; description: string; capabilities: string[] }> {
    return Array.from(this.agents.values()).map(agent => ({
      type: agent.type,
      name: agent.name,
      description: agent.description,
      capabilities: agent.capabilities,
    }));
  }

  // 获取队列状态
  getQueueStatus() {
    return {
      queueLength: this.taskQueue.length,
      activeExecutions: this.activeExecutions.size,
      agents: this.agents.size,
    };
  }

  // 取消任务
  async cancelTask(taskId: string): Promise<boolean> {
    // 从队列中移除
    const taskIndex = this.taskQueue.findIndex(t => t.id === taskId);
    if (taskIndex !== -1) {
      this.taskQueue.splice(taskIndex, 1);
      await this.eventEmitter.emitAsync('ai.task.cancelled', { taskId });
      return true;
    }

    return false;
  }
}