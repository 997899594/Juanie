# Monorepo + Turborepo 现代化工程架构

## 什么是 Monorepo？

### 传统多仓库（Polyrepo）的问题

```
项目结构：
my-company/
├── frontend-web/          # 前端仓库
├── frontend-mobile/       # 移动端仓库
├── backend-api/           # 后端仓库
├── shared-types/          # 共享类型仓库
├── shared-utils/          # 工具库仓库
└── shared-components/     # 组件库仓库
```

**问题**：
- ❌ **依赖地狱** - 更新一个包，需要更新所有依赖它的仓库
- ❌ **版本不一致** - 不同仓库使用不同版本的依赖
- ❌ **重复工作** - 每个仓库都要配置 CI/CD、ESLint、TypeScript
- ❌ **跨仓库重构困难** - 改了 API，前端不知道
- ❌ **发布复杂** - 需要按顺序发布多个包

### Monorepo 的解决方案

```
单一仓库：
Juanie/
├── apps/                  # 应用
│   ├── web/              # Web 前端
│   ├── mobile/           # 移动端
│   └── api-gateway/      # API 网关
├── packages/             # 共享包
│   ├── ui/               # UI 组件库
│   ├── core/             # 核心包
│   └── services/         # 业务服务
└── tools/                # 工具配置
    ├── eslint-config/
    └── tsconfig/
```

**优势**：
- ✅ **统一依赖管理** - 一个 package.json 管理所有依赖
- ✅ **原子性提交** - 一次提交可以修改多个包
- ✅ **共享配置** - ESLint、TypeScript 配置复用
- ✅ **类型安全** - 跨包类型检查
- ✅ **简化 CI/CD** - 一套流水线构建所有包

---

## 为什么选择 Turborepo？

### 传统 Monorepo 工具对比

| 工具 | 优势 | 劣势 | 适用场景 |
|------|------|------|----------|
| **Lerna** | 成熟稳定 | 构建慢，配置复杂 | 传统 JS 项目 |
| **Nx** | 功能强大 | 学习成本高，配置复杂 | 大型企业项目 |
| **Rush** | 企业级 | 过于复杂 | 微软生态 |
| **Turborepo** | 简单快速 | 相对较新 | 现代 TS 项目 |

### Turborepo 的核心优势

**1. 极速构建**
```bash
# 传统方式：串行构建
npm run build:core
npm run build:ui
npm run build:web
# 总时间：30s + 20s + 40s = 90s

# Turborepo：并行构建 + 缓存
turbo build
# 首次：30s（并行）
# 再次：0s（缓存命中）
```

**2. 智能缓存**
```bash
# 只有变化的包才重新构建
# 未变化的包直接使用缓存
turbo build --filter=changed
```

**3. 依赖感知**
```bash
# 自动按依赖顺序构建
# core → ui → web
turbo build
```

---

## 项目架构深度解析

### 1. 目录结构设计

```
Juanie/
├── apps/                           # 应用层
│   ├── web/                       # Vue 3 前端应用
│   │   ├── src/
│   │   ├── package.json
│   │   └── vite.config.ts
│   ├── api-gateway/               # NestJS API 网关
│   │   ├── src/
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── api-ai/                    # AI 服务（未来）
│       ├── src/
│       └── package.json
├── packages/                       # 共享包
│   ├── ui/                        # UI 组件库
│   │   ├── src/components/
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── core/                      # 核心基础包
│   │   ├── database/              # 数据库 Schema
│   │   ├── types/                 # 类型定义
│   │   ├── queue/                 # 队列系统
│   │   ├── tokens/                # DI Token
│   │   └── utils/                 # 工具函数
│   └── services/                  # 业务服务包
│       ├── foundation/            # 基础服务
│       ├── business/              # 业务服务
│       └── extensions/            # 扩展服务
├── tools/                          # 工具配置
│   ├── eslint-config/             # ESLint 配置
│   ├── tsconfig/                  # TypeScript 配置
│   └── tailwind-config/           # Tailwind 配置
├── scripts/                        # 脚本
├── docs/                          # 文档
├── package.json                   # 根 package.json
├── turbo.json                     # Turborepo 配置
└── bun.lock                       # Bun 锁文件
```

### 2. 包命名规范

```json
{
  "name": "@juanie/core-database",     // 核心包
  "name": "@juanie/service-foundation", // 服务包
  "name": "@juanie/ui",                // UI 包
  "name": "@juanie/web",               // 应用包
  "name": "@juanie/api-gateway"        // 应用包
}
```

**命名规则**：
- `@juanie/` - 统一命名空间
- `core-*` - 核心基础包
- `service-*` - 业务服务包
- 应用直接用功能名

### 3. 依赖关系图

```
┌─────────────────────────────────────┐
│              Apps                   │
│  ┌─────────┐ ┌─────────┐ ┌────────┐ │
│  │   Web   │ │ API-GW  │ │ API-AI │ │
│  └─────────┘ └─────────┘ └────────┘ │
└──────────────┬────────────────────────┘
               │ 依赖
┌──────────────▼────────────────────────┐
│            Packages                   │
│  ┌─────────┐ ┌─────────────────────┐  │
│  │   UI    │ │      Services       │  │
│  └─────────┘ │  ┌───┐ ┌───┐ ┌───┐  │  │
│              │  │ F │ │ B │ │ E │  │  │
│              │  └───┘ └───┘ └───┘  │  │
│              └─────────────────────┘  │
└──────────────┬────────────────────────┘
               │ 依赖
┌──────────────▼────────────────────────┐
│              Core                     │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐  │
│  │ DB │ │Type│ │Que │ │Tok │ │Util│  │
│  └────┘ └────┘ └────┘ └────┘ └────┘  │
└───────────────────────────────────────┘
```

---

## Turborepo 配置详解

### 1. 根配置文件

**package.json**:
```json
{
  "name": "juanie",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*/*",
    "tools/*"
  ],
  "scripts": {
    "build": "turbo build",
    "dev": "turbo dev",
    "lint": "turbo lint",
    "test": "turbo test",
    "clean": "turbo clean"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.0.0",
    "@juanie/config-typescript": "workspace:*"
  }
}
```

**turbo.json**:
```json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"],
      "inputs": ["src/**/*.tsx", "src/**/*.ts", "test/**/*.ts"]
    },
    "clean": {
      "cache": false
    }
  },
  "globalDependencies": [
    "**/.env.*local"
  ]
}
```

### 2. 任务管道（Pipeline）详解

**依赖关系**：
```json
{
  "build": {
    "dependsOn": ["^build"],  // ^ 表示依赖包先构建
    "outputs": ["dist/**"]    // 输出目录，用于缓存
  }
}
```

**执行顺序**：
```
1. core packages build (并行)
   ├── @juanie/core-database
   ├── @juanie/core-types
   └── @juanie/core-utils

2. service packages build (并行)
   ├── @juanie/service-foundation
   ├── @juanie/service-business
   └── @juanie/service-extensions

3. ui package build
   └── @juanie/ui

4. apps build (并行)
   ├── @juanie/web
   └── @juanie/api-gateway
```

### 3. 缓存策略

**输入哈希**：
```
文件内容 + 依赖版本 + 环境变量 = 输入哈希
```

**缓存命中条件**：
```
如果输入哈希相同 → 使用缓存
如果输入哈希不同 → 重新构建
```

**示例**：
```bash
# 第一次构建
$ turbo build
• Packages in scope: 12
• Running build in 12 packages

@juanie/core-types:build: cache miss, executing
@juanie/core-database:build: cache miss, executing

Tasks:    12 successful, 12 total
Cached:    0 cached, 12 total
Time:    45.2s

# 第二次构建（无变化）
$ turbo build

@juanie/core-types:build: cache hit, replaying logs
@juanie/core-database:build: cache hit, replaying logs

Tasks:    12 successful, 12 total
Cached:   12 cached, 12 total
Time:    1.2s  ⚡ 37x faster
```

---

## 开发工作流

### 1. 本地开发

**启动所有服务**：
```bash
# 并行启动所有 dev 服务
bun run dev

# 输出：
@juanie/api-gateway:dev: Server running on http://localhost:3000
@juanie/web:dev: Local: http://localhost:5173
```

**只启动特定包**：
```bash
# 只启动 web 和它的依赖
turbo dev --filter=@juanie/web

# 只启动 api-gateway
turbo dev --filter=@juanie/api-gateway
```

### 2. 构建优化

**增量构建**：
```bash
# 只构建变化的包
turbo build --filter=[HEAD^1]

# 只构建特定包及其依赖
turbo build --filter=@juanie/web...

# 只构建依赖特定包的包
turbo build --filter=...@juanie/core-types
```

**并行构建**：
```bash
# 最大并行数
turbo build --concurrency=4

# 无限制并行
turbo build --concurrency=100%
```

---

## 最佳实践

### 1. 包设计原则

**单一职责**：
```
❌ 错误：@juanie/utils（包含所有工具函数）
✅ 正确：
  - @juanie/core-utils（核心工具）
  - @juanie/date-utils（日期工具）
  - @juanie/validation-utils（验证工具）
```

**依赖方向**：
```
✅ 正确：apps → packages → core
❌ 错误：core → packages（循环依赖）
```

### 2. 性能监控

**构建时间分析**：
```bash
# 生成构建报告
turbo build --summarize

# 查看详细时间
turbo build --profile
```

---

## 总结

### Monorepo + Turborepo 的价值

1. **开发效率** - 统一工具链，减少重复配置
2. **构建性能** - 智能缓存，增量构建
3. **代码质量** - 统一标准，跨包类型检查
4. **团队协作** - 原子性提交，简化发布
5. **维护成本** - 集中管理，减少维护负担

### 适用场景

✅ **适合**：
- 多个相关项目
- 共享代码较多
- 团队规模中等
- 重视开发体验

❌ **不适合**：
- 单一简单项目
- 完全独立的项目
- 小型团队（1-2人）

**Turborepo 让 Monorepo 管理变得简单高效！**
