// 通用响应类型
export interface ApiResponse<T = unknown> {
  data: T;
  success: boolean;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T = unknown> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// 用户相关类型
export interface User {
  id: string;
  email: string;
  role: "user" | "admin";
  createdAt: Date;
  updatedAt: Date;
}

export interface UserInfo extends Omit<User, "createdAt" | "updatedAt"> {
  createdAt: string;
  updatedAt: string;
}

// 会话相关类型
export interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface SessionInfo extends Omit<Session, "createdAt" | "expiresAt"> {
  createdAt: string;
  expiresAt: string;
}

// 速率限制类型
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
}

// Git 相关类型（统一到这里）
export interface GitAuthor {
  name: string;
  email: string;
  username?: string;
  avatarUrl?: string;
}

export interface GitBranch {
  name: string;
  sha: string;
  protected: boolean;
  default: boolean;
}

export interface GitCommit {
  sha: string;
  message: string;
  author: GitAuthor;
  date: Date;
  url?: string;
}

export interface GitMergeRequest {
  id: number;
  title: string;
  description?: string;
  sourceBranch: string;
  targetBranch: string;
  status: "open" | "merged" | "closed" | "draft";
  author: GitAuthor;
  createdAt: Date;
  updatedAt: Date;
}

export interface GitRepository {
  id: string;
  name: string;
  fullName: string;
  description?: string;
  url: string;
  defaultBranch: string;
  private: boolean;
  language?: string;
}

// 健康检查类型
export interface HealthStatus {
  status: "healthy" | "unhealthy";
  services: Record<string, boolean>;
  timestamp: string;
  uptime: number;
  memory: NodeJS.MemoryUsage;
}

// 配置类型
export interface DatabaseConfig {
  url: string;
  maxConnections: number;
  ssl: boolean;
}

export interface RedisConfig {
  url: string;
  token?: string;
  maxRetries: number;
  retryDelay: number;
}

export interface AppConfig {
  name: string;
  version: string;
  environment: "development" | "production" | "test";
  port: number;
  host: string;
}
