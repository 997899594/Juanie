// Foundation Layer - 基础层服务
// 提供认证、用户管理、组织管理、团队管理和存储功能

// 模块导出
export { FoundationModule } from './foundation.module'
export { AuthModule } from './auth/auth.module'
export { UsersModule } from './users/users.module'
export { OrganizationsModule } from './organizations/organizations.module'
export { TeamsModule } from './teams/teams.module'
export { StorageModule } from './storage/storage.module'

// 服务导出
export { AuthService } from './auth/auth.service'
export { OAuthAccountsService } from './auth/oauth-accounts.service'
export { UsersService } from './users/users.service'
export { OrganizationsService } from './organizations/organizations.service'
export { TeamsService } from './teams/teams.service'
export { StorageService } from './storage/storage.service'

// 类型导出
export * from './auth/auth.types'
export * from './users/users.types'
export * from './organizations/organizations.types'
export * from './teams/teams.types'
export * from './storage/storage.types'
