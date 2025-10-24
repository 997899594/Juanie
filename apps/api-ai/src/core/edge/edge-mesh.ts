import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { z } from 'zod';
import { WasmRuntime } from '../wasm/wasm-runtime';

// 边缘节点Schema
export const EdgeNodeSchema = z.object({
  id: z.string(),
  name: z.string(),
  region: z.string(),
  zone: z.string(),
  endpoint: z.string().url(),
  status: z.enum(['online', 'offline', 'degraded', 'maintenance']),
  capabilities: z.array(z.string()),
  resources: z.object({
    cpu: z.number().min(0).max(100), // CPU使用率百分比
    memory: z.number().min(0).max(100), // 内存使用率百分比
    storage: z.number().min(0).max(100), // 存储使用率百分比
    network: z.number().min(0), // 网络带宽 Mbps
  }),
  metadata: z.record(z.string(), z.any()).optional(),
  lastHeartbeat: z.date(),
  createdAt: z.date(),
});

// 边缘任务Schema
export const EdgeTaskSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['wasm', 'container', 'function', 'ai-inference']),
  payload: z.any(),
  requirements: z.object({
    cpu: z.number().min(0),
    memory: z.number().min(0),
    storage: z.number().min(0),
    capabilities: z.array(z.string()).optional(),
    region: z.string().optional(),
    latencyMs: z.number().min(0).optional(),
  }),
  priority: z.enum(['low', 'normal', 'high', 'critical']).default('normal'),
  timeout: z.number().min(1000).default(30000), // 超时时间（毫秒）
  retryCount: z.number().min(0).max(5).default(3),
  status: z.enum(['pending', 'scheduled', 'running', 'completed', 'failed', 'cancelled']),
  assignedNodeId: z.string().optional(),
  result: z.any().optional(),
  error: z.string().optional(),
  createdAt: z.date(),
  startedAt: z.date().optional(),
  completedAt: z.date().optional(),
});

// 边缘路由策略Schema
export const EdgeRoutingStrategySchema = z.object({
  type: z.enum(['nearest', 'least-loaded', 'round-robin', 'weighted', 'ai-optimized']),
  parameters: z.record(z.string(), z.any()).optional(),
});

export type EdgeNode = z.infer<typeof EdgeNodeSchema>;
export type EdgeTask = z.infer<typeof EdgeTaskSchema>;
export type EdgeRoutingStrategy = z.infer<typeof EdgeRoutingStrategySchema>;

/**
 * 边缘节点管理器
 * 管理分布式边缘计算节点
 */
@Injectable()
export class EdgeNodeManager implements OnModuleInit {
  private readonly logger = new Logger(EdgeNodeManager.name);
  private readonly nodes = new Map<string, EdgeNode>();
  private readonly heartbeatInterval = 30000; // 30秒心跳间隔
  private heartbeatTimer?: NodeJS.Timeout;

  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit() {
    await this.initializeNodes();
    this.startHeartbeatMonitoring();
  }

  /**
   * 注册边缘节点
   */
  async registerNode(nodeConfig: Partial<EdgeNode>): Promise<EdgeNode> {
    const node: EdgeNode = EdgeNodeSchema.parse({
      id: nodeConfig.id || this.generateNodeId(),
      name: nodeConfig.name || `edge-node-${Date.now()}`,
      region: nodeConfig.region || 'default',
      zone: nodeConfig.zone || 'default',
      endpoint: nodeConfig.endpoint || 'http://localhost:8080',
      status: 'online',
      capabilities: nodeConfig.capabilities || ['wasm', 'container'],
      resources: {
        cpu: 0,
        memory: 0,
        storage: 0,
        network: 1000,
        ...nodeConfig.resources,
      },
      metadata: nodeConfig.metadata || {},
      lastHeartbeat: new Date(),
      createdAt: new Date(),
    });

    this.nodes.set(node.id, node);
    this.eventEmitter.emit('edge.node.registered', node);
    
    this.logger.log(`Edge node registered: ${node.name} (${node.id})`);
    return node;
  }

  /**
   * 注销边缘节点
   */
  async unregisterNode(nodeId: string): Promise<boolean> {
    const node = this.nodes.get(nodeId);
    if (!node) {
      return false;
    }

    this.nodes.delete(nodeId);
    this.eventEmitter.emit('edge.node.unregistered', node);
    
    this.logger.log(`Edge node unregistered: ${node.name} (${nodeId})`);
    return true;
  }

  /**
   * 更新节点状态
   */
  async updateNodeStatus(nodeId: string, status: EdgeNode['status']): Promise<boolean> {
    const node = this.nodes.get(nodeId);
    if (!node) {
      return false;
    }

    const oldStatus = node.status;
    node.status = status;
    node.lastHeartbeat = new Date();

    this.eventEmitter.emit('edge.node.status.changed', {
      node,
      oldStatus,
      newStatus: status,
    });

    return true;
  }

  /**
   * 更新节点资源使用情况
   */
  async updateNodeResources(nodeId: string, resources: Partial<EdgeNode['resources']>): Promise<boolean> {
    const node = this.nodes.get(nodeId);
    if (!node) {
      return false;
    }

    node.resources = { ...node.resources, ...resources };
    node.lastHeartbeat = new Date();

    this.eventEmitter.emit('edge.node.resources.updated', { node, resources });
    return true;
  }

  /**
   * 获取所有节点
   */
  getAllNodes(): EdgeNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * 获取在线节点
   */
  getOnlineNodes(): EdgeNode[] {
    return this.getAllNodes().filter(node => node.status === 'online');
  }

  /**
   * 根据条件查找节点
   */
  findNodes(criteria: {
    region?: string;
    zone?: string;
    capabilities?: string[];
    maxCpuUsage?: number;
    maxMemoryUsage?: number;
  }): EdgeNode[] {
    return this.getOnlineNodes().filter(node => {
      if (criteria.region && node.region !== criteria.region) return false;
      if (criteria.zone && node.zone !== criteria.zone) return false;
      if (criteria.capabilities && !criteria.capabilities.every(cap => node.capabilities.includes(cap))) return false;
      if (criteria.maxCpuUsage && node.resources.cpu > criteria.maxCpuUsage) return false;
      if (criteria.maxMemoryUsage && node.resources.memory > criteria.maxMemoryUsage) return false;
      return true;
    });
  }

  private async initializeNodes() {
    // 从配置中加载预定义的边缘节点
    const predefinedNodes = this.configService.get<any[]>('edge.nodes', []);
    
    for (const nodeConfig of predefinedNodes) {
      try {
        await this.registerNode(nodeConfig);
      } catch (error) {
        this.logger.error(`Failed to register predefined node: ${nodeConfig.name}`, error);
      }
    }

    // 如果没有预定义节点，创建本地节点
    if (this.nodes.size === 0) {
      await this.registerNode({
        name: 'local-edge-node',
        region: 'local',
        zone: 'default',
        endpoint: 'http://localhost:8080',
        capabilities: ['wasm', 'container', 'ai-inference'],
      });
    }
  }

  private startHeartbeatMonitoring() {
    this.heartbeatTimer = setInterval(() => {
      this.checkNodeHealth();
    }, this.heartbeatInterval);
  }

  private checkNodeHealth() {
    const now = new Date();
    const timeout = this.heartbeatInterval * 2; // 2倍心跳间隔为超时

    for (const node of this.nodes.values()) {
      const timeSinceLastHeartbeat = now.getTime() - node.lastHeartbeat.getTime();
      
      if (timeSinceLastHeartbeat > timeout && node.status === 'online') {
        this.updateNodeStatus(node.id, 'offline');
        this.logger.warn(`Node ${node.name} (${node.id}) marked as offline due to missed heartbeat`);
      }
    }
  }

  private generateNodeId(): string {
    return `edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * 边缘任务调度器
 * 智能调度任务到最优边缘节点
 */
@Injectable()
export class EdgeTaskScheduler {
  private readonly logger = new Logger(EdgeTaskScheduler.name);
  private readonly tasks = new Map<string, EdgeTask>();
  private readonly runningTasks = new Set<string>();

  constructor(
    private readonly nodeManager: EdgeNodeManager,
    private readonly wasmRuntime: WasmRuntime,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * 提交边缘任务
   */
  async submitTask(taskConfig: Partial<EdgeTask>): Promise<EdgeTask> {
    const task: EdgeTask = EdgeTaskSchema.parse({
      id: taskConfig.id || this.generateTaskId(),
      name: taskConfig.name || `edge-task-${Date.now()}`,
      type: taskConfig.type || 'wasm',
      payload: taskConfig.payload,
      requirements: {
        cpu: 1,
        memory: 128,
        storage: 100,
        ...taskConfig.requirements,
      },
      priority: taskConfig.priority || 'normal',
      timeout: taskConfig.timeout || 30000,
      retryCount: taskConfig.retryCount || 3,
      status: 'pending',
      createdAt: new Date(),
    });

    this.tasks.set(task.id, task);
    this.eventEmitter.emit('edge.task.submitted', task);
    
    // 立即尝试调度任务
    await this.scheduleTask(task.id);
    
    this.logger.log(`Edge task submitted: ${task.name} (${task.id})`);
    return task;
  }

  /**
   * 调度任务到边缘节点
   */
  async scheduleTask(taskId: string, strategy: EdgeRoutingStrategy = { type: 'ai-optimized' }): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== 'pending') {
      return false;
    }

    // 查找符合要求的节点
    const candidateNodes = this.nodeManager.findNodes({
      region: task.requirements.region,
      capabilities: task.requirements.capabilities,
      maxCpuUsage: 80, // 最大CPU使用率80%
      maxMemoryUsage: 80, // 最大内存使用率80%
    });

    if (candidateNodes.length === 0) {
      this.logger.warn(`No suitable nodes found for task ${task.id}`);
      return false;
    }

    // 根据策略选择最优节点
    const selectedNode = this.selectOptimalNode(candidateNodes, task, strategy);
    if (!selectedNode) {
      return false;
    }

    // 更新任务状态
    task.status = 'scheduled';
    task.assignedNodeId = selectedNode.id;
    
    this.eventEmitter.emit('edge.task.scheduled', { task, node: selectedNode });
    
    // 执行任务
    await this.executeTask(task, selectedNode);
    
    return true;
  }

  /**
   * 执行边缘任务
   */
  private async executeTask(task: EdgeTask, node: EdgeNode): Promise<void> {
    try {
      task.status = 'running';
      task.startedAt = new Date();
      this.runningTasks.add(task.id);

      this.eventEmitter.emit('edge.task.started', { task, node });

      let result: any;

      switch (task.type) {
        case 'wasm':
          result = await this.executeWasmTask(task, node);
          break;
        case 'ai-inference':
          result = await this.executeAIInferenceTask(task, node);
          break;
        case 'function':
          result = await this.executeFunctionTask(task, node);
          break;
        default:
          throw new Error(`Unsupported task type: ${task.type}`);
      }

      // 任务成功完成
      task.status = 'completed';
      task.result = result;
      task.completedAt = new Date();

      this.eventEmitter.emit('edge.task.completed', { task, node, result });
      this.logger.log(`Task ${task.id} completed successfully on node ${node.id}`);

    } catch (error) {
      // 任务执行失败
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : String(error);
      task.completedAt = new Date();

      this.eventEmitter.emit('edge.task.failed', { task, node, error });
      this.logger.error(`Task ${task.id} failed on node ${node.id}:`, error);

      // 重试逻辑
      if (task.retryCount > 0) {
        task.retryCount--;
        task.status = 'pending';
        task.assignedNodeId = undefined;
        
        setTimeout(() => {
          this.scheduleTask(task.id);
        }, 5000); // 5秒后重试
      }
    } finally {
      this.runningTasks.delete(task.id);
    }
  }

  /**
   * 执行WebAssembly任务
   */
  private async executeWasmTask(task: EdgeTask, node: EdgeNode): Promise<any> {
    const { wasmModule, functionName, args } = task.payload;
    
    // 在WASM运行时中执行
    const result = await this.wasmRuntime.execute(wasmModule, functionName, ...args);
    return result;
  }

  /**
   * 执行AI推理任务
   */
  private async executeAIInferenceTask(task: EdgeTask, node: EdgeNode): Promise<any> {
    const { model, input, parameters } = task.payload;
    
    // 模拟AI推理执行
    // 实际实现中会调用边缘AI推理引擎
    await new Promise(resolve => setTimeout(resolve, 1000)); // 模拟推理时间
    
    return {
      model,
      input,
      output: `AI inference result for ${model}`,
      confidence: 0.95,
      processingTime: 1000,
    };
  }

  /**
   * 执行函数任务
   */
  private async executeFunctionTask(task: EdgeTask, node: EdgeNode): Promise<any> {
    const { code, runtime, args } = task.payload;
    
    // 模拟函数执行
    // 实际实现中会在沙箱环境中执行代码
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return {
      runtime,
      result: `Function executed with args: ${JSON.stringify(args)}`,
      executionTime: 500,
    };
  }

  /**
   * 根据策略选择最优节点
   */
  private selectOptimalNode(
    nodes: EdgeNode[],
    task: EdgeTask,
    strategy: EdgeRoutingStrategy,
  ): EdgeNode | null {
    if (nodes.length === 0) return null;

    switch (strategy.type) {
      case 'nearest':
        return this.selectNearestNode(nodes, task);
      case 'least-loaded':
        return this.selectLeastLoadedNode(nodes);
      case 'round-robin':
        return this.selectRoundRobinNode(nodes);
      case 'weighted':
        return this.selectWeightedNode(nodes, strategy.parameters);
      case 'ai-optimized':
        return this.selectAIOptimizedNode(nodes, task);
      default:
        return nodes[0];
    }
  }

  private selectNearestNode(nodes: EdgeNode[], task: EdgeTask): EdgeNode {
    // 简化的最近节点选择（实际中会考虑地理位置和网络延迟）
    return nodes[0];
  }

  private selectLeastLoadedNode(nodes: EdgeNode[]): EdgeNode {
    return nodes.reduce((best, current) => {
      const bestLoad = best.resources.cpu + best.resources.memory;
      const currentLoad = current.resources.cpu + current.resources.memory;
      return currentLoad < bestLoad ? current : best;
    });
  }

  private selectRoundRobinNode(nodes: EdgeNode[]): EdgeNode {
    // 简化的轮询选择
    const index = Date.now() % nodes.length;
    return nodes[index];
  }

  private selectWeightedNode(nodes: EdgeNode[], parameters?: Record<string, any>): EdgeNode {
    // 基于权重的选择（简化实现）
    return this.selectLeastLoadedNode(nodes);
  }

  private selectAIOptimizedNode(nodes: EdgeNode[], task: EdgeTask): EdgeNode {
    // AI优化的节点选择
    // 综合考虑负载、延迟、能力匹配度等因素
    return nodes.reduce((best, current) => {
      const bestScore = this.calculateNodeScore(best, task);
      const currentScore = this.calculateNodeScore(current, task);
      return currentScore > bestScore ? current : best;
    });
  }

  private calculateNodeScore(node: EdgeNode, task: EdgeTask): number {
    let score = 100;

    // 负载因子（负载越低分数越高）
    const loadFactor = (node.resources.cpu + node.resources.memory) / 2;
    score -= loadFactor;

    // 能力匹配度
    const requiredCapabilities = task.requirements.capabilities || [];
    const matchedCapabilities = requiredCapabilities.filter(cap => 
      node.capabilities.includes(cap)
    ).length;
    const capabilityScore = requiredCapabilities.length > 0 
      ? (matchedCapabilities / requiredCapabilities.length) * 20 
      : 0;
    score += capabilityScore;

    // 网络性能
    score += Math.min(node.resources.network / 100, 10);

    return Math.max(score, 0);
  }

  /**
   * 获取任务状态
   */
  getTask(taskId: string): EdgeTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * 获取所有任务
   */
  getAllTasks(): EdgeTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * 取消任务
   */
  async cancelTask(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task || task.status === 'completed' || task.status === 'cancelled') {
      return false;
    }

    task.status = 'cancelled';
    task.completedAt = new Date();

    this.eventEmitter.emit('edge.task.cancelled', task);
    this.runningTasks.delete(taskId);

    return true;
  }

  private generateTaskId(): string {
    return `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * 边缘计算网格服务
 * 统一管理边缘计算资源和任务调度
 */
@Injectable()
export class EdgeMeshService implements OnModuleInit {
  private readonly logger = new Logger(EdgeMeshService.name);

  constructor(
    private readonly nodeManager: EdgeNodeManager,
    private readonly taskScheduler: EdgeTaskScheduler,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit() {
    this.setupEventListeners();
    this.logger.log('Edge Mesh Service initialized');
  }

  /**
   * 获取网格状态
   */
  getMeshStatus() {
    const nodes = this.nodeManager.getAllNodes();
    const onlineNodes = this.nodeManager.getOnlineNodes();
    const tasks = this.taskScheduler.getAllTasks();
    
    return {
      nodes: {
        total: nodes.length,
        online: onlineNodes.length,
        offline: nodes.length - onlineNodes.length,
      },
      tasks: {
        total: tasks.length,
        pending: tasks.filter(t => t.status === 'pending').length,
        running: tasks.filter(t => t.status === 'running').length,
        completed: tasks.filter(t => t.status === 'completed').length,
        failed: tasks.filter(t => t.status === 'failed').length,
      },
      resources: this.calculateTotalResources(onlineNodes),
    };
  }

  /**
   * 提交分布式任务
   */
  async submitDistributedTask(taskConfig: Partial<EdgeTask>): Promise<EdgeTask> {
    return this.taskScheduler.submitTask(taskConfig);
  }

  /**
   * 注册新的边缘节点
   */
  async registerEdgeNode(nodeConfig: Partial<EdgeNode>): Promise<EdgeNode> {
    return this.nodeManager.registerNode(nodeConfig);
  }

  private setupEventListeners() {
    // 监听节点事件
    this.eventEmitter.on('edge.node.registered', (node: EdgeNode) => {
      this.logger.log(`New edge node joined the mesh: ${node.name}`);
    });

    this.eventEmitter.on('edge.node.unregistered', (node: EdgeNode) => {
      this.logger.log(`Edge node left the mesh: ${node.name}`);
    });

    // 监听任务事件
    this.eventEmitter.on('edge.task.completed', ({ task, node }) => {
      this.logger.log(`Task ${task.name} completed on node ${node.name}`);
    });

    this.eventEmitter.on('edge.task.failed', ({ task, node, error }) => {
      this.logger.error(`Task ${task.name} failed on node ${node.name}: ${error}`);
    });
  }

  private calculateTotalResources(nodes: EdgeNode[]) {
    return nodes.reduce(
      (total, node) => ({
        cpu: total.cpu + (100 - node.resources.cpu),
        memory: total.memory + (100 - node.resources.memory),
        storage: total.storage + (100 - node.resources.storage),
        network: total.network + node.resources.network,
      }),
      { cpu: 0, memory: 0, storage: 0, network: 0 }
    );
  }
}