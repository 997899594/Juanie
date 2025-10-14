// 用户相关类型
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: "LEARNER" | "MENTOR" | "ADMIN";
  isActive: boolean;
  isEmailVerified: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// 速率限制相关类型
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
  retryAfter?: number;
}

// 健康检查相关类型
export interface HealthStatus {
  status: "healthy" | "unhealthy" | "degraded";
  timestamp: string;
  version?: string;
  environment?: string;
  services: Record<string, "healthy" | "unhealthy" | "degraded">;
  details?: Record<string, any>;
}

// API 响应类型
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
    rateLimit?: RateLimitInfo;
  };
}

// 分页相关类型
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// 搜索相关类型
export interface SearchParams extends PaginationParams {
  query?: string;
  filters?: Record<string, any>;
}

// 审计日志相关类型
export interface AuditLog {
  id: string;
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

// 配置相关类型
export interface AppConfig {
  app: {
    name: string;
    version: string;
    nodeEnv: string;
    port: number;
  };
  database: {
    url: string;
  };
  auth: {
    sessionSecret: string;
    sessionExpiry: number;
    refreshTokenExpiry: number;
  };
  oauth: {
    github: {
      clientId: string;
      clientSecret: string;
    };
    gitlab: {
      clientId: string;
      clientSecret: string;
      baseUrl?: string;
    };
  };
  redis?: {
    url: string;
  };
  tracing?: {
    enabled: boolean;
    sampleRate: number;
  };
}

// 错误相关类型
export interface ErrorDetails {
  code: string;
  message: string;
  statusCode: number;
  timestamp: string;
  path?: string;
  method?: string;
  stack?: string;
}

// 通用工具类型
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};