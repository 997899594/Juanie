/**
 * 🚀 Juanie AI - 零信任安全守卫
 * 实现动态访问控制和持续验证
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { z } from 'zod';
import { ZeroTrustService } from '../zero-trust.service';
import { AuthService, JwtPayload } from '../auth.service';

// ============================================================================
// 装饰器元数据
// ============================================================================

export const ZERO_TRUST_KEY = 'zero-trust';
export const RESOURCE_KEY = 'resource';
export const ACTION_KEY = 'action';
export const RISK_LEVEL_KEY = 'risk-level';

export interface ZeroTrustOptions {
  resource: string;
  action: string;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  requireMFA?: boolean;
  allowedRoles?: string[];
  allowedPermissions?: string[];
  deviceTrustRequired?: boolean;
  locationRestricted?: boolean;
  timeRestricted?: {
    startHour: number;
    endHour: number;
    timezone?: string;
  };
  rateLimiting?: {
    maxRequests: number;
    windowMs: number;
  };
}

// 装饰器
export const ZeroTrust = (options: ZeroTrustOptions) => {
  return (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
    if (propertyKey && descriptor) {
      // 方法装饰器
      Reflect.defineMetadata(ZERO_TRUST_KEY, options, descriptor.value);
    } else {
      // 类装饰器
      Reflect.defineMetadata(ZERO_TRUST_KEY, options, target);
    }
  };
};

export const Resource = (resource: string) => {
  return (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
    const metadata = propertyKey && descriptor ? descriptor.value : target;
    Reflect.defineMetadata(RESOURCE_KEY, resource, metadata);
  };
};

export const Action = (action: string) => {
  return (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
    const metadata = propertyKey && descriptor ? descriptor.value : target;
    Reflect.defineMetadata(ACTION_KEY, action, metadata);
  };
};

export const RiskLevel = (level: 'low' | 'medium' | 'high' | 'critical') => {
  return (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
    const metadata = propertyKey && descriptor ? descriptor.value : target;
    Reflect.defineMetadata(RISK_LEVEL_KEY, level, metadata);
  };
};

// ============================================================================
// 扩展Request接口
// ============================================================================

interface AuthenticatedRequest extends Request {
  user?: any;
  sessionId?: string;
  deviceFingerprint?: string;
  riskScore?: number;
  accessDecision?: {
    decision: 'allow' | 'deny' | 'challenge';
    reason: string;
    riskScore: number;
    appliedPolicies: string[];
    requiredChallenges?: string[];
    sessionLimits?: {
      maxDuration?: number;
      maxIdleTime?: number;
      maxConcurrentSessions?: number;
    };
    metadata?: Record<string, any>;
  };
}

// ============================================================================
// 零信任守卫
// ============================================================================

@Injectable()
export class ZeroTrustGuard implements CanActivate {
  private readonly logger = new Logger(ZeroTrustGuard.name);
  
  // 请求计数器（用于速率限制）
  private requestCounts = new Map<string, {
    count: number;
    resetTime: number;
  }>();
  
  // 设备信任缓存
  private deviceTrustCache = new Map<string, {
    trusted: boolean;
    expiresAt: number;
  }>();

  constructor(
    private reflector: Reflector,
    private zeroTrustService: ZeroTrustService,
    private authService: AuthService,
  ) {
    // 定期清理缓存
    setInterval(() => this.cleanupCaches(), 300000); // 5分钟
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const handler = context.getHandler();
    const controller = context.getClass();
    
    try {
      // 获取零信任配置
      const options = this.getZeroTrustOptions(handler, controller);
      if (!options) {
        // 如果没有配置零信任，允许通过
        return true;
      }
      
      this.logger.debug(`Zero trust evaluation for ${options.resource}:${options.action}`);
      
      // 1. 基础认证检查
      const user = await this.validateAuthentication(request);
      request.user = user;
      
      // 2. 角色和权限检查
      this.validateRoleAndPermissions(user, options);
      
      // 3. 速率限制检查
      if (options.rateLimiting) {
        this.validateRateLimit(request, options.rateLimiting);
      }
      
      // 4. 时间限制检查
      if (options.timeRestricted) {
        this.validateTimeRestriction(options.timeRestricted);
      }
      
      // 5. 设备信任检查
      if (options.deviceTrustRequired) {
        await this.validateDeviceTrust(request);
      }
      
      // 6. 零信任策略评估
      const accessDecision = await this.evaluateZeroTrustPolicy(request, options);
      // 类型断言确保 accessDecision 符合接口要求
      request.accessDecision = accessDecision as {
        decision: 'allow' | 'deny' | 'challenge';
        reason: string;
        riskScore: number;
        appliedPolicies: string[];
        requiredChallenges?: string[];
        sessionLimits?: {
          maxDuration?: number;
          maxIdleTime?: number;
          maxConcurrentSessions?: number;
        };
        metadata?: Record<string, any>;
      };
      
      // 7. 处理访问决策
      return this.handleAccessDecision(accessDecision, request, options);
      
    } catch (error) {
      this.logger.error('Zero trust guard failed', error);
      
      if (error instanceof UnauthorizedException || 
          error instanceof ForbiddenException) {
        throw error;
      }
      
      // 默认拒绝访问
      throw new ForbiddenException('Access denied by security policy');
    }
  }

  /**
   * 获取零信任配置
   */
  private getZeroTrustOptions(
    handler: Function,
    controller: Function
  ): ZeroTrustOptions | null {
    // 优先使用方法级配置
    let options = this.reflector.get<ZeroTrustOptions>(ZERO_TRUST_KEY, handler);
    
    if (!options) {
      // 使用类级配置
      options = this.reflector.get<ZeroTrustOptions>(ZERO_TRUST_KEY, controller);
    }
    
    if (!options) {
      // 尝试从单独的装饰器构建配置
      const resource = this.reflector.get<string>(RESOURCE_KEY, handler) ||
                      this.reflector.get<string>(RESOURCE_KEY, controller);
      const action = this.reflector.get<string>(ACTION_KEY, handler) ||
                    this.reflector.get<string>(ACTION_KEY, controller);
      const riskLevel = this.reflector.get<string>(RISK_LEVEL_KEY, handler) ||
                       this.reflector.get<string>(RISK_LEVEL_KEY, controller);
      
      if (resource && action) {
        options = {
          resource,
          action,
          riskLevel: riskLevel as any,
        };
      }
    }
    
    return options;
  }

  /**
   * 验证认证状态
   */
  private async validateAuthentication(request: AuthenticatedRequest): Promise<JwtPayload> {
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }
    
    const token = authHeader.substring(7);
    
    try {
      const payload = await this.authService.validateToken(token);
      
      // 提取会话和设备信息
      request.sessionId = payload.sessionId;
      request.deviceFingerprint = payload.deviceFingerprint;
      
      return payload;
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  /**
   * 验证角色和权限
   */
  private validateRoleAndPermissions(user: JwtPayload, options: ZeroTrustOptions): void {
    // 检查角色
    if (options.allowedRoles && options.allowedRoles.length > 0) {
      const hasRole = options.allowedRoles.some(role => user.roles.includes(role));
      if (!hasRole) {
        throw new ForbiddenException('Insufficient role privileges');
      }
    }
    
    // 检查权限
    if (options.allowedPermissions && options.allowedPermissions.length > 0) {
      const hasPermission = options.allowedPermissions.some(permission => 
        user.permissions.includes(permission)
      );
      if (!hasPermission) {
        throw new ForbiddenException('Insufficient permissions');
      }
    }
  }

  /**
   * 验证速率限制
   */
  private validateRateLimit(
    request: AuthenticatedRequest,
    rateLimiting: { maxRequests: number; windowMs: number }
  ): void {
    const key = `${request.user!.sub}:${request.ip}`;
    const now = Date.now();
    const windowStart = now - rateLimiting.windowMs;
    
    let requestData = this.requestCounts.get(key);
    
    if (!requestData || requestData.resetTime < windowStart) {
      // 重置计数器
      requestData = {
        count: 1,
        resetTime: now + rateLimiting.windowMs,
      };
    } else {
      requestData.count++;
    }
    
    this.requestCounts.set(key, requestData);
    
    if (requestData.count > rateLimiting.maxRequests) {
      throw new ForbiddenException('Rate limit exceeded');
    }
  }

  /**
   * 验证时间限制
   */
  private validateTimeRestriction(timeRestricted: {
    startHour: number;
    endHour: number;
    timezone?: string;
  }): void {
    const now = new Date();
    const currentHour = now.getHours();
    
    // 简化实现，不考虑时区
    if (currentHour < timeRestricted.startHour || 
        currentHour >= timeRestricted.endHour) {
      throw new ForbiddenException('Access not allowed at this time');
    }
  }

  /**
   * 验证设备信任
   */
  private async validateDeviceTrust(request: AuthenticatedRequest): Promise<void> {
    const deviceFingerprint = request.deviceFingerprint;
    
    if (!deviceFingerprint) {
      throw new ForbiddenException('Device fingerprint required');
    }
    
    // 检查缓存
    const cached = this.deviceTrustCache.get(deviceFingerprint);
    if (cached && cached.expiresAt > Date.now()) {
      if (!cached.trusted) {
        throw new ForbiddenException('Device not trusted');
      }
      return;
    }
    
    // 设备信任评估（简化实现）
    const trusted = await this.evaluateDeviceTrust(request);
    
    // 缓存结果
    this.deviceTrustCache.set(deviceFingerprint, {
      trusted,
      expiresAt: Date.now() + 3600000, // 1小时
    });
    
    if (!trusted) {
      throw new ForbiddenException('Device not trusted');
    }
  }

  /**
   * 评估设备信任
   */
  private async evaluateDeviceTrust(request: AuthenticatedRequest): Promise<boolean> {
    // 简化的设备信任评估
    const factors = {
      knownDevice: !!request.deviceFingerprint,
      secureConnection: request.secure || request.headers['x-forwarded-proto'] === 'https',
      validUserAgent: !!request.headers['user-agent'],
      noSuspiciousHeaders: !this.hasSuspiciousHeaders(request),
    };
    
    const trustScore = Object.values(factors).filter(Boolean).length / Object.keys(factors).length;
    
    return trustScore >= 0.75; // 75%的信任分数
  }

  /**
   * 检查可疑请求头
   */
  private hasSuspiciousHeaders(request: AuthenticatedRequest): boolean {
    const suspiciousHeaders = [
      'x-forwarded-for',
      'x-real-ip',
      'x-cluster-client-ip',
    ];
    
    // 简化检查：如果有多个代理头，可能是可疑的
    const proxyHeaders = suspiciousHeaders.filter(header => 
      request.headers[header]
    );
    
    return proxyHeaders.length > 1;
  }

  /**
   * 评估零信任策略
   */
  private async evaluateZeroTrustPolicy(
    request: AuthenticatedRequest,
    options: ZeroTrustOptions
  ) {
    const accessRequest = {
      userId: request.user!.sub,
      sessionId: request.sessionId!,
      resource: options.resource,
      action: options.action,
      context: {
        userAgent: request.headers['user-agent'],
        ipAddress: request.ip,
        method: request.method,
        path: request.path,
        deviceFingerprint: request.deviceFingerprint,
        riskLevel: options.riskLevel,
        timestamp: new Date(),
        headers: this.sanitizeHeaders(request.headers),
      },
    };
    
    return await this.zeroTrustService.evaluateAccess(accessRequest);
  }

  /**
   * 处理访问决策
   */
  private handleAccessDecision(
    decision: any,
    request: AuthenticatedRequest,
    options: ZeroTrustOptions
  ): boolean {
    request.riskScore = decision.riskScore;
    
    switch (decision.decision) {
      case 'allow':
        this.logger.debug(`Access allowed for ${options.resource}:${options.action}`);
        return true;
        
      case 'deny':
        this.logger.warn(`Access denied for ${options.resource}:${options.action}: ${decision.reason}`);
        throw new ForbiddenException(decision.reason);
        
      case 'challenge':
        this.logger.warn(`Access challenge required for ${options.resource}:${options.action}`);
        
        // 如果需要MFA但没有配置，拒绝访问
        if (decision.requiredChallenges?.includes('mfa') && !options.requireMFA) {
          throw new ForbiddenException('Multi-factor authentication required');
        }
        
        // 其他挑战类型的处理
        if (decision.requiredChallenges?.includes('device_verification')) {
          throw new ForbiddenException('Device verification required');
        }
        
        if (decision.requiredChallenges?.includes('location_verification')) {
          throw new ForbiddenException('Location verification required');
        }
        
        // 默认拒绝未知的挑战类型
        throw new ForbiddenException('Additional verification required');
        
      default:
        throw new ForbiddenException('Access denied by security policy');
    }
  }

  /**
   * 清理请求头（移除敏感信息）
   */
  private sanitizeHeaders(headers: any): Record<string, string> {
    const sanitized: Record<string, string> = {};
    const allowedHeaders = [
      'user-agent',
      'accept',
      'accept-language',
      'accept-encoding',
      'content-type',
      'origin',
      'referer',
    ];
    
    for (const header of allowedHeaders) {
      if (headers[header]) {
        sanitized[header] = headers[header];
      }
    }
    
    return sanitized;
  }

  /**
   * 清理缓存
   */
  private cleanupCaches(): void {
    const now = Date.now();
    
    // 清理请求计数缓存
    for (const [key, data] of this.requestCounts) {
      if (data.resetTime < now) {
        this.requestCounts.delete(key);
      }
    }
    
    // 清理设备信任缓存
    for (const [key, data] of this.deviceTrustCache) {
      if (data.expiresAt < now) {
        this.deviceTrustCache.delete(key);
      }
    }
    
    this.logger.debug('Caches cleaned up');
  }

  /**
   * 获取守卫统计信息
   */
  getStats() {
    return {
      activeRequestCounts: this.requestCounts.size,
      deviceTrustCacheSize: this.deviceTrustCache.size,
      trustedDevices: Array.from(this.deviceTrustCache.values())
        .filter(d => d.trusted).length,
    };
  }
}