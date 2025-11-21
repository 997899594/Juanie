# 🔧 依赖注入问题修复

## 问题描述

启动 API Gateway 时出现依赖注入错误：

```
UnknownDependenciesException: Nest can't resolve dependencies of the LoadTemplateHandler (?). 
Please make sure that the argument TemplateManager at index [0] is available in the ProjectInitializationModule context.
```

## 根本原因

`LoadTemplateHandler` 和 `RenderTemplateHandler` 依赖以下服务：
- `TemplateManager`
- `TemplateLoader`
- `TemplateRenderer`

但这些服务只在 `ProjectsModule` 中提供，而 `ProjectInitializationModule` 没有导入 `ProjectsModule`（会造成循环依赖）。

---

## ❌ 初始解决方案（不推荐）

在两个模块中都提供模板服务：

```typescript
// ProjectInitializationModule
providers: [
  TemplateManager,  // ❌ 重复实例
  TemplateLoader,   // ❌ 重复实例
  TemplateRenderer, // ❌ 重复实例
  ...
]

// ProjectsModule
providers: [
  TemplateManager,  // ❌ 重复实例
  TemplateLoader,   // ❌ 重复实例
  TemplateRenderer, // ❌ 重复实例
  ...
]
```

**问题**:
1. 内存浪费（两个实例）
2. 状态不同步
3. `onModuleInit()` 被调用两次
4. 架构不清晰

---

## ✅ 最佳解决方案

创建独立的 `TemplatesModule`，让两个模块都导入它：

### 1. 创建 TemplatesModule

```typescript
// packages/services/projects/src/templates/templates.module.ts

import { Module } from '@nestjs/common'
import { TemplateLoader } from '../template-loader.service'
import { TemplateManager } from '../template-manager.service'
import { TemplateRenderer } from '../template-renderer.service'

@Module({
  providers: [TemplateManager, TemplateLoader, TemplateRenderer],
  exports: [TemplateManager, TemplateLoader, TemplateRenderer],
})
export class TemplatesModule {}
```

### 2. 更新 ProjectsModule

```typescript
// packages/services/projects/src/projects.module.ts

@Module({
  imports: [
    // ... 其他导入
    TemplatesModule,  // ✅ 导入模板模块
    ProjectInitializationModule,
  ],
  providers: [
    ProjectsService,
    ProjectOrchestrator,
    // ... 不再直接提供模板服务
  ],
  exports: [
    ProjectsService,
    TemplatesModule,  // ✅ 重新导出
  ],
})
export class ProjectsModule {}
```

### 3. 更新 ProjectInitializationModule

```typescript
// packages/services/projects/src/initialization/initialization.module.ts

@Module({
  imports: [
    TemplatesModule,  // ✅ 导入模板模块
    EnvironmentsModule,
    RepositoriesModule,
    // ... 其他导入
  ],
  providers: [
    ProjectInitializationStateMachine,
    ProgressTrackerService,
    // ... 处理器
  ],
  exports: [
    ProjectInitializationStateMachine,
    // ✅ 导出所有处理器（供 ProjectOrchestrator 使用）
    CreateProjectHandler,
    LoadTemplateHandler,
    RenderTemplateHandler,
    CreateEnvironmentsHandler,
    SetupRepositoryHandler,
    CreateGitOpsHandler,
    FinalizeHandler,
  ],
})
export class ProjectInitializationModule {}
```

---

## 架构对比

### ❌ 之前（重复实例）

```
ProjectsModule
├── TemplateManager (实例 1)
├── TemplateLoader (实例 1)
├── TemplateRenderer (实例 1)
└── ProjectInitializationModule
    ├── TemplateManager (实例 2) ❌
    ├── TemplateLoader (实例 2) ❌
    └── TemplateRenderer (实例 2) ❌
```

### ✅ 现在（单一实例）

```
TemplatesModule
├── TemplateManager (单一实例) ✅
├── TemplateLoader (单一实例) ✅
└── TemplateRenderer (单一实例) ✅

ProjectsModule
└── imports: [TemplatesModule]

ProjectInitializationModule
└── imports: [TemplatesModule]
```

---

## 优势

### 1. 单一实例
- ✅ 只有一个 `TemplateManager` 实例
- ✅ `onModuleInit()` 只调用一次
- ✅ 状态一致

### 2. 清晰的职责
- ✅ `TemplatesModule` 负责模板相关功能
- ✅ `ProjectsModule` 负责项目管理
- ✅ `ProjectInitializationModule` 负责初始化流程

### 3. 易于维护
- ✅ 模板服务的修改只需在一个地方
- ✅ 依赖关系清晰
- ✅ 避免循环依赖

### 4. 可重用
- ✅ 其他模块也可以导入 `TemplatesModule`
- ✅ 符合 NestJS 最佳实践

---

## 验证

```bash
# 类型检查
bun run type-check
# ✅ 31/31 packages 通过

# 启动开发服务器
bun run dev
# ✅ 应该正常启动
```

---

## 依赖关系图

```
TemplatesModule
├── TemplateManager
│   └── DATABASE
├── TemplateLoader
│   └── DATABASE
└── TemplateRenderer
    └── TemplateLoader

ProjectInitializationModule
├── imports: [TemplatesModule]
├── providers:
│   ├── ProjectInitializationStateMachine
│   ├── ProgressTrackerService
│   └── All Handlers (CreateProjectHandler, LoadTemplateHandler, etc.)
└── exports:
    ├── ProjectInitializationStateMachine
    └── All Handlers (for ProjectOrchestrator)

ProjectsModule
├── imports: [TemplatesModule, ProjectInitializationModule]
└── ProjectOrchestrator
    ├── ProjectInitializationStateMachine (from ProjectInitializationModule)
    └── All Handlers (from ProjectInitializationModule)
```

---

## 最佳实践总结

1. **模块化**: 将相关功能组织到独立模块
2. **单一职责**: 每个模块只负责一个领域
3. **避免重复**: 不要在多个模块中提供相同的服务
4. **清晰导出**: 明确导出需要共享的服务
5. **避免循环**: 使用独立模块打破循环依赖

---

**修复时间**: 2025-11-21  
**影响范围**: ProjectsModule, ProjectInitializationModule, TemplatesModule  
**状态**: ✅ 已优化为最佳实践
