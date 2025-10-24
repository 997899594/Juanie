/**
 * 🚀 Juanie AI - tRPC 上下文
 * 集成认证、请求信息和服务依赖
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { Logger } from '@nestjs/common';
import { JwtPayload } from 'jsonwebtoken';

// ============================================================================
// 上下文Schema
// ============================================================================

export const UserContextSchema = z.object({
  sub: z.string(), // 用户ID
  email: z.string().email(),
  organizationId: z.string(),
  roles: z.array(z.string()),
  permissions: z.array(z.string()),
  sessionId: z.string(),
  deviceId: z.string().optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  lastActivity: z.date().optional(),
  preferences: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
});

export const RequestContextSchema = z.object({
  requestId: z.string(),
  timestamp: z.date(),
  method: z.string(),
  url: z.string(),
  headers: z.record(z.string()),
  query: z.record(z.any()).optional(),
  body: z.any().optional(),
  userAgent: z.string().optional(),
  ipAddress: z.string().optional(),
  region: z.string().optional(),
  traceId: z.string().optional(),
  spanId: z.string().optional(),
});

export const ServiceContextSchema = z.object({
  // 数据库服务
  db: z.any(),
  
  // AI服务
  aiAssistant: z.any().optional(),
  embedding: z.any().optional(),
  ollama: z.any().optional(),
  
  // 安全服务
  zeroTrust: z.any().optional(),
  quantumCrypto: z.any().optional(),
  auth: z.any().optional(),
  
  // 缓存服务
  cache: z.any().optional(),
  redis: z.any().optional(),
  
  // 监控服务
  metrics: z.any().optional(),
  logger: z.any().optional(),
  
  // 限流服务
  rateLimiter: z.any().optional(),
  
  // 其他服务
  config: z.any().optional(),
  eventEmitter: z.any().optional(),
});

export type UserContext = z.infer<typeof UserContextSchema>;
export type RequestContext = z.infer<typeof RequestContextSchema>;
export type ServiceContext = z.infer<typeof ServiceContextSchema>;

// ============================================================================
// 完整上下文接口
// ============================================================================

export interface Context {
  // HTTP 请求/响应对象
  req?: any;
  res?: any;
  
  // 用户上下文
  user?: UserContext;
  
  // 请求上下文
  request: RequestContext;
  
  // 服务上下文
  services: ServiceContext;
  
  // 元数据
  metadata: {
    startTime: number;
    requestId: string;
    traceId?: string;
    spanId?: string;
    region?: string;
    version: string;
  };
}

// ============================================================================
// 上下文创建器
// ============================================================================

export class ContextCreator {
  private readonly logger = new Logger(ContextCreator.name);
  
  constructor(private services: ServiceContext) {}

  /**
   * 创建tRPC上下文
   */
  async createContext({ req, res }: { req?: any; res?: any }): Promise<Context> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();
    const traceId = this.extractTraceId(req);
    const spanId = this.generateSpanId();
    
    // 创建请求上下文
    const requestContext: RequestContext = {
      requestId,
      timestamp: new Date(),
      method: req?.method || 'UNKNOWN',
      url: req?.url || '',
      headers: req?.headers as Record<string, string> || {},
      query: req?.query,
      body: req?.body,
      userAgent: req?.get('User-Agent'),
      ipAddress: this.extractClientIP(req),
      region: this.extractRegion(req),
      traceId,
      spanId,
    };
    
    // 提取用户信息
    const user = await this.extractUser(req);
    
    // 创建完整上下文
    const context: Context = {
      req,
      res,
      user,
      request: requestContext,
      services: this.services,
      metadata: {
        startTime,
        requestId,
        traceId,
        spanId,
        region: requestContext.region,
        version: process.env.APP_VERSION || '1.0.0',
      },
    };
    
    // 记录请求日志
    this.logRequest(context);
    
    return context;
  }

  /**
   * 提取用户信息
   */
  private async extractUser(req?: any): Promise<UserContext | undefined> {
    if (!req) return undefined;
    
    try {
      // 从Authorization头提取JWT token
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return undefined;
      }
      
      const token = authHeader.substring(7);
      
      // 验证和解析JWT token
      if (this.services.auth) {
        const payload = await this.services.auth.verifyToken(token);
        
        return {
          sub: payload.sub,
          email: payload.email,
          organizationId: payload.organizationId,
          roles: payload.roles || [],
          permissions: payload.permissions || [],
          sessionId: payload.sessionId,
          deviceId: payload.deviceId,
          ipAddress: this.extractClientIP(req),
          userAgent: req.get('User-Agent'),
          lastActivity: new Date(),
          preferences: payload.preferences,
          metadata: payload.metadata,
        };
      }
      
      return undefined;
    } catch (error) {
      this.logger.warn('Failed to extract user context', error);
      return undefined;
    }
  }

  /**
   * 提取客户端IP地址
   */
  private extractClientIP(req?: any): string | undefined {
    if (!req) return undefined;
    
    return (
      req.ip ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      (req.headers['x-client-ip'] as string) ||
      undefined
    );
  }

  /**
   * 提取地理区域
   */
  private extractRegion(req?: any): string | undefined {
    if (!req) return undefined;
    
    return (
      (req.headers['cf-ipcountry'] as string) || // Cloudflare
      (req.headers['x-vercel-ip-country'] as string) || // Vercel
      (req.headers['x-aws-region'] as string) || // AWS
      undefined
    );
  }

  /**
   * 提取追踪ID
   */
  private extractTraceId(req?: any): string | undefined {
    if (!req) return undefined;
    
    return (
      (req.headers['x-trace-id'] as string) ||
      (req.headers['x-request-id'] as string) ||
      (req.headers['x-correlation-id'] as string) ||
      this.generateTraceId()
    );
  }

  /**
   * 生成请求ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 生成追踪ID
   */
  private generateTraceId(): string {
    return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
  }

  /**
   * 生成Span ID
   */
  private generateSpanId(): string {
    return `span_${Math.random().toString(36).substr(2, 12)}`;
  }

  /**
   * 记录请求日志
   */
  private logRequest(context: Context): void {
    const { request, user, metadata } = context;
    
    this.logger.log({
      message: 'tRPC Request',
      requestId: metadata.requestId,
      traceId: metadata.traceId,
      method: request.method,
      url: request.url,
      userAgent: request.userAgent,
      ipAddress: request.ipAddress,
      region: request.region,
      userId: user?.sub,
      organizationId: user?.organizationId,
      timestamp: request.timestamp,
    });
  }
}

// ============================================================================
// 上下文工具函数
// ============================================================================

/**
 * 检查用户是否有特定权限
 */
export const hasPermission = (context: Context, permission: string): boolean => {
  return context.user?.permissions?.includes(permission) || false;
};

/**
 * 检查用户是否有特定角色
 */
export const hasRole = (context: Context, role: string): boolean => {
  return context.user?.roles?.includes(role) || false;
};

/**
 * 检查用户是否属于特定组织
 */
export const belongsToOrganization = (context: Context, organizationId: string): boolean => {
  return context.user?.organizationId === organizationId;
};

/**
 * 获取用户ID
 */
export const getUserId = (context: Context): string | undefined => {
  return context.user?.sub;
};

/**
 * 获取组织ID
 */
export const getOrganizationId = (context: Context): string | undefined => {
  return context.user?.organizationId;
};

/**
 * 获取请求ID
 */
export const getRequestId = (context: Context): string => {
  return context.metadata.requestId;
};

/**
 * 获取追踪ID
 */
export const getTraceId = (context: Context): string | undefined => {
  return context.metadata.traceId;
};

/**
 * 创建子上下文
 */
export const createChildContext = (
  parent: Context,
  overrides: Partial<Context> = {}
): Context => {
  return {
    ...parent,
    ...overrides,
    metadata: {
      ...parent.metadata,
      ...overrides.metadata,
      spanId: `span_${Math.random().toString(36).substr(2, 12)}`,
    },
  };
};

/**
 * 添加上下文元数据
 */
export const addContextMetadata = (
  context: Context,
  key: string,
  value: any
): Context => {
  return {
    ...context,
    metadata: {
      ...context.metadata,
      [key]: value,
    },
  };
};

/**
 * 测量执行时间
 */
export const measureExecutionTime = (context: Context): number => {
  return Date.now() - context.metadata.startTime;
};

// ============================================================================
// 上下文验证器
// ============================================================================

export class ContextValidator {
  /**
   * 验证用户上下文
   */
  static validateUser(context: Context): UserContext {
    if (!context.user) {
      throw new Error('User context is required');
    }
    
    return UserContextSchema.parse(context.user);
  }

  /**
   * 验证请求上下文
   */
  static validateRequest(context: Context): RequestContext {
    return RequestContextSchema.parse(context.request);
  }

  /**
   * 验证服务上下文
   */
  static validateServices(context: Context): ServiceContext {
    return ServiceContextSchema.parse(context.services);
  }

  /**
   * 验证完整上下文
   */
  static validate(context: Context): Context {
    // 验证必需字段
    if (!context.request) {
      throw new Error('Request context is required');
    }
    
    if (!context.services) {
      throw new Error('Services context is required');
    }
    
    if (!context.metadata) {
      throw new Error('Metadata context is required');
    }
    
    // 验证子上下文
    this.validateRequest(context);
    this.validateServices(context);
    
    if (context.user) {
      this.validateUser(context);
    }
    
    return context;
  }
}

// ============================================================================
// 导出
// ============================================================================

export { ContextCreator as default };