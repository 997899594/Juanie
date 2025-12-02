# Git Platform Integration - 代码实现修复方案

## 当前状态

- ✅ Schema 设计完美
- ✅ 数据库迁移已应用
- ⚠️ 代码实现有类型和调用问题

## 系统修复方案

### 1. 修复 GitSyncErrorService 调用

#### 问题分析
`startSync` 方法签名:
```typescript
async startSync(input: Omit<RecordSyncLogInput, 'status'>): Promise<string>
```

不接受 `status` 参数,因为它会自动设置为 `'pending'`。

#### 修复方案
所有 `startSync` 调用需要:
1. 移除 `status` 参数
2. 添加 `action` 参数
3. 添加 `provider` 参数  
4. 将 `triggeredBy` 放入 `metadata`

### 2. 修复 GitLab 权限类型

#### 问题分析
GitLab API 只接受特定的访问级别:
- 10: Guest
- 20: Reporter
- 30: Developer
- 40: Maintainer
- 50: Owner

#### 修复方案
确保 `mapOrgRoleToGitPermission` 返回正确的字面量类型。

### 3. 简化组织创建逻辑

#### 设计决策
- GitHub 个人账号无法通过 API 创建组织
- GitLab 可以创建 Group,但需要额外实现
- **当前阶段**: 暂时跳过自动创建,提示用户手动配置

#### 实现方案
```typescript
// 标记为需要手动配置
await this.db.update(schema.organizations).set({
  gitOrgId: gitOrgName,  // 使用名称作为占位符
  gitOrgUrl: `https://${gitProvider}.com/${gitOrgName}`,
  gitLastSyncAt: new Date(),
})
```

## 完整修复清单

### organization-sync.service.ts

#### 修复点 1: createGitOrganization
- [ ] 移除 `gitProviderOrgExtensions` 依赖
- [ ] 修复 `startSync` 调用
- [ ] 简化为标记逻辑

#### 修复点 2: addMemberToGitOrganization  
- [ ] 修复 `startSync` 调用
- [ ] 修复 GitLab 权限类型

#### 修复点 3: removeMemberFromGitOrganization
- [ ] 修复 `startSync` 调用

#### 修复点 4: updateMemberRoleInGitOrganization
- [ ] 修复 `startSync` 调用
- [ ] 修复 GitLab 权限类型

### organization-event-handler.service.ts

- [ ] 确保事件类型定义正确
- [ ] 确保队列任务参数正确

### git-sync.worker.ts

- [ ] 确保 worker 处理器参数正确
- [ ] 添加错误处理

## 实施步骤

1. **第一步**: 修复 startSync 调用(批量替换)
2. **第二步**: 修复 GitLab 权限类型
3. **第三步**: 简化组织创建逻辑
4. **第四步**: 测试编译
5. **第五步**: 继续任务 16

## 预期结果

修复后应该:
- ✅ 无编译错误
- ✅ 类型检查通过
- ✅ 核心同步逻辑可用
- ⚠️ 组织创建需要手动配置(后续优化)
