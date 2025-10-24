import { Injectable, Logger, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { z } from 'zod';
import { performance } from 'perf_hooks';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';

// 安全上下文Schema
export const SecurityContextSchema = z.object({
  userId: z.string(),
  sessionId: z.string(),
  deviceId: z.string(),
  ipAddress: z.string(),
  userAgent: z.string(),
  location: z.object({
    country: z.string().optional(),
    city: z.string().optional(),
    coordinates: z.tuple([z.number(), z.number()]).optional(),
  }).optional(),
  timestamp: z.date(),
  riskScore: z.number().min(0).max(1),
  trustLevel: z.enum(['untrusted', 'low', 'medium', 'high', 'verified']),
  permissions: z.array(z.string()),
  metadata: z.record(z.any()).optional(),
});

export type SecurityContext = z.infer<typeof SecurityContextSchema>;

// 风险评估结果Schema
export const RiskAssessmentSchema = z.object({
  contextId: z.string(),
  riskScore: z.number().min(0).max(1),
  riskFactors: z.array(z.object({
    factor: z.string(),
    weight: z.number(),
    description: z.string(),
  })),
  recommendations: z.array(z.string()),
  requiresAdditionalAuth: z.boolean(),
  allowAccess: z.boolean(),
  expiresAt: z.date(),
  assessedAt: z.date(),
});

export type RiskAssessment = z.infer<typeof RiskAssessmentSchema>;

// 威胁检测事件Schema
export const ThreatEventSchema = z.object({
  id: z.string(),
  type: z.enum([
    'suspicious_login',
    'unusual_location',
    'device_anomaly',
    'behavior_anomaly',
    'brute_force_attempt',
    'privilege_escalation',
    'data_exfiltration',
    'malicious_payload',
  ]),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  deviceId: z.string().optional(),
  ipAddress: z.string(),
  description: z.string(),
  evidence: z.record(z.any()),
  mitigationActions: z.array(z.string()),
  detectedAt: z.date(),
  resolvedAt: z.date().optional(),
  status: z.enum(['active', 'investigating', 'mitigated', 'false_positive']),
});

export type ThreatEvent = z.infer<typeof ThreatEventSchema>;

// 设备指纹接口
export interface DeviceFingerprint {
  deviceId: string;
  userAgent: string;
  screenResolution: string;
  timezone: string;
  language: string;
  platform: string;
  plugins: string[];
  canvas: string;
  webgl: string;
  audioContext: string;
  hash: string;
}

// 行为分析接口
export interface BehaviorPattern {
  userId: string;
  patterns: {
    loginTimes: number[];
    locations: string[];
    devices: string[];
    apiUsage: Record<string, number>;
    navigationPatterns: string[];
  };
  baseline: {
    averageSessionDuration: number;
    typicalLocations: string[];
    preferredDevices: string[];
    usageFrequency: Record<string, number>;
  };
  lastUpdated: Date;
}

// AI威胁检测引擎
@Injectable()
export class AIThreatDetector {
  private readonly logger = new Logger(AIThreatDetector.name);
  private behaviorBaselines = new Map<string, BehaviorPattern>();
  private deviceProfiles = new Map<string, DeviceFingerprint>();
  private threatRules: Array<(context: SecurityContext) => Promise<ThreatEvent | null>> = [];

  constructor(
    private configService: ConfigService,
    private eventEmitter: EventEmitter2,
  ) {
    this.initializeThreatRules();
  }

  private initializeThreatRules(): void {
    // 异常登录检测
    this.threatRules.push(async (context) => {
      const baseline = this.behaviorBaselines.get(context.userId);
      if (!baseline) return null;

      const currentHour = new Date().getHours();
      const typicalHours = baseline.patterns.loginTimes;
      
      if (typicalHours.length > 0 && !typicalHours.includes(currentHour)) {
        return {
          id: crypto.randomUUID(),
          type: 'suspicious_login',
          severity: 'medium',
          userId: context.userId,
          sessionId: context.sessionId,
          ipAddress: context.ipAddress,
          description: `Login at unusual time: ${currentHour}:00`,
          evidence: { currentHour, typicalHours },
          mitigationActions: ['require_mfa', 'monitor_session'],
          detectedAt: new Date(),
          status: 'active',
        };
      }

      return null;
    });

    // 异常位置检测
    this.threatRules.push(async (context) => {
      if (!context.location) return null;

      const baseline = this.behaviorBaselines.get(context.userId);
      if (!baseline) return null;

      const currentLocation = `${context.location.country}-${context.location.city}`;
      const typicalLocations = baseline.patterns.locations;

      if (!typicalLocations.includes(currentLocation)) {
        return {
          id: crypto.randomUUID(),
          type: 'unusual_location',
          severity: 'high',
          userId: context.userId,
          sessionId: context.sessionId,
          ipAddress: context.ipAddress,
          description: `Access from unusual location: ${currentLocation}`,
          evidence: { currentLocation, typicalLocations },
          mitigationActions: ['require_mfa', 'verify_identity', 'limit_permissions'],
          detectedAt: new Date(),
          status: 'active',
        };
      }

      return null;
    });

    // 设备异常检测
    this.threatRules.push(async (context) => {
      const deviceProfile = this.deviceProfiles.get(context.deviceId);
      if (!deviceProfile) {
        return {
          id: crypto.randomUUID(),
          type: 'device_anomaly',
          severity: 'medium',
          userId: context.userId,
          deviceId: context.deviceId,
          ipAddress: context.ipAddress,
          description: 'Access from unrecognized device',
          evidence: { deviceId: context.deviceId },
          mitigationActions: ['device_registration', 'require_mfa'],
          detectedAt: new Date(),
          status: 'active',
        };
      }

      return null;
    });

    this.logger.log(`Initialized ${this.threatRules.length} threat detection rules`);
  }

  async analyzeContext(context: SecurityContext): Promise<ThreatEvent[]> {
    const threats: ThreatEvent[] = [];

    // 运行所有威胁检测规则
    for (const rule of this.threatRules) {
      try {
        const threat = await rule(context);
        if (threat) {
          threats.push(threat);
        }
      } catch (error) {
        this.logger.error('Threat detection rule failed:', error);
      }
    }

    // 发布威胁事件
    for (const threat of threats) {
      await this.eventEmitter.emitAsync('security.threat.detected', threat);
    }

    return threats;
  }

  async updateBehaviorBaseline(userId: string, activity: any): Promise<void> {
    let baseline = this.behaviorBaselines.get(userId);
    
    if (!baseline) {
      baseline = {
        userId,
        patterns: {
          loginTimes: [],
          locations: [],
          devices: [],
          apiUsage: {},
          navigationPatterns: [],
        },
        baseline: {
          averageSessionDuration: 0,
          typicalLocations: [],
          preferredDevices: [],
          usageFrequency: {},
        },
        lastUpdated: new Date(),
      };
    }

    // 更新行为模式
    if (activity.loginTime) {
      baseline.patterns.loginTimes.push(new Date(activity.loginTime).getHours());
    }
    
    if (activity.location) {
      baseline.patterns.locations.push(activity.location);
    }

    if (activity.deviceId) {
      baseline.patterns.devices.push(activity.deviceId);
    }

    baseline.lastUpdated = new Date();
    this.behaviorBaselines.set(userId, baseline);
  }

  registerDevice(deviceFingerprint: DeviceFingerprint): void {
    this.deviceProfiles.set(deviceFingerprint.deviceId, deviceFingerprint);
    this.logger.debug(`Registered device: ${deviceFingerprint.deviceId}`);
  }
}

// 风险评估引擎
@Injectable()
export class RiskAssessmentEngine {
  private readonly logger = new Logger(RiskAssessmentEngine.name);

  constructor(
    private threatDetector: AIThreatDetector,
    private configService: ConfigService,
  ) {}

  async assessRisk(context: SecurityContext): Promise<RiskAssessment> {
    const startTime = performance.now();
    const contextId = crypto.randomUUID();

    try {
      // 检测威胁
      const threats = await this.threatDetector.analyzeContext(context);
      
      // 计算风险因子
      const riskFactors = await this.calculateRiskFactors(context, threats);
      
      // 计算总体风险分数
      const riskScore = this.calculateOverallRisk(riskFactors);
      
      // 生成建议
      const recommendations = this.generateRecommendations(riskScore, threats);
      
      // 决定是否需要额外认证
      const requiresAdditionalAuth = riskScore > 0.6 || threats.some(t => t.severity === 'high' || t.severity === 'critical');
      
      // 决定是否允许访问
      const allowAccess = riskScore < 0.8 && !threats.some(t => t.severity === 'critical');

      const assessment: RiskAssessment = {
        contextId,
        riskScore,
        riskFactors,
        recommendations,
        requiresAdditionalAuth,
        allowAccess,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15分钟有效期
        assessedAt: new Date(),
      };

      const duration = performance.now() - startTime;
      this.logger.debug(`Risk assessment completed in ${duration.toFixed(2)}ms, score: ${riskScore}`);

      return assessment;
    } catch (error) {
      this.logger.error('Risk assessment failed:', error);
      throw error;
    }
  }

  private async calculateRiskFactors(
    context: SecurityContext, 
    threats: ThreatEvent[]
  ): Promise<RiskAssessment['riskFactors']> {
    const factors: RiskAssessment['riskFactors'] = [];

    // 威胁因子
    for (const threat of threats) {
      const weight = this.getThreatWeight(threat.severity);
      factors.push({
        factor: `threat_${threat.type}`,
        weight,
        description: threat.description,
      });
    }

    // 时间因子
    const hour = new Date().getHours();
    if (hour < 6 || hour > 22) {
      factors.push({
        factor: 'unusual_time',
        weight: 0.2,
        description: 'Access during unusual hours',
      });
    }

    // IP地址因子
    if (this.isHighRiskIP(context.ipAddress)) {
      factors.push({
        factor: 'high_risk_ip',
        weight: 0.4,
        description: 'Access from high-risk IP address',
      });
    }

    // 设备信任因子
    if (context.trustLevel === 'untrusted' || context.trustLevel === 'low') {
      factors.push({
        factor: 'untrusted_device',
        weight: 0.3,
        description: 'Access from untrusted device',
      });
    }

    return factors;
  }

  private calculateOverallRisk(factors: RiskAssessment['riskFactors']): number {
    if (factors.length === 0) return 0.1; // 基础风险

    const totalWeight = factors.reduce((sum, factor) => sum + factor.weight, 0);
    return Math.min(totalWeight, 1.0);
  }

  private generateRecommendations(riskScore: number, threats: ThreatEvent[]): string[] {
    const recommendations: string[] = [];

    if (riskScore > 0.8) {
      recommendations.push('Block access immediately');
      recommendations.push('Require administrator approval');
    } else if (riskScore > 0.6) {
      recommendations.push('Require multi-factor authentication');
      recommendations.push('Limit session duration');
    } else if (riskScore > 0.4) {
      recommendations.push('Monitor session closely');
      recommendations.push('Log all activities');
    }

    // 基于威胁类型的建议
    for (const threat of threats) {
      recommendations.push(...threat.mitigationActions);
    }

    return [...new Set(recommendations)]; // 去重
  }

  private getThreatWeight(severity: ThreatEvent['severity']): number {
    switch (severity) {
      case 'critical': return 0.8;
      case 'high': return 0.6;
      case 'medium': return 0.4;
      case 'low': return 0.2;
      default: return 0.1;
    }
  }

  private isHighRiskIP(ipAddress: string): boolean {
    // TODO: 实现IP风险检查逻辑
    // 可以集成威胁情报数据库
    return false;
  }
}

// 零信任守卫
@Injectable()
export class ZeroTrustGuard implements CanActivate {
  private readonly logger = new Logger(ZeroTrustGuard.name);

  constructor(
    private reflector: Reflector,
    private riskEngine: RiskAssessmentEngine,
    private configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    
    try {
      // 构建安全上下文
      const securityContext = await this.buildSecurityContext(request);
      
      // 进行风险评估
      const assessment = await this.riskEngine.assessRisk(securityContext);
      
      // 将评估结果附加到请求
      request.securityContext = securityContext;
      request.riskAssessment = assessment;

      // 检查是否允许访问
      if (!assessment.allowAccess) {
        this.logger.warn(`Access denied for user ${securityContext.userId}, risk score: ${assessment.riskScore}`);
        return false;
      }

      // 检查是否需要额外认证
      if (assessment.requiresAdditionalAuth) {
        // TODO: 触发额外认证流程
        this.logger.log(`Additional authentication required for user ${securityContext.userId}`);
      }

      return true;
    } catch (error) {
      this.logger.error('Zero trust validation failed:', error);
      return false; // 默认拒绝访问
    }
  }

  private async buildSecurityContext(request: any): Promise<SecurityContext> {
    // 从JWT token获取用户信息
    const token = this.extractToken(request);
    const payload = jwt.decode(token) as any;

    // 获取设备和位置信息
    const deviceId = this.extractDeviceId(request);
    const ipAddress = this.extractIPAddress(request);
    const userAgent = request.headers['user-agent'] || '';
    const location = await this.getLocationFromIP(ipAddress);

    // 计算初始信任级别
    const trustLevel = this.calculateTrustLevel(request);

    return {
      userId: payload.sub,
      sessionId: payload.sessionId || crypto.randomUUID(),
      deviceId,
      ipAddress,
      userAgent,
      location,
      timestamp: new Date(),
      riskScore: 0.1, // 初始风险分数
      trustLevel,
      permissions: payload.permissions || [],
    };
  }

  private extractToken(request: any): string {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('No valid token found');
    }
    return authHeader.substring(7);
  }

  private extractDeviceId(request: any): string {
    // 从请求头或cookie中提取设备ID
    return request.headers['x-device-id'] || 
           request.cookies?.deviceId || 
           crypto.createHash('md5').update(request.headers['user-agent'] || '').digest('hex');
  }

  private extractIPAddress(request: any): string {
    return request.headers['x-forwarded-for']?.split(',')[0] ||
           request.headers['x-real-ip'] ||
           request.connection.remoteAddress ||
           request.socket.remoteAddress ||
           '127.0.0.1';
  }

  private async getLocationFromIP(ipAddress: string): Promise<SecurityContext['location']> {
    // TODO: 实现IP地理位置查询
    // 可以使用免费的GeoIP服务
    return {
      country: 'Unknown',
      city: 'Unknown',
    };
  }

  private calculateTrustLevel(request: any): SecurityContext['trustLevel'] {
    // 基于多个因子计算信任级别
    let score = 0;

    // 检查是否有设备ID
    if (request.headers['x-device-id']) score += 20;
    
    // 检查User-Agent
    if (request.headers['user-agent']) score += 10;
    
    // 检查是否来自已知网络
    const ipAddress = this.extractIPAddress(request);
    if (this.isKnownNetwork(ipAddress)) score += 30;

    // 检查是否有有效的会话
    if (request.cookies?.sessionId) score += 20;

    if (score >= 80) return 'verified';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    if (score >= 20) return 'low';
    return 'untrusted';
  }

  private isKnownNetwork(ipAddress: string): boolean {
    // TODO: 检查是否来自已知的安全网络
    return false;
  }
}

// 零信任装饰器
export const ZeroTrust = () => {
  return (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
    // 可以用于标记需要零信任验证的方法或类
  };
};