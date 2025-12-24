# GitHub 用户名获取失败调查

## 问题现象

用户创建项目 "jljlkjlkjlkjlj" 后，K8s 部署失败：
- Pod 状态：`ImagePullBackOff`
- 镜像名称：`ghcr.io/unknown/jljlkjlkjlkjlj:latest` ❌
- 应该是：`ghcr.io/997899594/jljlkjlkjlkjlj:latest` ✅

## 调查过程

### 1. 数据库验证

✅ **Git 连接记录正确**：
```sql
SELECT * FROM git_connections WHERE user_id = '0bd7e1b5-2595-45fd-b1f0-9998e2da9c1b';
```

结果：
- Provider: `github`
- Username: `997899594` ✅
- Email: `997899594@qq.com`
- Status: `active`
- Provider Account ID: `52400220`

✅ **项目记录正确**：
```sql
SELECT * FROM projects WHERE id = 'e6d2133f-0a7d-4840-be03-5686ae1164fb';
```

结果：
- Project Name: `jljlkjlkjlkjlj`
- Organization ID: `bbc3246b-35e5-41e3-8637-b89d0cc4c51e`
- Status: `active`

✅ **Repository 记录正确**：
```sql
SELECT * FROM repositories WHERE project_id = 'e6d2133f-0a7d-4840-be03-5686ae1164fb';
```

结果：
- Full Name: `997899594/jljlkjlkjlkjlj` ✅
- Provider: `github`
- Clone URL: `https://github.com/997899594/jljlkjlkjlkjlj.git`

✅ **初始化步骤全部成功**：
- `create_repository`: completed
- `push_template`: completed
- `create_database_records`: completed
- `setup_gitops`: completed
- `finalize`: completed

### 2. 代码逻辑验证

✅ **Worker 代码逻辑正确**：

```typescript
// 1. resolveAccessToken() 正确返回 username
private async resolveAccessToken(userId: string, repository: any): Promise<any> {
  const gitConnection = await this.gitConnections.getConnectionWithDecryptedTokens(
    userId,
    repository.provider,
  )
  
  return {
    ...repository,
    accessToken: gitConnection.accessToken,
    username: gitConnection.username, // ✅ 返回 username
  }
}

// 2. pushTemplateCode() 正确接收 githubUsername
await this.pushTemplateCode(
  job,
  project,
  resolvedRepository.provider,
  resolvedRepository.accessToken,
  repoInfo,
  resolvedRepository.username, // ✅ 传递 username
)

// 3. 模板变量正确使用 githubUsername
const templateVariables = {
  githubUsername: githubUsername || 'unknown', // ✅ 使用传入的参数
  // ...
}
```

### 3. 问题根源

**代码逻辑完全正确，但是项目 "jljlkjlkjlkjlj" 创建时 `githubUsername` 使用了默认值 `unknown`。**

可能的原因：
1. ❓ `resolveAccessToken()` 在该项目创建时没有正确执行
2. ❓ `gitConnection.username` 在当时是 `undefined` 或 `null`
3. ❓ 代码在该项目创建后才修复的

## 修复方案

### 已完成的修复

1. ✅ **添加详细日志**（`project-initialization.worker.ts`）：
   ```typescript
   // 在 handleProjectInitialization 中
   this.logger.info(
     `Pushing template code with GitHub username: ${resolvedRepository.username || 'undefined'}`,
   )
   
   // 在 pushTemplateCode 中
   this.logger.info(`pushTemplateCode called with githubUsername: ${githubUsername || 'undefined'}`)
   ```

2. ✅ **验证代码逻辑**：
   - `resolveAccessToken()` 正确返回 `username`
   - `pushTemplateCode()` 正确接收 `githubUsername`
   - 模板变量正确使用 `githubUsername`

### 下一步操作

1. **重新部署后端**：
   ```bash
   bun run dev:api
   ```

2. **创建新项目测试**：
   - 创建一个新项目（例如 "test-username-fix"）
   - 检查日志输出，确认 `githubUsername` 是否正确
   - 验证镜像名称是否正确：`ghcr.io/997899594/test-username-fix:latest`

3. **修复现有项目**（如果需要）：
   - 方案 1：删除并重新创建项目
   - 方案 2：手动修改 K8s Deployment 的镜像名称
   - 方案 3：触发重新部署（如果支持）

## 验证清单

- [ ] 后端重新启动
- [ ] 创建新项目
- [ ] 检查日志中的 `githubUsername` 值
- [ ] 验证 K8s Deployment 的镜像名称
- [ ] 确认 Pod 状态为 `Running`

## 相关文件

- `packages/services/business/src/queue/project-initialization.worker.ts`
- `packages/services/business/src/projects/initialization/handlers/render-template.handler.ts`
- `packages/services/foundation/src/git-connections/git-connections.service.ts`
- `templates/nextjs-15-app/k8s/base/deployment.yaml`

## 参考

- [Template Rendering Complete Fix](./template-rendering-complete-fix.md)
- [YAML Numeric Name Final Solution](./yaml-numeric-name-final-solution.md)
