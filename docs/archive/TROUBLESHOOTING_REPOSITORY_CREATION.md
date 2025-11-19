# 仓库创建问题排查指南

## 问题描述
创建项目时无法创建 Git 仓库

## 可能的原因和解决方案

### 1. 访问令牌问题

#### 症状
- 创建仓库时返回 401 或 403 错误
- 提示"访问令牌无效或权限不足"

#### 排查步骤
1. **检查令牌权限**
   - GitHub: 需要 `repo` 权限（完整的仓库访问权限）
   - GitLab: 需要 `api` 权限

2. **测试令牌有效性**
   ```bash
   # GitHub
   curl -H "Authorization: Bearer YOUR_TOKEN" https://api.github.com/user
   
   # GitLab
   curl -H "Authorization: Bearer YOUR_TOKEN" https://gitlab.com/api/v4/user
   ```

3. **检查 OAuth 账户**
   - 如果使用 OAuth，确保已在"设置 > 账户连接"中连接账户
   - 检查令牌是否过期

#### 解决方案
- 重新生成访问令牌，确保包含正确的权限
- 重新连接 OAuth 账户
- 使用手动输入的访问令牌而不是 OAuth

---

### 2. 仓库名称冲突

#### 症状
- 返回 422 错误
- 提示"仓库名称已存在"

#### 排查步骤
1. 检查 GitHub/GitLab 账户中是否已存在同名仓库
2. 查看错误日志中的详细信息

#### 解决方案
- 使用不同的仓库名称
- 删除或重命名现有仓库

---

### 3. 网络连接问题

#### 症状
- 请求超时
- 无法连接到 GitHub/GitLab API

#### 排查步骤
1. **测试网络连接**
   ```bash
   # 测试 GitHub API
   curl -I https://api.github.com
   
   # 测试 GitLab API
   curl -I https://gitlab.com/api/v4
   ```

2. **检查防火墙设置**
   - 确保服务器可以访问外部 API

3. **检查代理设置**
   - 如果使用代理，确保配置正确

#### 解决方案
- 配置正确的网络设置
- 添加 API 域名到白名单
- 配置 HTTP 代理（如需要）

---

### 4. 服务依赖注入问题

#### 症状
- 后端抛出 "Cannot read property of undefined" 错误
- GitProviderService 或 OAuthAccountsService 未定义

#### 排查步骤
1. **检查模块导入**
   ```typescript
   // packages/services/projects/src/projects.module.ts
   imports: [
     GitProvidersModule,  // ✓ 必须导入
     AuthModule,          // ✓ 必须导入（包含 OAuthAccountsService）
     // ...
   ]
   ```

2. **检查服务注入**
   ```typescript
   // packages/services/projects/src/project-orchestrator.service.ts
   constructor(
     private gitProvider: GitProviderService,  // ✓ 必须注入
     private oauthAccounts: OAuthAccountsService,  // ✓ 必须注入
     // ...
   )
   ```

#### 解决方案
- 确保所有必需的模块都已导入
- 重启应用程序

---

### 5. 数据库问题

#### 症状
- 无法保存仓库信息到数据库
- 提示"连接仓库失败"

#### 排查步骤
1. **检查数据库表**
   ```sql
   -- 检查 repositories 表是否存在
   SELECT * FROM information_schema.tables 
   WHERE table_name = 'repositories';
   
   -- 检查 oauth_accounts 表是否存在
   SELECT * FROM information_schema.tables 
   WHERE table_name = 'oauth_accounts';
   ```

2. **检查数据库连接**
   - 查看应用日志中的数据库连接错误

3. **运行数据库迁移**
   ```bash
   npm run db:push
   # 或
   npm run db:migrate
   ```

#### 解决方案
- 运行数据库迁移
- 检查数据库连接配置
- 确保数据库用户有足够的权限

---

### 6. 前端配置问题

#### 症状
- 前端没有正确传递仓库配置
- 缺少必需的字段

#### 排查步骤
1. **检查浏览器控制台**
   - 打开开发者工具 > Console
   - 查看是否有 JavaScript 错误

2. **检查网络请求**
   - 打开开发者工具 > Network
   - 查看 `createWithTemplate` 请求的 payload
   - 确认 `repository` 字段是否正确

3. **检查前端组件**
   ```vue
   <!-- apps/web/src/components/RepositoryConfig.vue -->
   <!-- 确保正确设置 mode, provider, accessToken 等字段 -->
   ```

#### 解决方案
- 检查前端表单验证逻辑
- 确保所有必需字段都已填写
- 查看前端错误提示

---

## 调试步骤

### 1. 启用详细日志

在 `.env` 文件中添加：
```env
LOG_LEVEL=debug
```

### 2. 查看后端日志

```bash
# 查看 API Gateway 日志
docker logs -f juanie-api-gateway

# 或者如果是本地开发
npm run dev
```

关注以下日志：
- `Creating project: ...`
- `Handling repository for project ...`
- `Creating github/gitlab repository: ...`
- `Repository created successfully: ...`

### 3. 测试 API 直接调用

使用 curl 或 Postman 测试：

```bash
# 测试创建 GitHub 仓库
curl -X POST http://localhost:3000/trpc/projects.createWithTemplate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "organizationId": "...",
    "name": "test-project",
    "slug": "test-project",
    "repository": {
      "mode": "create",
      "provider": "github",
      "name": "test-repo",
      "visibility": "private",
      "accessToken": "YOUR_GITHUB_TOKEN"
    }
  }'
```

### 4. 检查数据库状态

```sql
-- 查看项目状态
SELECT id, name, status, initialization_status 
FROM projects 
ORDER BY created_at DESC 
LIMIT 5;

-- 查看仓库
SELECT id, project_id, provider, full_name, created_at 
FROM repositories 
ORDER BY created_at DESC 
LIMIT 5;

-- 查看 OAuth 账户
SELECT id, user_id, provider, created_at 
FROM oauth_accounts;
```

---

## 常见错误信息及解决方案

| 错误信息 | 可能原因 | 解决方案 |
|---------|---------|---------|
| `仓库名称已存在` | 同名仓库已存在 | 使用不同的名称 |
| `访问令牌无效或权限不足` | 令牌权限不够 | 重新生成令牌，确保有 `repo` 权限 |
| `未找到 GitHub/GitLab OAuth 连接` | 未连接 OAuth 账户 | 在设置中连接账户或使用手动令牌 |
| `GitHub/GitLab API 错误: 401` | 令牌无效 | 检查令牌是否正确 |
| `GitHub/GitLab API 错误: 403` | 权限不足 | 检查令牌权限 |
| `GitHub/GitLab API 错误: 404` | API 端点错误 | 检查配置 |
| `连接仓库失败` | 数据库问题 | 检查数据库连接和表结构 |

---

## 快速诊断脚本

运行以下脚本进行快速诊断：

```bash
./scripts/debug-repository-creation.sh
```

---

## 需要帮助？

如果以上步骤都无法解决问题，请提供以下信息：

1. **错误日志**
   - 后端完整的错误堆栈
   - 前端控制台错误信息

2. **环境信息**
   - Node.js 版本
   - 数据库版本
   - 操作系统

3. **配置信息**
   - 使用的 Git Provider（GitHub/GitLab）
   - 使用 OAuth 还是手动令牌
   - 创建新仓库还是关联现有仓库

4. **重现步骤**
   - 详细的操作步骤
   - 输入的数据

5. **网络请求详情**
   - 浏览器 Network 标签中的请求和响应
