/**
 * 🚀 Juanie AI - 零信任安全服务
 * 实现持续验证和自适应访问控制
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { z } from 'zod';
import { 
  CONSTANTS,
  getEnvVar,
  getBooleanEnvVar,
  getNumberEnvVar,
  type SecurityContext,
  type RiskAssessment,
  type ThreatEvent,
} from '../core';

// ============================================================================
// 零信任策略Schema
// ============================================================================

export const ZeroTrustPolicySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  enabled: z.boolean().default(true),
  priority: z.number().int().min(1).max(100).default(50),
  
  // 条件匹配
  conditions: z.object({
    userRoles: z.array(z.string()).optional(),
    userGroups: z.array(z.string()).optional(),
    deviceTypes: z.array(z.enum(['desktop', 'mobile', 'tablet', 'server', 'iot'])).optional(),
    locations: z.array(z.string()).optional(), // 地理位置
    ipRanges: z.array(z.string()).optional(), // IP范围
    timeRanges: z.array(z.object({
      start: z.string().regex(/^\d{2}:\d{2}$/),
      end: z.string().regex(/^\d{2}:\d{2}$/),
      days: z.array(z.number().int().min(0).max(6)), // 0=Sunday, 6=Saturday
    })).optional(),
    riskLevels: z.array(z.enum(['low', 'medium', 'high', 'critical'])).optional(),
  }),
  
  // 访问控制
  access: z.object({
    action: z.enum(['allow', 'deny', 'challenge']),
    resources: z.array(z.string()).optional(), // 资源路径或模式
    permissions: z.array(z.string()).optional(), // 权限列表
    
    // 挑战要求
    challenges: z.array(z.enum([
      'mfa', 'biometric', 'device_verification', 
      'location_verification', 'behavioral_analysis'
    ])).optional(),
    
    // 会话限制
    sessionLimits: z.object({
      maxDuration: z.number().int().min(60).optional(), // 秒
      maxIdleTime: z.number().int().min(60).optional(), // 秒
      maxConcurrentSessions: z.number().int().min(1).optional(),
    }).optional(),
  }),
  
  // 监控和审计
  monitoring: z.object({
    logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    alertOnViolation: z.boolean().default(true),
    alertOnChallenge: z.boolean().default(false),
    auditTrail: z.boolean().default(true),
  }).default({}),
  
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});

export const AccessRequestSchema = z.object({
  userId: z.string().uuid(),
  sessionId: z.string().uuid(),
  resource: z.string(),
  action: z.string(),
  context: z.object({
    userAgent: z.string().optional(),
    ipAddress: z.string().ip().optional(),
    location: z.object({
      country: z.string().optional(),
      region: z.string().optional(),
      city: z.string().optional(),
      coordinates: z.object({
        lat: z.number(),
        lng: z.number(),
      }).optional(),
    }).optional(),
    device: z.object({
      type: z.enum(['desktop', 'mobile', 'tablet', 'server', 'iot']),
      os: z.string().optional(),
      browser: z.string().optional(),
      fingerprint: z.string().optional(),
    }).optional(),
    timestamp: z.date().default(() => new Date()),
  }),
});

export const AccessDecisionSchema = z.object({
  decision: z.enum(['allow', 'deny', 'challenge']),
  reason: z.string(),
  riskScore: z.number().min(0).max(100),
  appliedPolicies: z.array(z.string().uuid()),
  requiredChallenges: z.array(z.string()).optional(),
  sessionLimits: z.object({
    maxDuration: z.number().int().optional(),
    maxIdleTime: z.number().int().optional(),
    maxConcurrentSessions: z.number().int().optional(),
  }).optional(),
  metadata: z.record(z.any()).optional(),
});

export type ZeroTrustPolicy = z.infer<typeof ZeroTrustPolicySchema>;
export type AccessRequest = z.infer<typeof AccessRequestSchema>;
export type AccessDecision = z.infer<typeof AccessDecisionSchema>;

// ============================================================================
// 风险评估引擎
// ============================================================================

interface RiskFactor {
  name: string;
  weight: number;
  calculate: (context: SecurityContext) => number;
}

class RiskAssessmentEngine {
  private factors: RiskFactor[] = [
    {
      name: 'location_anomaly',
      weight: 0.25,
      calculate: (context) => {
        // 基于历史位置数据计算异常分数
        // 这里是简化实现，实际应该基于用户历史位置
        return Math.random() * 30; // 0-30分
      },
    },
    {
      name: 'device_trust',
      weight: 0.20,
      calculate: (context) => {
        // 设备信任度评估
        const knownDevice = context.deviceFingerprint && 
          this.isKnownDevice(context.deviceFingerprint);
        return knownDevice ? 0 : 40; // 未知设备40分风险
      },
    },
    {
      name: 'behavioral_anomaly',
      weight: 0.20,
      calculate: (context) => {
        // 行为异常检测
        // 基于访问模式、时间、频率等
        return Math.random() * 25; // 0-25分
      },
    },
    {
      name: 'network_reputation',
      weight: 0.15,
      calculate: (context) => {
        // IP/网络声誉检查
        const suspiciousIP = this.isSuspiciousIP(context.ipAddress);
        return suspiciousIP ? 50 : Math.random() * 10; // 可疑IP 50分
      },
    },
    {
      name: 'time_anomaly',
      weight: 0.10,
      calculate: (context) => {
        // 时间异常（非正常工作时间访问）
        const hour = new Date().getHours();
        const isBusinessHours = hour >= 9 && hour <= 17;
        return isBusinessHours ? 0 : 15; // 非工作时间15分风险
      },
    },
    {
      name: 'session_anomaly',
      weight: 0.10,
      calculate: (context) => {
        // 会话异常（并发会话、会话劫持等）
        return Math.random() * 20; // 0-20分
      },
    },
  ];
  
  private knownDevices = new Set<string>();
  private suspiciousIPs = new Set<string>();
  
  calculateRiskScore(context: SecurityContext): RiskAssessment {
    let totalScore = 0;
    const factorScores: Record<string, number> = {};
    
    for (const factor of this.factors) {
      const score = factor.calculate(context);
      factorScores[factor.name] = score;
      totalScore += score * factor.weight;
    }
    
    // 确保分数在0-100范围内
    totalScore = Math.min(100, Math.max(0, totalScore));
    
    let riskLevel: 'low' | 'medium' | 'high' | 'critical';
    if (totalScore < 20) riskLevel = 'low';
    else if (totalScore < 50) riskLevel = 'medium';
    else if (totalScore < 80) riskLevel = 'high';
    else riskLevel = 'critical';
    
    const now = new Date();
    
    return {
      contextId: context.userId,
      riskScore: Math.round(totalScore),
      riskLevel: riskLevel,
      factors: Object.entries(factorScores).map(([name, score]) => ({
        factor: name,
        weight: this.factors.find(f => f.name === name)?.weight || 0,
        score: score,
        description: `Risk factor: ${name}`
      })),
      recommendations: this.generateRecommendations(riskLevel, factorScores),
      timestamp: now,
      expiresAt: new Date(now.getTime() + 5 * 60 * 1000), // 5分钟后过期
    };
  }
  
  private isKnownDevice(fingerprint: string): boolean {
    return this.knownDevices.has(fingerprint);
  }
  
  private isSuspiciousIP(ip?: string): boolean {
    if (!ip) return false;
    return this.suspiciousIPs.has(ip);
  }
  
  private generateRecommendations(
    riskLevel: string, 
    factors: Record<string, number>
  ): string[] {
    const recommendations: string[] = [];
    
    if (riskLevel === 'high' || riskLevel === 'critical') {
      recommendations.push('Require multi-factor authentication');
      recommendations.push('Limit session duration');
    }
    
    if (factors.location_anomaly > 20) {
      recommendations.push('Verify user location');
    }
    
    if (factors.device_trust > 30) {
      recommendations.push('Require device verification');
    }
    
    if (factors.behavioral_anomaly > 20) {
      recommendations.push('Monitor user behavior closely');
    }
    
    return recommendations;
  }
  
  addKnownDevice(fingerprint: string): void {
    this.knownDevices.add(fingerprint);
  }
  
  addSuspiciousIP(ip: string): void {
    this.suspiciousIPs.add(ip);
  }
}

// ============================================================================
// 零信任服务
// ============================================================================

@Injectable()
export class ZeroTrustService implements OnModuleInit {
  private readonly logger = new Logger(ZeroTrustService.name);
  
  private policies: Map<string, ZeroTrustPolicy> = new Map();
  private riskEngine: RiskAssessmentEngine;
  private enabled: boolean;
  
  // 会话管理
  private activeSessions: Map<string, {
    userId: string;
    startTime: Date;
    lastActivity: Date;
    riskScore: number;
    challenges: string[];
  }> = new Map();
  
  // 统计信息
  private stats = {
    totalRequests: 0,
    allowedRequests: 0,
    deniedRequests: 0,
    challengedRequests: 0,
    averageRiskScore: 0,
    policyViolations: 0,
  };

  constructor(
    private eventEmitter: EventEmitter2,
  ) {
    this.enabled = getBooleanEnvVar('ZERO_TRUST_ENABLED', true);
    this.riskEngine = new RiskAssessmentEngine();
  }

  async onModuleInit() {
    if (this.enabled) {
      await this.initialize();
    }
  }

  /**
   * 初始化服务
   */
  public async initialize(): Promise<void> {
    this.logger.log('Initializing Zero Trust service...');
    
    // 加载默认策略
    await this.loadDefaultPolicies();
    
    // 启动会话清理任务
    this.startSessionCleanup();
    
    // 启动威胁检测
    this.startThreatDetection();
    
    this.logger.log(`Zero Trust service initialized with ${this.policies.size} policies`);
  }

  /**
   * 加载默认策略
   */
  public async loadDefaultPolicies(): Promise<void> {
    const defaultPolicies: Partial<ZeroTrustPolicy>[] = [
      {
        name: 'High Risk Access Control',
        description: 'Deny access for high risk requests',
        priority: 90,
        conditions: {
          riskLevels: ['high', 'critical'],
        },
        access: {
          action: 'deny',
        },
      },
      {
        name: 'Medium Risk Challenge',
        description: 'Challenge medium risk requests',
        priority: 70,
        conditions: {
          riskLevels: ['medium'],
        },
        access: {
          action: 'challenge',
          challenges: ['mfa'],
        },
      },
      {
        name: 'Admin Resource Protection',
        description: 'Extra protection for admin resources',
        priority: 80,
        conditions: {
          userRoles: ['admin', 'super_admin'],
        },
        access: {
          action: 'challenge',
          challenges: ['mfa', 'biometric'],
          sessionLimits: {
            maxDuration: 3600, // 1小时
            maxIdleTime: 900,   // 15分钟
          },
        },
      },
      {
        name: 'Off-Hours Access',
        description: 'Restrict access during off-hours',
        priority: 60,
        conditions: {
          timeRanges: [{
            start: '18:00',
            end: '09:00',
            days: [0, 1, 2, 3, 4, 5, 6], // 所有天
          }],
        },
        access: {
          action: 'challenge',
          challenges: ['mfa'],
        },
      },
    ];
    
    for (const policyData of defaultPolicies) {
      const policy = ZeroTrustPolicySchema.parse({
        id: crypto.randomUUID(),
        ...policyData,
      });
      
      this.policies.set(policy.id, policy);
    }
  }

  /**
   * 评估访问请求
   */
  async evaluateAccess(request: AccessRequest): Promise<AccessDecision> {
    try {
      this.stats.totalRequests++;
      
      this.logger.debug(`Evaluating access request for user ${request.userId}`);
      
      // 构建安全上下文
      const securityContext: SecurityContext = {
        userId: request.userId,
        sessionId: request.sessionId,
        ipAddress: request.context.ipAddress || '',
        userAgent: request.context.userAgent || '',
        deviceFingerprint: request.context.device?.fingerprint,
        location: request.context.location ? {
          country: request.context.location.country || '',
          region: request.context.location.region || '',
          city: request.context.location.city || '',
        } : undefined,
        riskScore: 0, // 初始风险分数，将在风险评估中计算
        permissions: [], // 从用户权限中获取
        metadata: {},
      };
      
      // 风险评估
      const riskAssessment = this.riskEngine.calculateRiskScore(securityContext);
      
      // 更新平均风险分数
      this.updateAverageRiskScore(riskAssessment.riskScore);
      
      // 匹配策略
      const matchedPolicies = this.matchPolicies(request, riskAssessment);
      
      // 做出访问决策
      const decision = this.makeAccessDecision(
        request, 
        riskAssessment, 
        matchedPolicies
      );
      
      // 更新统计
      this.updateStats(decision.decision);
      
      // 记录会话
      if (decision.decision === 'allow') {
        this.recordSession(request, riskAssessment.riskScore, decision.requiredChallenges || []);
      }
      
      // 发送事件
      this.eventEmitter.emit('zero-trust.access.evaluated', {
        request,
        decision,
        riskAssessment,
        matchedPolicies: matchedPolicies.map(p => p.id),
      });
      
      // 记录审计日志
      if (decision.decision === 'deny' || riskAssessment.riskLevel === 'high') {
        this.eventEmitter.emit('security.audit', {
          type: 'access_control',
          userId: request.userId,
          resource: request.resource,
          decision: decision.decision,
          riskScore: riskAssessment.riskScore,
          reason: decision.reason,
          timestamp: new Date(),
        });
      }
      
      return decision;
    } catch (error) {
      this.logger.error('Failed to evaluate access request', error);
      
      // 默认拒绝策略
      return {
        decision: 'deny',
        reason: 'Internal security evaluation error',
        riskScore: 100,
        appliedPolicies: [],
      };
    }
  }

  /**
   * 匹配适用的策略
   */
  private matchPolicies(
    request: AccessRequest, 
    riskAssessment: RiskAssessment
  ): ZeroTrustPolicy[] {
    const matchedPolicies: ZeroTrustPolicy[] = [];
    
    for (const policy of this.policies.values()) {
      if (!policy.enabled) continue;
      
      if (this.policyMatches(policy, request, riskAssessment)) {
        matchedPolicies.push(policy);
      }
    }
    
    // 按优先级排序
    return matchedPolicies.sort((a, b) => b.priority - a.priority);
  }

  /**
   * 检查策略是否匹配
   */
  private policyMatches(
    policy: ZeroTrustPolicy,
    request: AccessRequest,
    riskAssessment: RiskAssessment
  ): boolean {
    const conditions = policy.conditions;
    
    // 检查风险级别
    if (conditions.riskLevels && 
        !conditions.riskLevels.includes(riskAssessment.riskLevel)) {
      return false;
    }
    
    // 检查设备类型
    if (conditions.deviceTypes && request.context.device &&
        !conditions.deviceTypes.includes(request.context.device.type)) {
      return false;
    }
    
    // 检查时间范围
    if (conditions.timeRanges && 
        !this.isWithinTimeRange(conditions.timeRanges)) {
      return false;
    }
    
    // 检查IP范围
    if (conditions.ipRanges && request.context.ipAddress &&
        !this.isWithinIPRange(request.context.ipAddress, conditions.ipRanges)) {
      return false;
    }
    
    // 其他条件检查...
    
    return true;
  }

  /**
   * 检查是否在时间范围内
   */
  private isWithinTimeRange(timeRanges: any[]): boolean {
    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    for (const range of timeRanges) {
      if (range.days.includes(currentDay)) {
        // 简化的时间比较
        if (currentTime >= range.start && currentTime <= range.end) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * 检查是否在IP范围内
   */
  private isWithinIPRange(ip: string, ranges: string[]): boolean {
    // 简化实现，实际应该支持CIDR等格式
    return ranges.includes(ip);
  }

  /**
   * 做出访问决策
   */
  private makeAccessDecision(
    request: AccessRequest,
    riskAssessment: RiskAssessment,
    matchedPolicies: ZeroTrustPolicy[]
  ): AccessDecision {
    // 如果没有匹配的策略，使用默认策略
    if (matchedPolicies.length === 0) {
      return {
        decision: riskAssessment.riskLevel === 'critical' ? 'deny' : 'allow',
        reason: 'Default policy applied',
        riskScore: riskAssessment.riskScore,
        appliedPolicies: [],
        requiredChallenges: [],
        sessionLimits: {
          maxDuration: 3600,
          maxIdleTime: 1800,
          maxConcurrentSessions: 5,
        },
        metadata: {
          riskFactors: riskAssessment.factors,
          recommendations: riskAssessment.recommendations,
        },
      };
    }
    
    // 使用最高优先级的策略
    const primaryPolicy = matchedPolicies[0];
    const decision = primaryPolicy.access.action;
    
    let reason = `Policy "${primaryPolicy.name}" applied`;
    if (matchedPolicies.length > 1) {
      reason += ` (${matchedPolicies.length} policies matched)`;
    }
    
    const result: AccessDecision = {
      decision,
      reason,
      riskScore: riskAssessment.riskScore,
      appliedPolicies: matchedPolicies.map(p => p.id),
      requiredChallenges: [],
      sessionLimits: {
        maxDuration: 3600,
        maxIdleTime: 1800,
        maxConcurrentSessions: 5,
      },
      metadata: {
        riskFactors: riskAssessment.factors,
        recommendations: riskAssessment.recommendations,
      },
    };
    
    // 添加挑战要求
    if (decision === 'challenge' && primaryPolicy.access.challenges) {
      result.requiredChallenges = primaryPolicy.access.challenges;
    }
    
    // 添加会话限制
    if (primaryPolicy.access.sessionLimits) {
      result.sessionLimits = {
        ...result.sessionLimits,
        ...primaryPolicy.access.sessionLimits,
      };
    }
    
    return result;
  }

  /**
   * 记录会话
   */
  private recordSession(
    request: AccessRequest, 
    riskScore: number, 
    challenges: string[]
  ): void {
    this.activeSessions.set(request.sessionId, {
      userId: request.userId,
      startTime: new Date(),
      lastActivity: new Date(),
      riskScore,
      challenges,
    });
  }

  /**
   * 更新会话活动
   */
  updateSessionActivity(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.lastActivity = new Date();
    }
  }

  /**
   * 启动会话清理任务
   */
  private startSessionCleanup(): void {
    setInterval(() => {
      const now = new Date();
      const expiredSessions: string[] = [];
      
      for (const [sessionId, session] of this.activeSessions) {
        const idleTime = now.getTime() - session.lastActivity.getTime();
        const maxIdleTime = getNumberEnvVar('SESSION_MAX_IDLE_TIME', 1800000); // 30分钟
        
        if (idleTime > maxIdleTime) {
          expiredSessions.push(sessionId);
        }
      }
      
      for (const sessionId of expiredSessions) {
        this.activeSessions.delete(sessionId);
        
        this.eventEmitter.emit('zero-trust.session.expired', {
          sessionId,
          timestamp: now,
        });
      }
      
      if (expiredSessions.length > 0) {
        this.logger.debug(`Cleaned up ${expiredSessions.length} expired sessions`);
      }
    }, 300000); // 每5分钟检查一次
  }

  /**
   * 启动威胁检测
   */
  private startThreatDetection(): void {
    // 监听安全事件
    this.eventEmitter.on('security.threat.detected', (event: ThreatEvent) => {
      this.handleThreatEvent(event);
    });
    
    // 定期分析威胁模式
    setInterval(() => {
      this.analyzeThreatPatterns();
    }, 600000); // 每10分钟分析一次
  }

  /**
   * 处理威胁事件
   */
  private handleThreatEvent(event: ThreatEvent): void {
    this.logger.warn(`Threat detected: ${event.type}`, event);
    
    // 根据威胁类型采取行动
    switch (event.severity) {
      case 'critical':
        // 立即阻止相关IP或用户
        // 由于ThreatEvent.source是string类型，我们需要解析它来获取IP地址
        try {
          const sourceData = JSON.parse(event.source);
          if (sourceData.ipAddress) {
            this.riskEngine.addSuspiciousIP(sourceData.ipAddress);
          }
        } catch {
          // 如果source不是JSON，直接作为IP地址处理
          if (event.source && /^\d+\.\d+\.\d+\.\d+$/.test(event.source)) {
            this.riskEngine.addSuspiciousIP(event.source);
          }
        }
        break;
      
      case 'high':
        // 增加监控
        this.stats.policyViolations++;
        break;
    }
    
    // 发送告警
    this.eventEmitter.emit('security.alert', {
      type: 'threat_detected',
      severity: event.severity,
      description: event.description,
      source: event.source,
      timestamp: new Date(),
    });
  }

  /**
   * 分析威胁模式
   */
  private analyzeThreatPatterns(): void {
    // 分析访问模式，检测异常
    // 这里是简化实现，实际应该使用机器学习算法
    
    const recentRequests = this.stats.totalRequests;
    const deniedRate = this.stats.deniedRequests / recentRequests;
    
    if (deniedRate > 0.1) { // 拒绝率超过10%
      this.eventEmitter.emit('security.threat.detected', {
        type: 'high_denial_rate',
        severity: 'medium',
        description: `High denial rate detected: ${(deniedRate * 100).toFixed(1)}%`,
        source: { type: 'system' },
        timestamp: new Date(),
        metadata: {
          denialRate: deniedRate,
          totalRequests: recentRequests,
        },
      });
    }
  }

  /**
   * 更新统计信息
   */
  private updateStats(decision: string): void {
    switch (decision) {
      case 'allow':
        this.stats.allowedRequests++;
        break;
      case 'deny':
        this.stats.deniedRequests++;
        break;
      case 'challenge':
        this.stats.challengedRequests++;
        break;
    }
  }

  /**
   * 更新平均风险分数
   */
  private updateAverageRiskScore(riskScore: number): void {
    const totalScore = this.stats.averageRiskScore * (this.stats.totalRequests - 1) + riskScore;
    this.stats.averageRiskScore = totalScore / this.stats.totalRequests;
  }

  /**
   * 添加策略
   */
  async addPolicy(policyData: Partial<ZeroTrustPolicy>): Promise<ZeroTrustPolicy> {
    const policy = ZeroTrustPolicySchema.parse({
      id: crypto.randomUUID(),
      ...policyData,
    });
    
    this.policies.set(policy.id, policy);
    
    this.eventEmitter.emit('zero-trust.policy.added', { policy });
    this.logger.log(`Added zero trust policy: ${policy.name}`);
    
    return policy;
  }

  /**
   * 更新策略
   */
  async updatePolicy(id: string, updates: Partial<ZeroTrustPolicy>): Promise<ZeroTrustPolicy> {
    const existingPolicy = this.policies.get(id);
    if (!existingPolicy) {
      throw new Error(`Policy ${id} not found`);
    }
    
    const updatedPolicy = ZeroTrustPolicySchema.parse({
      ...existingPolicy,
      ...updates,
      id,
      updatedAt: new Date(),
    });
    
    this.policies.set(id, updatedPolicy);
    
    this.eventEmitter.emit('zero-trust.policy.updated', { 
      policy: updatedPolicy,
      changes: updates,
    });
    
    this.logger.log(`Updated zero trust policy: ${updatedPolicy.name}`);
    
    return updatedPolicy;
  }

  /**
   * 删除策略
   */
  async deletePolicy(id: string): Promise<void> {
    const policy = this.policies.get(id);
    if (!policy) {
      throw new Error(`Policy ${id} not found`);
    }
    
    this.policies.delete(id);
    
    this.eventEmitter.emit('zero-trust.policy.deleted', { policyId: id });
    this.logger.log(`Deleted zero trust policy: ${policy.name}`);
  }

  /**
   * 获取所有策略
   */
  getPolicies(): ZeroTrustPolicy[] {
    return Array.from(this.policies.values());
  }

  /**
   * 获取策略
   */
  getPolicy(id: string): ZeroTrustPolicy | undefined {
    return this.policies.get(id);
  }

  /**
   * 获取活跃会话
   */
  getActiveSessions(): Array<{ sessionId: string; userId: string; startTime: Date; lastActivity: Date; riskScore: number }> {
    return Array.from(this.activeSessions.entries()).map(([sessionId, session]) => ({
      sessionId,
      ...session,
    }));
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      ...this.stats,
      allowRate: this.stats.totalRequests > 0 
        ? this.stats.allowedRequests / this.stats.totalRequests 
        : 0,
      denyRate: this.stats.totalRequests > 0 
        ? this.stats.deniedRequests / this.stats.totalRequests 
        : 0,
      challengeRate: this.stats.totalRequests > 0 
        ? this.stats.challengedRequests / this.stats.totalRequests 
        : 0,
      activeSessions: this.activeSessions.size,
      policiesCount: this.policies.size,
    };
  }

  /**
   * 获取服务状态
   */
  getStatus() {
    return {
      enabled: this.enabled,
      policiesCount: this.policies.size,
      activeSessions: this.activeSessions.size,
      stats: this.getStats(),
    };
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      allowedRequests: 0,
      deniedRequests: 0,
      challengedRequests: 0,
      averageRiskScore: 0,
      policyViolations: 0,
    };
    
    this.logger.log('Zero trust stats reset');
  }
}