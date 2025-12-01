# 依赖升级计划

## 概述

本文档列出了项目中所有需要升级的依赖包。

**生成时间**: 2024-11-27  
**检查方式**: 对比当前版本与 npm 最新版本

## 图例

- ✅ **已是最新** - 当前版本已是最新稳定版
- ⬆️ **可升级** - 有新版本可用
- ❓ **未知** - 无法获取最新版本信息

## 根目录依赖

### 需要升级的包

| 包名 | 当前版本 | 最新版本 | 类型 | 优先级 |
|------|---------|---------|------|--------|
| @dotenvx/dotenvx | ^1.51.0 | 1.51.1 | 工具 | 低 |
| @opentelemetry/auto-instrumentations-node | ^0.65.0 | 0.67.2 | 监控 | 中 |
| @opentelemetry/exporter-jaeger | ^2.1.0 | 2.2.0 | 监控 | 中 |
| @biomejs/biome | ^2.2.5 | 2.3.7 | 工具 | 中 |
| @tailwindcss/vite | ^4.1.14 | 4.1.17 | 样式 | 中 |
| @trpc/client | ^11.6.0 | 11.7.2 | API | 中 |
| @types/node | ^24.7.0 | 24.10.1 | 类型 | 低 |
| @vitejs/plugin-vue | ^6.0.1 | 6.0.2 | 构建 | 低 |
| @vitest/coverage-v8 | ^4.0.4 | 4.0.14 | 测试 | 中 |
| @vitest/ui | ^4.0.4 | 4.0.14 | 测试 | 中 |
| @vueuse/components | ^13.9.0 | 14.1.0 | UI | 高 |
| @vueuse/core | ^13.9.0 | 14.1.0 | UI | 高 |
| axios | ^1.12.2 | 1.13.2 | HTTP | 中 |
| dayjs | ^1.11.18 | 1.11.19 | 工具 | 低 |
| drizzle-kit | ^0.31.5 | 0.31.7 | 数据库 | 中 |
| lint-staged | 16.2.3 | 16.2.7 | 工具 | 低 |
| lucide-vue-next | ^0.544.0 | 0.555.0 | 图标 | 低 |
| pinia | ^3.0.3 | 3.0.4 | 状态 | 中 |
| tailwindcss | ^4.1.14 | 4.1.17 | 样式 | 中 |
| turbo | ^2.5.8 | 2.6.1 | 构建 | 中 |
| unplugin-auto-import | ^20.2.0 | 20.3.0 | 构建 | 低 |
| unplugin-vue-components | ^29.1.0 | 30.0.0 | 构建 | 中 |
| vitest | ^4.0.4 | 4.0.14 | 测试 | 中 |
| vue | ^3.5.22 | 3.5.25 | 框架 | 高 |
| vue-router | ^4.5.1 | 4.6.3 | 路由 | 高 |
| vue-tsc | ^3.1.1 | 3.1.5 | 类型 | 低 |
| zod | ^4.1.12 | 4.1.13 | 验证 | 低 |

### 已是最新的包

- @badrap/result: 0.3.1 ✅
- @nestjs/event-emitter: 3.0.1 ✅
- @opentelemetry/api: 1.9.0 ✅
- drizzle-orm: 0.44.7 ✅
- postgres: 3.4.7 ✅
- @changesets/cli: 2.29.7 ✅
- @types/lodash-es: 4.17.12 ✅
- @types/nprogress: 0.2.3 ✅
- @vue/tsconfig: 0.8.1 ✅
- echarts: 6.0.0 ✅
- estree-walker: 3.0.3 ✅
- husky: 9.1.7 ✅
- lodash-es: 4.17.21 ✅
- nprogress: 0.2.0 ✅
- typescript: 5.9.3 ✅
- vite-plugin-dts: 4.5.4 ✅

## API Gateway 依赖

### 需要升级的包

| 包名 | 当前版本 | 最新版本 | 类型 | 优先级 |
|------|---------|---------|------|--------|
| @nestjs/common | ^11.1.7 | 11.1.9 | 框架 | 高 |
| @nestjs/core | ^11.1.7 | 11.1.9 | 框架 | 高 |
| @nestjs/platform-fastify | ^11.1.7 | 11.1.9 | 框架 | 高 |
| @trpc/server | ^11.7.1 | 11.7.2 | API | 中 |
| fastify | ^5.2.0 | 5.6.2 | 服务器 | 高 |
| ioredis | ^5.4.2 | 5.8.2 | 数据库 | 中 |
| @opentelemetry/auto-instrumentations-node | ^0.67.0 | 0.67.2 | 监控 | 低 |
| @opentelemetry/exporter-prometheus | ^0.56.0 | 0.208.0 | 监控 | 高 |
| @opentelemetry/exporter-trace-otlp-http | ^0.56.0 | 0.208.0 | 监控 | 高 |
| @opentelemetry/resources | ^1.29.0 | 2.2.0 | 监控 | 高 |
| @opentelemetry/sdk-node | ^0.56.0 | 0.208.0 | 监控 | 高 |
| @opentelemetry/semantic-conventions | ^1.29.0 | 1.38.0 | 监控 | 中 |
| @types/node | ^24.7.0 | 24.10.1 | 类型 | 低 |
| vitest | ^4.0.4 | 4.0.14 | 测试 | 中 |

### 已是最新的包

- @fastify/cookie: 11.0.2 ✅
- @fastify/cors: 11.1.0 ✅
- @fastify/csrf-protection: 7.1.0 ✅
- @fastify/rate-limit: 10.3.0 ✅
- @fastify/sse: 0.4.0 ✅
- @nestjs/config: 4.0.2 ✅
- drizzle-orm: 0.44.7 ✅
- postgres: 3.4.7 ✅
- reflect-metadata: 0.2.2 ✅
- @opentelemetry/api: 1.9.0 ✅
- typescript: 5.9.3 ✅

## Web 前端依赖

### 需要升级的包

| 包名 | 当前版本 | 最新版本 | 类型 | 优先级 |
|------|---------|---------|------|--------|
| @trpc/client | ^11.0.0 | 11.7.2 | API | 高 |
| @vueuse/core | ^11.3.0 | 14.1.0 | 工具 | 高 |
| lucide-vue-next | ^0.544.0 | 0.555.0 | 图标 | 低 |
| pinia-plugin-persistedstate | ^4.1.3 | 4.7.1 | 状态 | 中 |
| vue | ^3.5.22 | 3.5.25 | 框架 | 高 |
| vue-router | ^4.5.1 | 4.6.3 | 路由 | 高 |
| @tailwindcss/vite | ^4.1.14 | 4.1.17 | 样式 | 中 |
| @vitejs/plugin-vue | ^6.0.1 | 6.0.2 | 构建 | 低 |
| tailwindcss | ^4.1.14 | 4.1.17 | 样式 | 中 |

### 已是最新的包

- @vueuse/motion: 3.0.3 ✅
- date-fns: 4.1.0 ✅
- tslib: 2.8.1 ✅
- vue-sonner: 2.0.9 ✅
- @vue/tsconfig: 0.8.1 ✅
- typescript: 5.9.3 ✅

## Business 服务依赖

### 需要升级的包

| 包名 | 当前版本 | 最新版本 | 类型 | 优先级 |
|------|---------|---------|------|--------|
| @kubernetes/client-node | ^1.0.0 | 1.4.0 | K8s | ✅ 已升级 |

**注意**: @kubernetes/client-node 已在本次重构中升级并适配新 API。

## 升级优先级说明

### 高优先级 (建议立即升级)

这些包的升级包含重要的功能改进或安全修复:

1. **Vue 生态系统**
   - vue: 3.5.22 → 3.5.25
   - vue-router: 4.5.1 → 4.6.3
   - @vueuse/core: 13.9.0 → 14.1.0 (大版本升级)
   - @vueuse/components: 13.9.0 → 14.1.0 (大版本升级)

2. **NestJS 框架**
   - @nestjs/common: 11.1.7 → 11.1.9
   - @nestjs/core: 11.1.7 → 11.1.9
   - @nestjs/platform-fastify: 11.1.7 → 11.1.9

3. **Fastify 服务器**
   - fastify: 5.2.0 → 5.6.2

4. **OpenTelemetry (监控)**
   - @opentelemetry/exporter-prometheus: 0.56.0 → 0.208.0 (大版本升级)
   - @opentelemetry/exporter-trace-otlp-http: 0.56.0 → 0.208.0 (大版本升级)
   - @opentelemetry/resources: 1.29.0 → 2.2.0 (大版本升级)
   - @opentelemetry/sdk-node: 0.56.0 → 0.208.0 (大版本升级)

5. **tRPC**
   - @trpc/client: 11.0.0/11.6.0 → 11.7.2
   - @trpc/server: 11.7.1 → 11.7.2

### 中优先级 (建议近期升级)

这些包的升级包含功能改进和 bug 修复:

1. **构建工具**
   - turbo: 2.5.8 → 2.6.1
   - unplugin-vue-components: 29.1.0 → 30.0.0 (大版本升级)

2. **测试工具**
   - vitest: 4.0.4 → 4.0.14
   - @vitest/coverage-v8: 4.0.4 → 4.0.14
   - @vitest/ui: 4.0.4 → 4.0.14

3. **样式工具**
   - tailwindcss: 4.1.14 → 4.1.17
   - @tailwindcss/vite: 4.1.14 → 4.1.17

4. **数据库工具**
   - drizzle-kit: 0.31.5 → 0.31.7
   - ioredis: 5.4.2 → 5.8.2

5. **状态管理**
   - pinia: 3.0.3 → 3.0.4
   - pinia-plugin-persistedstate: 4.1.3 → 4.7.1

6. **HTTP 客户端**
   - axios: 1.12.2 → 1.13.2

7. **代码质量**
   - @biomejs/biome: 2.2.5 → 2.3.7

### 低优先级 (可选升级)

这些包的升级主要是小版本更新:

- @types/node: 24.7.0 → 24.10.1
- dayjs: 1.11.18 → 1.11.19
- lucide-vue-next: 0.544.0 → 0.555.0
- vue-tsc: 3.1.1 → 3.1.5
- zod: 4.1.12 → 4.1.13
- lint-staged: 16.2.3 → 16.2.7
- unplugin-auto-import: 20.2.0 → 20.3.0
- @vitejs/plugin-vue: 6.0.1 → 6.0.2
- @dotenvx/dotenvx: 1.51.0 → 1.51.1

## 升级建议

### 第一阶段: 核心框架 (高优先级)

```bash
# Vue 生态系统
bun update vue@latest vue-router@latest
bun update @vueuse/core@latest @vueuse/components@latest

# NestJS 框架
bun update @nestjs/common@latest @nestjs/core@latest @nestjs/platform-fastify@latest

# Fastify
bun update fastify@latest

# tRPC
bun update @trpc/client@latest @trpc/server@latest
```

### 第二阶段: OpenTelemetry (高优先级,需要测试)

```bash
# OpenTelemetry - 大版本升级,需要仔细测试
bun update @opentelemetry/exporter-prometheus@latest
bun update @opentelemetry/exporter-trace-otlp-http@latest
bun update @opentelemetry/resources@latest
bun update @opentelemetry/sdk-node@latest
bun update @opentelemetry/semantic-conventions@latest
bun update @opentelemetry/auto-instrumentations-node@latest
```

**注意**: OpenTelemetry 包有大版本升级 (0.x → 0.2x 和 1.x → 2.x),可能有破坏性变更,需要:
1. 查看 CHANGELOG
2. 更新配置代码
3. 充分测试监控功能

### 第三阶段: 构建和测试工具 (中优先级)

```bash
# 构建工具
bun update turbo@latest
bun update unplugin-vue-components@latest

# 测试工具
bun update vitest@latest @vitest/coverage-v8@latest @vitest/ui@latest

# 样式工具
bun update tailwindcss@latest @tailwindcss/vite@latest

# 数据库
bun update drizzle-kit@latest ioredis@latest

# 状态管理
bun update pinia@latest pinia-plugin-persistedstate@latest

# HTTP
bun update axios@latest

# 代码质量
bun update @biomejs/biome@latest
```

### 第四阶段: 其他依赖 (低优先级)

```bash
# 一次性更新所有低优先级依赖
bun update @types/node@latest dayjs@latest lucide-vue-next@latest \
  vue-tsc@latest zod@latest lint-staged@latest \
  unplugin-auto-import@latest @vitejs/plugin-vue@latest \
  @dotenvx/dotenvx@latest
```

## 升级注意事项

### 大版本升级需要特别注意

1. **@vueuse/core: 13.x → 14.x**
   - 查看 [VueUse 更新日志](https://github.com/vueuse/vueuse/releases)
   - 可能有 API 变更

2. **unplugin-vue-components: 29.x → 30.x**
   - 查看更新日志
   - 测试组件自动导入功能

3. **OpenTelemetry 包: 0.56.x → 0.208.x**
   - 重大版本跳跃
   - 需要仔细测试监控功能
   - 可能需要更新配置

4. **@opentelemetry/resources: 1.x → 2.x**
   - 大版本升级
   - 检查 API 变更

### 升级流程建议

1. **创建升级分支**
   ```bash
   git checkout -b feat/dependency-upgrade
   ```

2. **分阶段升级**
   - 按优先级分阶段升级
   - 每个阶段后运行测试

3. **运行测试**
   ```bash
   bun run type-check
   bun run test
   bun run build
   ```

4. **手动测试**
   - 启动开发服务器
   - 测试关键功能
   - 检查监控数据

5. **提交变更**
   ```bash
   git add .
   git commit -m "chore: upgrade dependencies to latest versions"
   ```

## 已完成的升级

- ✅ @kubernetes/client-node: 适配 1.4.0 新 API (2024-11-27)

## 总结

- **总计需要升级**: 约 50+ 个包
- **高优先级**: 15 个包
- **中优先级**: 20 个包
- **低优先级**: 15 个包

建议按阶段逐步升级,每个阶段后进行充分测试,确保系统稳定性。
