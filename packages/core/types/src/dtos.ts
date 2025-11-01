/**
 * 数据传输对象（DTO）类型
 * 用于服务方法的输入参数
 *
 * 注意：大部分输入类型现在从 Zod schemas 推导（见 schemas.ts）
 * 这里只保留响应类型和特殊的输入类型
 */

// ============ 认证相关 DTO ============

export interface CreateUserFromOAuthInput {
  email: string
  username: string
  displayName: string
  avatarUrl: string
  provider: string
  providerAccountId: string
  accessToken: string
}

export interface OAuthUrlResponse {
  url: string
  state: string
}

export interface UserResponse {
  id: string
  email: string
  username: string | null
  displayName: string | null
  avatarUrl: string | null
}

export interface LoginResponse {
  user: UserResponse
  sessionId: string
}

export interface SessionValidationResponse {
  valid: boolean
  user: UserResponse
}

// ============ 通用响应 DTO ============

export interface SuccessResponse {
  success: boolean
  message?: string
}
