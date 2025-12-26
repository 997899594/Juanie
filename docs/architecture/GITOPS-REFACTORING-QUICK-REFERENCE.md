# GitOps 模块重构快速参考

**日期**: 2025-12-25  
**状态**: ✅ P0 完成

---

## 🎯 一句话总结

删除了 586 行无用代码，移动了 615 行错位代码，GitOps 模块现在充分利用 Core 层能力，架构更清晰。

---

## 📊 数字

- **优化代码**: 1,201 行 (17.2%)
- **删除死代码**: 376 行
- **删除重复代码**: 180 行
- **删除无意义委托**: 30 行
- **移动错位代码**: 615 行

---

## ✅ 完成的任务

1. ✅ 删除 Credentials 模块（376 行死代码）
2. ✅ 移动 YamlGeneratorService 到 Core 层（615 行）
3. ✅ 删除 FluxResourcesService K8s 方法（180 行）
4. ✅ 删除 FluxSyncService 简单委托（30 行）

---

## 🔧 如何使用新架构

### Before (旧代码)

```typescript
// ❌ 错误：使用 Business 层的重复实现
await this.fluxResources.applyYAMLToK3s(yaml)
await this.fluxSync.triggerReconciliation(kind, name, namespace)
```

### After (新代码)

```typescript
// ✅ 正确：直接使用 Core 层服务
import { K8sClientService } from '@juanie/core/k8s'
import { FluxCliService } from '@juanie/core/flux'
import { YamlGeneratorService } from '@juanie/core/flux'

// 应用 YAML
const resource = this.yamlGenerator.parseYAML(yaml)
await this.k8s.patchNamespacedCustomObject({ ... })

// 触发 reconciliation
await this.fluxCli.reconcile(kind, name, namespace)
```

---

## 📁 导入路径变更

### YamlGeneratorService

```typescript
// ❌ Before
import { YamlGeneratorService } from './yaml-generator.service'

// ✅ After
import { YamlGeneratorService } from '@juanie/core/flux'
```

### K8s 操作

```typescript
// ❌ Before
await this.applyYAMLToK3s(yaml)

// ✅ After
import { K8sClientService } from '@juanie/core/k8s'
await this.k8s.patchNamespacedCustomObject({ ... })
```

### Flux 操作

```typescript
// ❌ Before
await this.fluxSync.triggerReconciliation(kind, name, namespace)

// ✅ After
import { FluxCliService } from '@juanie/core/flux'
await this.fluxCli.reconcile(kind, name, namespace)
```

---

## 🏗️ 新架构

```
packages/core/src/
├── flux/
│   ├── flux-cli.service.ts        ← Flux CLI 操作
│   ├── yaml-generator.service.ts  ← YAML 生成工具
│   └── flux.module.ts
└── k8s/
    ├── k8s-client.service.ts      ← K8s 操作
    └── k8s.module.ts

packages/services/business/src/gitops/
└── flux/
    ├── flux-resources.service.ts  ← 纯业务逻辑
    ├── flux-sync.service.ts       ← 纯业务逻辑
    └── flux-metrics.service.ts    ← 业务指标
```

---

## 🚫 已删除的代码

### 不要再使用这些

- ❌ `CredentialsModule` - 已删除（死代码）
- ❌ `CredentialStrategyService` - 已删除（死代码）
- ❌ `FluxResourcesService.applyYAMLToK3s()` - 已删除（重复代码）
- ❌ `FluxResourcesService.deleteK3sResource()` - 已删除（重复代码）
- ❌ `FluxResourcesService.applyK3sResource()` - 已删除（重复代码）
- ❌ `FluxSyncService.triggerReconciliation()` - 已删除（无意义委托）

### 使用这些替代

- ✅ `GitConnectionsService` - 凭证管理（Foundation 层）
- ✅ `K8sClientService` - K8s 操作（Core 层）
- ✅ `FluxCliService` - Flux CLI 操作（Core 层）
- ✅ `YamlGeneratorService` - YAML 生成（Core 层）

---

## 📚 相关文档

- [完整总结](./GITOPS-REFACTORING-SUMMARY.md)
- [P0 完成报告](./GITOPS-REFACTORING-P0-COMPLETE.md)
- [完整审计报告](./GITOPS-MODULE-CORE-DUPLICATION-AUDIT-FINAL.md)
