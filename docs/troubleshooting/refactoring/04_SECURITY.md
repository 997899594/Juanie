# 安全加固方案

## 🎯 问题总结

1. **敏感信息明文存储** - Git tokens、API keys 未加密
2. **RBAC 不完整** - 权限检查不一致
3. **缺少加密服务使用** - EncryptionService 已实现但未充分使用
4. **审计日志不完整** - 部分操作未记录

## 📋 解决方案

### 1. 敏感信息加密

**当前问题**: Git tokens 存储在数据库中未加密

**解决方案**: 使用 EncryptionService 加密所有敏感字段

**实施步骤**:

1. **更新 Schema 添加加密标记**:
```typescript
// packages/core/src/database/schemas/project-git-auth.schema.ts
export const projectGitAuth = pgTable('project_git_auth', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull(),
  
  // 加密字段 - 存储加密后的数据
  accessToken: text('access_token'), // 加密存储
  refreshToken: text('refresh_token'), // 加密存储
  privateKey: text('private_key'), // 加密存储
  
  // 元数据
  encryptedFields: jsonb('encrypted_fields').$type<string[]>()
    .default(['accessToken', 'refreshToken', 'privateKey']),
})
```

2. **创建加密 Repository 基类**:
```typescript
// packages/core/src/database/encrypted-repository.ts
import { EncryptionService } from '@juanie/service-foundation'

export abstract class EncryptedRepository<T> {
  constructor(
    protected readonly db: PostgresJsDatabase,
    protected readonly encryption: EncryptionService,
    protected readonly encryptedFields: string[],
  ) {}

  /**
   * 加密敏感字段
   */
  protected async encryptFields(data: Partial<T>): Promise<Partial<T>> {
    const encrypted = { ...data }
    
    for (const field of this.encryptedFields) {
      if (field in encrypted && encrypted[field]) {
        encrypted[field] = await this.encryption.encrypt(
          String(encrypted[field])
        )
      }
    }
    
    return encrypted
  }

  /**
   * 解密敏感字段
   */
  protected async decryptFields(data: T): Promise<T> {
    const decrypted = { ...data }
    
    for (const field of this.encryptedFields) {
      if (field in decrypted && decrypted[field]) {
        try {
          decrypted[field] = await this.encryption.decrypt(
            String(decrypted[field])
          )
        } catch (error) {
          // 解密失败，可能是旧数据
          console.error(`Failed to decrypt field ${field}`, error)
        }
      }
    }
    
    return decrypted
  }
}
```

3. **使用加密 Repository**:
```typescript
// packages/services/business/src/gitops/credentials/credential.repository.ts
@Injectable()
export class CredentialRepository extends EncryptedRepository<GitCredential> {
  constructor(
    @Inject(DATABASE) db: PostgresJsDatabase<typeof schema>,
    encryption: EncryptionService,
  ) {
    super(db, encryption, ['accessToken', 'refreshToken', 'privateKey'])
  }

  async create(data: CreateCredentialInput) {
    const encrypted = await this.encryptFields(data)
    
    const [credential] = await this.db
      .insert(schema.projectGitAuth)
      .values(encrypted)
      .returning()
    
    return this.decryptFields(credential)
  }

  async findById(id: string) {
    const credential = await this.db.query.projectGitAuth.findFirst({
      where: eq(schema.projectGitAuth.id, id),
    })
    
    return credential ? this.decryptFields(credential) : null
  }
}
```

### 2. RBAC 权限统一

**创建权限检查装饰器**:
```typescript
// packages/core/src/auth/permissions.decorator.ts
import { SetMetadata } from '@nestjs/common'

export const PERMISSIONS_KEY = 'permissions'

export enum Permission {
  // 项目权限
  PROJECT_CREATE = 'project:create',
  PROJECT_READ = 'project:read',
  PROJECT_UPDATE = 'project:update',
  PROJECT_DELETE = 'project:delete',
  
  // 部署权限
  DEPLOYMENT_CREATE = 'deployment:create',
  DEPLOYMENT_READ = 'deployment:read',
  DEPLOYMENT_APPROVE = 'deployment:approve',
  
  // 成员权限
  MEMBER_INVITE = 'member:invite',
  MEMBER_REMOVE = 'member:remove',
  MEMBER_UPDATE_ROLE = 'member:update_role',
}

export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions)
```

**权限守卫**:
```typescript
// packages/core/src/auth/permissions.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { PERMISSIONS_KEY, Permission } from './permissions.decorator'

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    )

    if (!requiredPermissions) {
      return true
    }

    const { user } = context.switchToHttp().getRequest()
    
    return requiredPermissions.every((permission) =>
      user.permissions?.includes(permission),
    )
  }
}
```

**使用示例**:
```typescript
@Injectable()
export class ProjectsService {
  @RequirePermissions(Permission.PROJECT_CREATE)
  async createProject(data: CreateProjectInput) {
    // 实现
  }

  @RequirePermissions(Permission.PROJECT_UPDATE)
  async updateProject(id: string, data: UpdateProjectInput) {
    // 实现
  }

  @RequirePermissions(Permission.PROJECT_DELETE)
  async deleteProject(id: string) {
    // 实现
  }
}
```

### 3. 完善审计日志

**审计日志装饰器**:
```typescript
// packages/core/src/audit/audit.decorator.ts
export function Audit(options: {
  action: string
  resourceType: string
  getResourceId?: (...args: any[]) => string
}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const result = await originalMethod.apply(this, args)
      
      const auditService: AuditLogsService = this.auditService
      const user = this.getCurrentUser()
      
      await auditService.log({
        userId: user.id,
        action: options.action,
        resourceType: options.resourceType,
        resourceId: options.getResourceId ? options.getResourceId(...args) : null,
        metadata: {
          args: this.sanitizeArgs(args),
          result: this.sanitizeResult(result),
        },
      })
      
      return result
    }

    return descriptor
  }
}
```

**使用示例**:
```typescript
@Injectable()
export class ProjectsService {
  @Audit({
    action: 'project.create',
    resourceType: 'project',
    getResourceId: (data, result) => result.id,
  })
  async createProject(data: CreateProjectInput) {
    // 实现
  }

  @Audit({
    action: 'project.delete',
    resourceType: 'project',
    getResourceId: (id) => id,
  })
  async deleteProject(id: string) {
    // 实现
  }
}
```

### 4. 输入验证和清理

**使用 Zod 验证**:
```typescript
// packages/types/src/validation/project.schema.ts
import { z } from 'zod'

export const createProjectSchema = z.object({
  name: z.string()
    .min(3, '项目名称至少3个字符')
    .max(50, '项目名称最多50个字符')
    .regex(/^[a-zA-Z0-9-_]+$/, '只能包含字母、数字、横线和下划线'),
  
  description: z.string()
    .max(500, '描述最多500个字符')
    .optional(),
  
  gitRepoUrl: z.string()
    .url('无效的 Git 仓库 URL')
    .optional(),
})

export type CreateProjectInput = z.infer<typeof createProjectSchema>
```

**在 tRPC 中使用**:
```typescript
export const projectsRouter = router({
  create: protectedProcedure
    .input(createProjectSchema)
    .mutation(async ({ ctx, input }) => {
      // input 已经过验证和类型检查
      return ctx.projectsService.createProject(input)
    }),
})
```

## 📊 实施清单

### Phase 1: 敏感信息加密 (3天)

- [ ] 实现 EncryptedRepository 基类
- [ ] 创建 CredentialRepository
- [ ] 迁移现有数据（加密）
- [ ] 更新所有使用凭证的代码
- [ ] 验证加密/解密正常工作

### Phase 2: RBAC 完善 (2天)

- [ ] 定义完整的权限枚举
- [ ] 实现权限装饰器和守卫
- [ ] 为所有敏感操作添加权限检查
- [ ] 更新用户角色权限映射

### Phase 3: 审计日志 (2天)

- [ ] 实现审计日志装饰器
- [ ] 为关键操作添加审计
- [ ] 实现审计日志查询 API
- [ ] 添加审计日志导出功能

### Phase 4: 输入验证 (1天)

- [ ] 为所有 API 添加 Zod schema
- [ ] 实现输入清理函数
- [ ] 添加 XSS 防护
- [ ] 添加 SQL 注入防护（Drizzle 已内置）

## 🎯 预期效果

- **敏感信息**: 100% 加密存储
- **权限检查**: 覆盖所有敏感操作
- **审计日志**: 完整记录关键操作
- **输入验证**: 100% API 覆盖

## 🔗 相关文档

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [NestJS Security](https://docs.nestjs.com/security/encryption-and-hashing)
- [Zod 文档](https://zod.dev/)
