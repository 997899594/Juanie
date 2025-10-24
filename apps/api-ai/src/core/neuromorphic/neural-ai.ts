import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { z } from 'zod';

// 神经元Schema
export const NeuronSchema = z.object({
  id: z.string(),
  type: z.enum(['input', 'hidden', 'output', 'memory', 'attention']),
  activation: z.number().min(-1).max(1),
  threshold: z.number().min(0).max(1),
  weights: z.array(z.number()),
  bias: z.number(),
  lastFired: z.date().optional(),
  firingRate: z.number().min(0).default(0),
  plasticity: z.number().min(0).max(1).default(0.1), // 可塑性
  metadata: z.record(z.string(), z.any()).optional(),
});

// 突触Schema
export const SynapseSchema = z.object({
  id: z.string(),
  preNeuronId: z.string(),
  postNeuronId: z.string(),
  weight: z.number(),
  delay: z.number().min(0).default(1), // 传导延迟（毫秒）
  plasticity: z.number().min(0).max(1).default(0.1),
  lastActive: z.date().optional(),
  strengthHistory: z.array(z.number()).default([]),
  type: z.enum(['excitatory', 'inhibitory']).default('excitatory'),
});

// 神经网络层Schema
export const NeuralLayerSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['input', 'hidden', 'output', 'recurrent', 'attention', 'memory']),
  neurons: z.array(z.string()), // 神经元ID列表
  activationFunction: z.enum(['sigmoid', 'tanh', 'relu', 'leaky_relu', 'swish', 'spike']),
  learningRate: z.number().min(0).max(1).default(0.001),
  dropout: z.number().min(0).max(1).default(0),
  batchNorm: z.boolean().default(false),
});

// 脉冲神经网络配置Schema
export const SpikingNetworkConfigSchema = z.object({
  timeStep: z.number().min(0.1).max(10).default(1), // 时间步长（毫秒）
  simulationTime: z.number().min(1).max(10000).default(1000), // 仿真时间（毫秒）
  refractoryPeriod: z.number().min(0).max(10).default(2), // 不应期（毫秒）
  threshold: z.number().min(0).max(1).default(0.7), // 发放阈值
  decayRate: z.number().min(0).max(1).default(0.95), // 膜电位衰减率
  noiseLevel: z.number().min(0).max(0.5).default(0.01), // 噪声水平
});

// 自适应学习配置Schema
export const AdaptiveLearningConfigSchema = z.object({
  algorithm: z.enum(['stdp', 'rl-stdp', 'bcm', 'oja', 'homeostatic']),
  learningWindow: z.number().min(1).max(100).default(20), // 学习窗口（毫秒）
  reinforcementSignal: z.number().min(-1).max(1).default(0),
  homeostasisTarget: z.number().min(0).max(1).default(0.1), // 稳态目标
  metaplasticity: z.boolean().default(true), // 元可塑性
  forgettingRate: z.number().min(0).max(1).default(0.001), // 遗忘率
});

export type Neuron = z.infer<typeof NeuronSchema>;
export type Synapse = z.infer<typeof SynapseSchema>;
export type NeuralLayer = z.infer<typeof NeuralLayerSchema>;
export type SpikingNetworkConfig = z.infer<typeof SpikingNetworkConfigSchema>;
export type AdaptiveLearningConfig = z.infer<typeof AdaptiveLearningConfigSchema>;

/**
 * 脉冲神经元模型
 * 实现生物逼真的神经元行为
 */
export class SpikingNeuron {
  private membranePotential = 0;
  private lastSpikeTime = 0;
  private spikeHistory: number[] = [];
  private adaptationVariable = 0;

  constructor(
    public readonly neuron: Neuron,
    private readonly config: SpikingNetworkConfig,
  ) {}

  /**
   * 更新神经元状态
   */
  update(currentTime: number, inputCurrent: number): boolean {
    // 检查不应期
    if (currentTime - this.lastSpikeTime < this.config.refractoryPeriod) {
      return false;
    }

    // 更新膜电位（Leaky Integrate-and-Fire模型）
    const leak = this.membranePotential * (1 - this.config.decayRate);
    const input = inputCurrent + this.generateNoise();
    const adaptation = this.adaptationVariable * 0.1; // 适应性电流
    
    this.membranePotential = leak + input - adaptation;

    // 检查是否达到发放阈值
    if (this.membranePotential >= this.config.threshold) {
      this.spike(currentTime);
      return true;
    }

    // 更新适应性变量
    this.adaptationVariable *= 0.99; // 缓慢衰减

    return false;
  }

  /**
   * 神经元发放
   */
  private spike(currentTime: number) {
    this.lastSpikeTime = currentTime;
    this.membranePotential = 0; // 重置膜电位
    this.adaptationVariable += 0.1; // 增加适应性
    this.spikeHistory.push(currentTime);
    
    // 保持历史记录在合理范围内
    if (this.spikeHistory.length > 100) {
      this.spikeHistory.shift();
    }

    // 更新发放率
    this.updateFiringRate(currentTime);
  }

  /**
   * 更新发放率
   */
  private updateFiringRate(currentTime: number) {
    const windowSize = 100; // 100ms窗口
    const recentSpikes = this.spikeHistory.filter(
      time => currentTime - time <= windowSize
    );
    this.neuron.firingRate = (recentSpikes.length / windowSize) * 1000; // Hz
  }

  /**
   * 生成噪声
   */
  private generateNoise(): number {
    return (Math.random() - 0.5) * 2 * this.config.noiseLevel;
  }

  /**
   * 获取当前状态
   */
  getState() {
    return {
      membranePotential: this.membranePotential,
      lastSpikeTime: this.lastSpikeTime,
      firingRate: this.neuron.firingRate,
      adaptationVariable: this.adaptationVariable,
      spikeCount: this.spikeHistory.length,
    };
  }
}

/**
 * STDP（Spike-Timing Dependent Plasticity）学习规则
 * 实现基于脉冲时序的可塑性
 */
export class STDPLearningRule {
  private readonly tauPlus = 20; // 正向时间常数（毫秒）
  private readonly tauMinus = 20; // 负向时间常数（毫秒）
  private readonly aPlus = 0.01; // 正向学习率
  private readonly aMinus = 0.01; // 负向学习率

  constructor(private readonly config: AdaptiveLearningConfig) {}

  /**
   * 更新突触权重
   */
  updateWeight(
    synapse: Synapse,
    preSpikeTime: number,
    postSpikeTime: number,
    reinforcement = 0,
  ): number {
    const deltaT = postSpikeTime - preSpikeTime;
    let deltaWeight = 0;

    if (deltaT > 0) {
      // 因果关系：pre -> post，增强连接
      deltaWeight = this.aPlus * Math.exp(-deltaT / this.tauPlus);
    } else if (deltaT < 0) {
      // 反因果关系：post -> pre，削弱连接
      deltaWeight = -this.aMinus * Math.exp(Math.abs(deltaT) / this.tauMinus);
    }

    // 应用强化学习信号
    if (this.config.algorithm === 'rl-stdp') {
      deltaWeight *= (1 + reinforcement);
    }

    // 应用元可塑性
    if (this.config.metaplasticity) {
      const activityLevel = synapse.strengthHistory.length > 0 
        ? synapse.strengthHistory.slice(-10).reduce((a, b) => a + b, 0) / 10 
        : 0;
      const metaFactor = 1 / (1 + activityLevel); // 高活动时降低可塑性
      deltaWeight *= metaFactor;
    }

    // 更新权重
    const newWeight = synapse.weight + deltaWeight * synapse.plasticity;
    
    // 权重边界限制
    const clampedWeight = Math.max(-2, Math.min(2, newWeight));
    
    // 记录权重历史
    synapse.strengthHistory.push(Math.abs(deltaWeight));
    if (synapse.strengthHistory.length > 50) {
      synapse.strengthHistory.shift();
    }

    return clampedWeight;
  }
}

/**
 * 注意力机制模块
 * 实现动态注意力分配
 */
export class AttentionMechanism {
  private attentionWeights = new Map<string, number>();
  private contextMemory: number[] = [];

  /**
   * 计算注意力权重
   */
  computeAttention(
    query: number[],
    keys: number[][],
    values: number[][],
  ): { weights: number[]; output: number[] } {
    const scores = keys.map(key => this.dotProduct(query, key));
    const weights = this.softmax(scores);
    
    // 计算加权输出
    const output = new Array(values[0].length).fill(0);
    for (let i = 0; i < values.length; i++) {
      for (let j = 0; j < values[i].length; j++) {
        output[j] += weights[i] * values[i][j];
      }
    }

    return { weights, output };
  }

  /**
   * 自注意力机制
   */
  selfAttention(input: number[][]): number[][] {
    const results: number[][] = [];
    
    for (let i = 0; i < input.length; i++) {
      const query = input[i];
      const { output } = this.computeAttention(query, input, input);
      results.push(output);
    }

    return results;
  }

  /**
   * 多头注意力
   */
  multiHeadAttention(
    input: number[][],
    numHeads: number,
  ): number[][] {
    const headSize = Math.floor(input[0].length / numHeads);
    const heads: number[][][] = [];

    // 分割输入到多个头
    for (let h = 0; h < numHeads; h++) {
      const headInput = input.map(row => 
        row.slice(h * headSize, (h + 1) * headSize)
      );
      heads.push(this.selfAttention(headInput));
    }

    // 连接所有头的输出
    const result: number[][] = [];
    for (let i = 0; i < input.length; i++) {
      const row: number[] = [];
      for (const head of heads) {
        row.push(...head[i]);
      }
      result.push(row);
    }

    return result;
  }

  private dotProduct(a: number[], b: number[]): number {
    return a.reduce((sum, val, i) => sum + val * b[i], 0);
  }

  private softmax(scores: number[]): number[] {
    const maxScore = Math.max(...scores);
    const expScores = scores.map(score => Math.exp(score - maxScore));
    const sumExp = expScores.reduce((sum, exp) => sum + exp, 0);
    return expScores.map(exp => exp / sumExp);
  }
}

/**
 * 工作记忆模块
 * 实现短期记忆和长期记忆的交互
 */
export class WorkingMemory {
  private shortTermMemory: Map<string, any> = new Map();
  private longTermMemory: Map<string, any> = new Map();
  private memoryDecay = 0.95; // 记忆衰减率
  private consolidationThreshold = 0.8; // 巩固阈值

  /**
   * 存储短期记忆
   */
  storeShortTerm(key: string, value: any, importance = 0.5) {
    this.shortTermMemory.set(key, {
      value,
      importance,
      timestamp: Date.now(),
      accessCount: 1,
    });
  }

  /**
   * 检索记忆
   */
  retrieve(key: string): any {
    // 首先检查短期记忆
    const shortTerm = this.shortTermMemory.get(key);
    if (shortTerm) {
      shortTerm.accessCount++;
      shortTerm.importance = Math.min(1, shortTerm.importance * 1.1);
      return shortTerm.value;
    }

    // 然后检查长期记忆
    const longTerm = this.longTermMemory.get(key);
    if (longTerm) {
      longTerm.accessCount++;
      return longTerm.value;
    }

    return null;
  }

  /**
   * 记忆巩固过程
   */
  consolidateMemory() {
    for (const [key, memory] of this.shortTermMemory.entries()) {
      // 基于重要性和访问频率决定是否巩固到长期记忆
      const consolidationScore = memory.importance * Math.log(memory.accessCount + 1);
      
      if (consolidationScore >= this.consolidationThreshold) {
        this.longTermMemory.set(key, {
          value: memory.value,
          importance: memory.importance,
          consolidatedAt: Date.now(),
          accessCount: memory.accessCount,
        });
      }
    }

    // 清理过期的短期记忆
    this.decayShortTermMemory();
  }

  /**
   * 短期记忆衰减
   */
  private decayShortTermMemory() {
    const now = Date.now();
    const maxAge = 300000; // 5分钟

    for (const [key, memory] of this.shortTermMemory.entries()) {
      const age = now - memory.timestamp;
      
      if (age > maxAge) {
        this.shortTermMemory.delete(key);
      } else {
        memory.importance *= this.memoryDecay;
        if (memory.importance < 0.1) {
          this.shortTermMemory.delete(key);
        }
      }
    }
  }

  /**
   * 获取记忆统计
   */
  getMemoryStats() {
    return {
      shortTermCount: this.shortTermMemory.size,
      longTermCount: this.longTermMemory.size,
      totalMemoryItems: this.shortTermMemory.size + this.longTermMemory.size,
    };
  }
}

/**
 * 神经形态AI服务
 * 整合脑启发计算模式
 */
@Injectable()
export class NeuromorphicAIService implements OnModuleInit {
  private readonly logger = new Logger(NeuromorphicAIService.name);
  private readonly neurons = new Map<string, SpikingNeuron>();
  private readonly synapses = new Map<string, Synapse>();
  private readonly layers = new Map<string, NeuralLayer>();
  private readonly stdpLearning: STDPLearningRule;
  private readonly attention: AttentionMechanism;
  private readonly workingMemory: WorkingMemory;
  private simulationTimer?: NodeJS.Timeout;
  private currentTime = 0;

  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    const learningConfig = AdaptiveLearningConfigSchema.parse(
      this.configService.get('neuromorphic.learning', {})
    );
    
    this.stdpLearning = new STDPLearningRule(learningConfig);
    this.attention = new AttentionMechanism();
    this.workingMemory = new WorkingMemory();
  }

  async onModuleInit() {
    await this.initializeNetwork();
    this.startSimulation();
    this.logger.log('Neuromorphic AI Service initialized');
  }

  /**
   * 创建神经元
   */
  createNeuron(config: Partial<Neuron>): Neuron {
    const neuron: Neuron = NeuronSchema.parse({
      id: config.id || this.generateId('neuron'),
      type: config.type || 'hidden',
      activation: 0,
      threshold: config.threshold || 0.7,
      weights: config.weights || [],
      bias: config.bias || 0,
      plasticity: config.plasticity || 0.1,
      firingRate: 0,
      metadata: config.metadata || {},
    });

    const networkConfig = SpikingNetworkConfigSchema.parse(
      this.configService.get('neuromorphic.network', {})
    );

    const spikingNeuron = new SpikingNeuron(neuron, networkConfig);
    this.neurons.set(neuron.id, spikingNeuron);

    this.eventEmitter.emit('neuromorphic.neuron.created', neuron);
    return neuron;
  }

  /**
   * 创建突触连接
   */
  createSynapse(preNeuronId: string, postNeuronId: string, weight = 0.5): Synapse {
    const synapse: Synapse = SynapseSchema.parse({
      id: this.generateId('synapse'),
      preNeuronId,
      postNeuronId,
      weight,
      delay: 1,
      plasticity: 0.1,
      strengthHistory: [],
      type: weight >= 0 ? 'excitatory' : 'inhibitory',
    });

    this.synapses.set(synapse.id, synapse);
    this.eventEmitter.emit('neuromorphic.synapse.created', synapse);
    
    return synapse;
  }

  /**
   * 处理输入数据
   */
  async processInput(input: number[], contextData?: any): Promise<{
    output: number[];
    attention: number[];
    memoryState: any;
  }> {
    // 存储上下文到工作记忆
    if (contextData) {
      this.workingMemory.storeShortTerm('current_context', contextData, 0.8);
    }

    // 应用注意力机制
    const inputMatrix = [input]; // 简化为单个输入向量
    const attentionOutput = this.attention.selfAttention(inputMatrix);
    const attentionWeights = attentionOutput[0];

    // 将注意力加权的输入传递给神经网络
    const networkOutput = await this.forwardPass(attentionWeights);

    // 更新工作记忆
    this.workingMemory.storeShortTerm('last_output', networkOutput, 0.6);

    return {
      output: networkOutput,
      attention: attentionWeights,
      memoryState: this.workingMemory.getMemoryStats(),
    };
  }

  /**
   * 自适应学习
   */
  async adaptiveLearning(
    input: number[],
    expectedOutput: number[],
    reinforcement = 0,
  ): Promise<void> {
    // 前向传播
    const actualOutput = await this.forwardPass(input);

    // 计算误差
    const error = expectedOutput.map((expected, i) => expected - actualOutput[i]);
    const errorMagnitude = Math.sqrt(error.reduce((sum, e) => sum + e * e, 0));

    // 反向传播和权重更新
    await this.backwardPass(error, reinforcement);

    // 记录学习过程
    this.workingMemory.storeShortTerm('learning_error', errorMagnitude, 0.7);
    
    this.eventEmitter.emit('neuromorphic.learning.completed', {
      error: errorMagnitude,
      reinforcement,
      timestamp: Date.now(),
    });
  }

  /**
   * 获取网络状态
   */
  getNetworkState() {
    const neuronStates = Array.from(this.neurons.entries()).map(([id, neuron]) => ({
      id,
      state: neuron.getState(),
    }));

    const synapseStates = Array.from(this.synapses.values()).map(synapse => ({
      id: synapse.id,
      weight: synapse.weight,
      lastActive: synapse.lastActive,
      strengthHistory: synapse.strengthHistory.slice(-5), // 最近5次
    }));

    return {
      neurons: neuronStates,
      synapses: synapseStates,
      memory: this.workingMemory.getMemoryStats(),
      currentTime: this.currentTime,
    };
  }

  /**
   * 前向传播
   */
  private async forwardPass(input: number[]): Promise<number[]> {
    // 简化的前向传播实现
    // 实际实现中会根据网络拓扑结构进行计算
    
    const output: number[] = [];
    const inputNeurons = Array.from(this.neurons.values())
      .filter(n => n.neuron.type === 'input');
    
    // 设置输入神经元的激活
    inputNeurons.forEach((neuron, i) => {
      if (i < input.length) {
        neuron.neuron.activation = input[i];
      }
    });

    // 模拟网络传播
    await new Promise(resolve => setTimeout(resolve, 10)); // 模拟计算时间

    // 收集输出神经元的激活
    const outputNeurons = Array.from(this.neurons.values())
      .filter(n => n.neuron.type === 'output');
    
    outputNeurons.forEach(neuron => {
      output.push(neuron.neuron.activation);
    });

    return output.length > 0 ? output : [0.5]; // 默认输出
  }

  /**
   * 反向传播
   */
  private async backwardPass(error: number[], reinforcement: number): Promise<void> {
    // 更新突触权重
    for (const synapse of this.synapses.values()) {
      const preNeuron = this.neurons.get(synapse.preNeuronId);
      const postNeuron = this.neurons.get(synapse.postNeuronId);

      if (preNeuron && postNeuron) {
        // 模拟脉冲时序
        const preSpikeTime = preNeuron.neuron.lastFired?.getTime() || 0;
        const postSpikeTime = postNeuron.neuron.lastFired?.getTime() || 0;

        if (preSpikeTime > 0 && postSpikeTime > 0) {
          const newWeight = this.stdpLearning.updateWeight(
            synapse,
            preSpikeTime,
            postSpikeTime,
            reinforcement,
          );
          
          synapse.weight = newWeight;
          synapse.lastActive = new Date();
        }
      }
    }
  }

  /**
   * 初始化网络
   */
  private async initializeNetwork() {
    // 创建基本的网络结构
    const inputNeurons = Array.from({ length: 10 }, (_, i) => 
      this.createNeuron({ type: 'input', id: `input_${i}` })
    );

    const hiddenNeurons = Array.from({ length: 20 }, (_, i) => 
      this.createNeuron({ type: 'hidden', id: `hidden_${i}` })
    );

    const outputNeurons = Array.from({ length: 5 }, (_, i) => 
      this.createNeuron({ type: 'output', id: `output_${i}` })
    );

    // 创建连接
    inputNeurons.forEach(inputNeuron => {
      hiddenNeurons.forEach(hiddenNeuron => {
        this.createSynapse(inputNeuron.id, hiddenNeuron.id, Math.random() - 0.5);
      });
    });

    hiddenNeurons.forEach(hiddenNeuron => {
      outputNeurons.forEach(outputNeuron => {
        this.createSynapse(hiddenNeuron.id, outputNeuron.id, Math.random() - 0.5);
      });
    });

    this.logger.log(`Network initialized with ${this.neurons.size} neurons and ${this.synapses.size} synapses`);
  }

  /**
   * 开始仿真
   */
  private startSimulation() {
    const timeStep = this.configService.get('neuromorphic.network.timeStep', 1);
    
    this.simulationTimer = setInterval(() => {
      this.currentTime += timeStep;
      this.updateNetwork();
      
      // 定期进行记忆巩固
      if (this.currentTime % 1000 === 0) {
        this.workingMemory.consolidateMemory();
      }
    }, timeStep);
  }

  /**
   * 更新网络状态
   */
  private updateNetwork() {
    // 更新所有神经元
    for (const neuron of this.neurons.values()) {
      const inputCurrent = this.calculateInputCurrent(neuron.neuron.id);
      neuron.update(this.currentTime, inputCurrent);
    }
  }

  /**
   * 计算神经元的输入电流
   */
  private calculateInputCurrent(neuronId: string): number {
    let totalCurrent = 0;

    for (const synapse of this.synapses.values()) {
      if (synapse.postNeuronId === neuronId) {
        const preNeuron = this.neurons.get(synapse.preNeuronId);
        if (preNeuron) {
          totalCurrent += preNeuron.neuron.activation * synapse.weight;
        }
      }
    }

    return totalCurrent;
  }

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}