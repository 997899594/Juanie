/**
 * API 相关类型
 */

// 分页参数
export interface PaginationParams {
  page?: number
  limit?: number
}

// 分页响应
export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// 排序参数
export interface SortParams {
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

// 搜索参数
export interface SearchParams {
  query?: string
}

// API 响应
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
  }
}

// tRPC 上下文
export interface TrpcContext {
  sessionId?: string
  user?: {
    id: string
    email: string
  }
}

// 认证相关
export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterData {
  email: string
  password: string
  username?: string
  displayName?: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

// OAuth 相关
export interface OAuthProvider {
  provider: 'github' | 'gitlab' | 'google'
  clientId: string
  clientSecret: string
  redirectUri: string
}

export interface OAuthAccount {
  id: string
  userId: string
  provider: 'github' | 'gitlab' | 'google'
  providerAccountId: string
  accessToken: string
  refreshToken?: string | null
  expiresAt?: Date | null
}
