# Bug 修复：OAuth 账户查询问题

## 问题描述

创建项目时使用 OAuth 令牌失败，提示"Git 访问令牌无效"，即使 OAuth 应用配置正确且权限充足。

## 根本原因

在 `packages/services/auth/src/oauth-accounts.service.ts` 中，`getAccountByProvider` 和 `disconnect` 方法的 SQL 查询条件写法错误：

### 错误代码
```typescript
// ❌ 错误：使用了 JavaScript 的 && 运算符
.where(eq(schema.oauthAccounts.userId, userId) && eq(schema.oauthAccounts.provider, provider))
```

这会导致：
1. SQL 查询条件不正确
2. 无法正确查询到用户的 OAuth 账户
3. 返回 `null`，触发"未找到 OAuth 连接"错误

### 正确代码
```typescript
// ✅ 正确：使用 Drizzle ORM 的 and() 函数
.where(
  and(
    eq(schema.oauthAccounts.userId, userId),
    eq(schema.oauthAccounts.provider, provider),
  ),
)
```

## 修复内容

### 文件：`packages/services/auth/src/oauth-accounts.service.ts`

1. **导入 `and` 函数**
   ```typescript
   import { and, eq } from 'drizzle-orm'
   ```

2. **修复 `getAccountByProvider` 方法**
   ```typescript
   async getAccountByProvider(userId: string, provider: 'github' | 'gitlab') {
     const [account] = await this.db
       .select()
       .from(schema.oauthAccounts)
       .where(
         and(
           eq(schema.oauthAccounts.userId, userId),
           eq(schema.oauthAccounts.provider, provider),
         ),
       )
       .limit(1)

     return account || null
   }
   ```

3. **修复 `disconnect` 方法**
   ```typescript
   async disconnect(userId: string, provider: 'github' | 'gitlab') {
     await this.db
       .delete(schema.oauthAccounts)
       .where(
         and(
           eq(schema.oauthAccounts.userId, userId),
           eq(schema.oauthAccounts.provider, provider),
         ),
       )

     return { success: true }
   }
   ```

## 影响范围

### 受影响的功能
- ✅ 使用 OAuth 令牌创建项目
- ✅ 使用 OAuth 令牌连接仓库
- ✅ 断开 OAuth 账户连接

### 不受影响的功能
- ✅ 手动输入访问令牌创建项目
- ✅ 列出用户的 OAuth 账户
- ✅ 检查是否已连接 OAuth 账户

## 测试步骤

### 1. 重启应用
```bash
# 停止当前运行的应用
# 重新启动
npm run dev
```

### 2. 测试 OAuth 连接
1. 进入"设置 > 账户连接"
2. 连接 GitLab 账户
3. 确认连接成功

### 3. 测试创建项目
1. 创建新项目
2. 配置仓库：
   - 选择"创建新仓库"
   - 选择 GitLab
   - 勾选"使用 OAuth 令牌"
3. 提交创建
4. 确认项目和仓库创建成功

### 4. 验证数据库
```sql
-- 查看 OAuth 账户
SELECT id, user_id, provider, provider_account_id, created_at 
FROM oauth_accounts;

-- 查看创建的仓库
SELECT id, project_id, provider, full_name, created_at 
FROM repositories 
ORDER BY created_at DESC 
LIMIT 5;
```

## 预期结果

修复后，使用 OAuth 令牌创建项目应该：
1. ✅ 正确查询到用户的 OAuth 账户
2. ✅ 获取到有效的访问令牌
3. ✅ 成功调用 GitLab API 创建仓库
4. ✅ 将仓库信息保存到数据库
5. ✅ 项目初始化成功

## 相关问题

如果修复后仍有问题，请检查：

1. **OAuth 账户是否已保存到数据库**
   ```sql
   SELECT * FROM oauth_accounts WHERE user_id = 'YOUR_USER_ID';
   ```

2. **访问令牌是否有效**
   - 令牌未过期
   - 令牌包含必需的权限（api, read_repository, write_repository）

3. **网络连接**
   - 服务器可以访问 GitLab API
   - 没有防火墙阻止

## 技术细节

### Drizzle ORM 查询条件

在 Drizzle ORM 中，组合多个查询条件需要使用特定的函数：

- `and()` - 逻辑与（所有条件都必须满足）
- `or()` - 逻辑或（任一条件满足即可）
- `not()` - 逻辑非（条件不满足）

**错误示例：**
```typescript
// ❌ 不要使用 JavaScript 运算符
.where(condition1 && condition2)
.where(condition1 || condition2)
```

**正确示例：**
```typescript
// ✅ 使用 Drizzle ORM 函数
import { and, or, not } from 'drizzle-orm'

.where(and(condition1, condition2))
.where(or(condition1, condition2))
.where(not(condition))
```

## 提交信息

```
fix(auth): 修复 OAuth 账户查询条件错误

- 修复 getAccountByProvider 方法中的 SQL 查询条件
- 修复 disconnect 方法中的 SQL 查询条件
- 使用 Drizzle ORM 的 and() 函数替代 JavaScript && 运算符
- 解决使用 OAuth 令牌创建项目失败的问题

Closes #XXX
```

## 相关文件

- `packages/services/auth/src/oauth-accounts.service.ts` - OAuth 账户服务
- `packages/services/projects/src/project-orchestrator.service.ts` - 项目编排服务
- `.kiro/specs/project-creation-flow-review/design.md` - 设计文档
