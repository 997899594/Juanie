/**
 * 数据传输对象（DTO）类型
 * 用于服务方法的输入参数
 */

// ============ 组织相关 DTO ============

export interface CreateOrganizationInput {
  name: string
  slug: string
  displayName?: string
}

export interface UpdateOrganizationInput {
  name?: string
  slug?: string
  displayName?: string
}

export interface InviteMemberInput {
  invitedUserId: string
  role: 'admin' | 'member'
}

export interface UpdateMemberRoleInput {
  memberId: string
  role: 'admin' | 'member'
}

export interface RemoveMemberInput {
  memberId: string
}

// ============ 团队相关 DTO ============

export interface CreateTeamInput {
  name: string
  slug: string
  description?: string
}

export interface UpdateTeamInput {
  name?: string
  slug?: string
  description?: string
}

// ============ 项目相关 DTO ============

export interface CreateProjectInput {
  name: string
  slug: string
  description?: string
  visibility?: 'public' | 'private' | 'internal'
}

export interface UpdateProjectInput {
  name?: string
  slug?: string
  description?: string
  visibility?: 'public' | 'private' | 'internal'
  status?: 'active' | 'inactive' | 'archived'
}

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
