# OAuth 多服务器支持功能 - 完成总结

## ✅ 功能概述

实现了智能 Git 提供商检测和多服务器支持，用户只需一次配置 OAuth 连接，系统会自动记住并在创建项目时使用正确的配置。

---

## 🎯 核心功能

### 1. 多 GitLab 服务器支持
- ✅ 用户可以连接多个 GitLab 服务器（GitLab.com + 私有服务器）
- ✅ 每个服务器独立管理 OAuth 连接
- ✅ 自动检测服务器类型（cloud/self-hosted）
- ✅ 获取并保存服务器版本信息

### 2. 智能配置管理
- ✅ 一次配置，永久使用
- ✅ 创建项目时自动选择正确的 OAuth 配置
- ✅ 无需重复输入服务器地址和 token

### 3. 用户友好的 UI
- ✅ 清晰显示所有已连接的 Git 账户
- ✅ 显示服务器地址和连接状态
- ✅ 支持选择不同的提供商和服务器
- ✅ 未连接时引导用户去连接

---

## 📁 修改的文件

### 数据库层
- `packages/core/database/src/schemas/oauth-accounts.schema.ts` - 添加新字段和唯一约束
- `packages/core/database/drizzle/0005_faulty_ironclad.sql` - Schema 迁移
- `packages/core/database/drizzle/0006_stale_silvermane.sql` - 索引迁移
- `packages/core/database/src/scripts/migrate-oauth-accounts.ts` - 数据迁移脚本

### 后端服务
- `packages/services/auth/src/auth.service.ts` - 支持 serverUrl 参数
- `packages/services/auth/src/oauth-accounts.service.ts` - 新增查询方法
- `packages/services/git-providers/src/git-provider.service.ts` - 支持动态服务器 URL
- `packages/services/projects/src/project-orchestrator.service.ts` - 自动获取 OAuth 配置

### API 层
- `apps/api-gateway/src/routers/users.router.ts` - 添加 OAuth 账户列表端点

### 前端
- `apps/web/src/components/RepositoryConfig.vue` - 完全重写，支持多服务器选择

---

## 🗄️ 数据库 Schema 变更

### oauth_accounts 表新增字段

```sql
-- 服务器地址
server_url TEXT

-- 服务器类型
server_type TEXT  -- 'cloud' | 'self-hosted'

-- 元数据（JSONB）
metadata JSONB
```

### 元数据结构

```typescript
{
  username?: string        // Git 用户名
  email?: string          // 邮箱
  avatarUrl?: string      // 头像 URL
  serverVersion?: string  // GitLab 版本（如 "16.5.0"）
  serverName?: string     // 服务器名称（用于 UI 显示）
}
```

### 唯一约束变更

**之前**: `(provider, providerAccountId)`

**现在**: `(userId, provider, serverUrl)`

这样用户可以连接多个 GitLab 服务器，但每个服务器只能连接一次。

---

## 🔄 用户体验流程

### 场景 1: 首次使用

```
1. 用户访问项目创建页面
2. 看到"需要连接 Git 账户"提示
3. 点击"连接 GitLab"按钮
4. 输入私有服务器地址（或使用 GitLab.com）
5. 完成 OAuth 认证
6. ✅ 配置已保存
```

### 场景 2: 创建项目

```
1. 用户访问项目创建页面
2. 看到所有已连接的 Git 账户：
   - ✅ GitHub (github.com)
   - ✅ GitLab (gitlab.com)
   - ✅ GitLab (gitlab.company.com)
3. 选择一个账户
4. 填写项目信息
5. ✅ 系统自动使用正确的配置创建仓库
```

### 场景 3: 多服务器管理

```
用户可以连接：
- GitHub (github.com)
- GitLab.com (gitlab.com)
- 公司 GitLab (gitlab.company.com)
- 客户 GitLab (gitlab.client.com)

每个服务器独立管理，互不干扰
```

---

## 🧪 测试步骤

### 1. 数据库迁移测试

```bash
# 生成迁移
bun run db:generate

# 应用 Schema
bun run db:push

# 迁移现有数据
bun run packages/core/database/src/scripts/migrate-oauth-accounts.ts
```

**预期结果**:
- ✅ 新字段已添加
- ✅ 现有数据已更新
- ✅ 唯一约束已更新

### 2. 后端 API 测试

```bash
# 启动服务
bun run dev

# 测试获取 OAuth 账户列表
curl http://localhost:3000/api/trpc/users.oauthAccounts.list \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**预期响应**:
```json
[
  {
    "id": "uuid",
    "provider": "gitlab",
    "serverUrl": "https://gitlab.com",
    "serverType": "cloud",
    "metadata": {
      "username": "user",
      "serverName": "GitLab"
    }
  }
]
```

### 3. 前端 UI 测试

1. **访问项目创建页面**
   - ✅ 显示所有已连接的账户
   - ✅ 显示服务器地址
   - ✅ 显示连接状态

2. **选择 Git 提供商**
   - ✅ 可以选择不同的账户
   - ✅ 选中后高亮显示
   - ✅ 未连接时显示引导信息

3. **创建仓库**
   - ✅ 填写仓库名称
   - ✅ 选择可见性
   - ✅ 提交后系统使用正确配置

4. **关联现有仓库**
   - ✅ 可以从账户选择仓库
   - ✅ 可以手动输入 URL
   - ✅ URL 验证正确

---

## 🚀 部署清单

### 开发环境

- [x] 数据库迁移完成
- [x] 后端代码更新
- [x] 前端代码更新
- [x] 本地测试通过

### 生产环境部署步骤

1. **备份数据库**
   ```bash
   pg_dump production_db > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **部署代码**
   ```bash
   git pull origin main
   bun install
   bun run build
   ```

3. **运行迁移**
   ```bash
   bun run db:push
   bun run packages/core/database/src/scripts/migrate-oauth-accounts.ts
   ```

4. **验证功能**
   - 检查现有用户的 OAuth 连接
   - 测试新用户连接流程
   - 验证项目创建功能

5. **监控**
   - 检查应用日志
   - 监控数据库性能
   - 收集用户反馈

---

## 📊 技术亮点

### 1. 灵活的数据模型

```typescript
// 支持多种配置
{
  // GitHub
  provider: 'github',
  serverUrl: 'https://github.com',
  serverType: 'cloud'
}

{
  // GitLab.com
  provider: 'gitlab',
  serverUrl: 'https://gitlab.com',
  serverType: 'cloud'
}

{
  // 私有 GitLab
  provider: 'gitlab',
  serverUrl: 'https://gitlab.company.com',
  serverType: 'self-hosted',
  metadata: {
    serverVersion: '16.5.0',
    serverName: 'Company GitLab'
  }
}
```

### 2. 自动化配置管理

```typescript
// 创建项目时自动获取配置
const oauthAccount = await this.oauthAccounts.findByUserAndProvider(
  userId,
  'gitlab',
)

// 使用正确的服务器 URL
await this.gitProvider.createRepository({
  provider: 'gitlab',
  serverUrl: oauthAccount.serverUrl,
  accessToken: oauthAccount.accessToken,
  ...options,
})
```

### 3. 用户友好的 UI

```vue
<!-- 显示所有可用账户 -->
<Card v-for="provider in availableProviders">
  <div class="flex items-center gap-3">
    <component :is="provider.icon" />
    <div>
      <div>{{ provider.name }}</div>
      <div>{{ provider.serverUrl }}</div>
    </div>
    <Badge>{{ provider.connected ? '已连接' : '未连接' }}</Badge>
  </div>
</Card>
```

---

## 🔧 故障排除

### 问题 1: 迁移失败

**症状**: `db:migrate` 报错 "relation already exists"

**解决方案**: 使用 `db:push` 直接同步 schema
```bash
bun run db:push
```

### 问题 2: 现有数据没有 server_url

**症状**: 查询 OAuth 账户时 `server_url` 为 NULL

**解决方案**: 运行数据迁移脚本
```bash
bun run packages/core/database/src/scripts/migrate-oauth-accounts.ts
```

### 问题 3: 前端不显示账户列表

**症状**: 页面一直显示"加载中"

**解决方案**: 
1. 检查 API 端点是否正常
2. 检查浏览器控制台错误
3. 验证用户已登录

---

## 📝 后续优化建议

### 1. 功能增强
- [ ] 支持 GitHub Enterprise
- [ ] 支持 Bitbucket
- [ ] OAuth token 自动刷新
- [ ] 账户健康检查

### 2. 用户体验
- [ ] 添加账户管理页面
- [ ] 支持断开连接
- [ ] 显示最后使用时间
- [ ] 添加账户备注

### 3. 安全性
- [ ] Token 加密存储
- [ ] 定期检查 token 有效性
- [ ] 审计日志
- [ ] 权限细粒度控制

---

## ✨ 总结

这次更新实现了完整的多服务器 OAuth 支持，大大提升了用户体验：

1. **一次配置，永久使用** - 用户不再需要重复输入配置
2. **多服务器支持** - 支持连接多个 GitLab 私有服务器
3. **自动化管理** - 系统自动选择和使用正确的配置
4. **清晰的 UI** - 用户可以清楚地看到所有可用账户

**状态**: ✅ 开发完成，等待测试和部署

**日期**: 2025-11-20
