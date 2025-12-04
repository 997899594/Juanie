# 执行计划 - 完整重构方案

## 📋 总览

本文档提供完整的执行计划，按优先级和依赖关系组织所有重构任务。

## 🎯 目标

- **不创建新包** - 在现有包结构内优化
- **覆盖所有问题** - 架构、性能、安全、文档
- **可执行性** - 每个任务都有具体步骤和代码示例
- **可验证性** - 每个阶段都有验证标准

## 📊 优先级矩阵

| 优先级 | 任务 | 影响 | 工作量 | 风险 |
|--------|------|------|--------|------|
| P0 | 删除冗余服务 | 高 | 低 | 低 |
| P0 | 敏感信息加密 | 高 | 中 | 中 |
| P1 | 统一事件系统 | 中 | 中 | 低 |
| P1 | 数据库索引 | 高 | 低 | 低 |
| P1 | 软删除支持 | 中 | 低 | 低 |
| P2 | 缓存策略 | 高 | 中 | 低 |
| P2 | DataLoader | 高 | 中 | 低 |
| P2 | RBAC 完善 | 中 | 中 | 中 |
| P2 | 错误码系统 | 中 | 低 | 低 |
| P3 | 前端优化 | 中 | 中 | 低 |
| P3 | API 文档 | 低 | 中 | 低 |

## 🚀 执行时间线

### Week 1: 架构清理 + 安全加固

**Day 1-2: 架构清理**
- [ ] 删除 `HealthMonitorService`
- [ ] 删除 `ApprovalManagerService`
- [ ] 验证类型检查通过

**Day 3-5: 敏感信息加密**
- [ ] 实现 `EncryptedRepository`
- [ ] 创建 `CredentialRepository`
- [ ] 迁移现有数据
- [ ] 验证加密/解密

### Week 2: 数据库 + 事件系统

**Day 1-2: 数据库优化**
- [ ] 添加软删除字段
- [ ] 添加数据库索引
- [ ] 生成并应用迁移
- [ ] 性能测试

**Day 3-5: 统一事件系统**
- [ ] 安装 `@nestjs/event-emitter`
- [ ] 定义标准事件类型
- [ ] 迁移现有事件代码
- [ ] 验证事件流程

### Week 3: 性能优化

**Day 1-2: 缓存基础设施**
- [ ] 实现 `CacheService`
- [ ] 实现缓存装饰器
- [ ] 为热点查询添加缓存
- [ ] 验证缓存命中率

**Day 3-5: DataLoader**
- [ ] 实现 `DataLoaderService`
- [ ] 识别 N+1 查询
- [ ] 使用 DataLoader 重写
- [ ] 性能对比测试

### Week 4: 安全 + 文档

**Day 1-2: RBAC 完善**
- [ ] 定义权限枚举
- [ ] 实现权限装饰器
- [ ] 添加权限检查
- [ ] 验证权限控制

**Day 3-5: 文档标准化**
- [ ] 定义错误码系统
- [ ] 添加 JSDoc 注释
- [ ] 配置 tRPC Panel
- [ ] 生成 API 文档

## 📝 详细执行步骤

### Phase 1: 架构清理 (P0)

#### 1.1 删除 HealthMonitorService

**步骤**:
```bash
# 1. 删除文件
rm packages/services/business/src/projects/health-monitor.service.ts

# 2. 更新 projects.module.ts
# 移除 HealthMonitorService 的导入和 provider

# 3. 搜索所有引用
grep -r "HealthMonitorService" packages/

# 4. 更新引用使用 ProjectStatusService

# 5. 验证
bun run type-check
```

**验证标准**:
- ✅ 类型检查通过
- ✅ 无 HealthMonitorService 引用
- ✅ 所有测试通过

#### 1.2 删除 ApprovalManagerService

**步骤**:
```bash
# 1. 删除文件
rm packages/services/business/src/projects/approval-manager.service.ts

# 2. 从 index.ts 移除导出

# 3. 验证
bun run type-check
```

### Phase 2: 敏感信息加密 (P0)

**步骤**:
1. 创建 `EncryptedRepository` 基类
2. 实现 `CredentialRepository`
3. 更新所有使用凭证的代码
4. 编写数据迁移脚本
5. 在测试环境验证
6. 应用到生产环境

**验证标准**:
- ✅ 所有敏感字段加密存储
- ✅ 加密/解密功能正常
- ✅ 现有功能不受影响

### Phase 3: 数据库优化 (P1)

**步骤**:
1. 更新 Schema 添加 `deletedAt` 和索引
2. 生成迁移: `bun run db:generate`
3. 在测试环境应用: `bun run db:push`
4. 运行性能测试
5. 应用到生产环境

**验证标准**:
- ✅ 查询性能提升 50%+
- ✅ 软删除功能正常
- ✅ 索引正确使用

### Phase 4: 统一事件系统 (P1)

**步骤**:
1. 安装依赖: `bun add @nestjs/event-emitter`
2. 在 BusinessModule 注册
3. 定义标准事件类型
4. 迁移现有事件发送代码
5. 迁移现有事件监听代码

**验证标准**:
- ✅ 所有事件使用 EventEmitter2
- ✅ 事件命名标准化
- ✅ 事件流程正常工作

### Phase 5: 缓存策略 (P2)

**步骤**:
1. 实现 `CacheService`
2. 实现缓存装饰器
3. 识别热点查询
4. 添加缓存
5. 实现缓存失效策略

**验证标准**:
- ✅ 缓存命中率 80%+
- ✅ API 响应时间降低 50%+
- ✅ 缓存失效正常

### Phase 6: DataLoader (P2)

**步骤**:
1. 安装依赖: `bun add dataloader`
2. 实现 `DataLoaderService`
3. 识别 N+1 查询位置
4. 使用 DataLoader 重写
5. 性能测试

**验证标准**:
- ✅ N+1 查询完全消除
- ✅ 批量查询性能提升
- ✅ 功能正常

## 🔍 验证清单

### 每个 Phase 完成后

- [ ] 运行类型检查: `bun run type-check`
- [ ] 运行所有测试: `bun test`
- [ ] 手动测试关键流程
- [ ] 检查日志无错误
- [ ] 更新 CHANGELOG.md

### 全部完成后

- [ ] 性能基准测试
- [ ] 安全审计
- [ ] 代码审查
- [ ] 文档更新
- [ ] 部署到测试环境
- [ ] 用户验收测试
- [ ] 部署到生产环境

## 📊 预期效果总结

### 代码质量
- 删除 ~500 行冗余代码
- 类型安全性 100%
- 架构清晰度提升 80%

### 性能
- API 响应时间: 500ms → 100ms
- 查询性能: 提升 50-80%
- 前端首屏: 3s → 1s
- 包体积: 减少 40%

### 安全
- 敏感信息: 100% 加密
- 权限检查: 100% 覆盖
- 审计日志: 完整记录

### 文档
- API 文档: 100% 覆盖
- 错误码: 标准化
- 开发效率: 提升 30%

## 🔗 相关文档

- [架构优化方案](./01_ARCHITECTURE.md)
- [数据库优化方案](./02_DATABASE.md)
- [性能优化方案](./03_PERFORMANCE.md)
- [安全加固方案](./04_SECURITY.md)
- [文档标准化方案](./05_DOCUMENTATION.md)
- [方案总览](./SOLUTION_OVERVIEW.md)

## 📞 支持

如有问题，请参考：
- [故障排查文档](../README.md)
- [架构文档](../../ARCHITECTURE.md)
- [协作指南](../../../.kiro/steering/collaboration.md)
