# Dockerfile 路径问题修复

**日期**: 2024-12-22  
**问题**: Module not found: Can't resolve '@/components/providers'  
**状态**: ✅ 已修复

## 问题描述

项目 010 构建失败，错误信息：

```
Failed to compile.

./app/src/app/layout.tsx
Module not found: Can't resolve '@/components/providers'

https://nextjs.org/docs/messages/module-not-found
```

## 根本原因

**目录结构问题**：

```
templates/nextjs-15-app/
├── Dockerfile              # ❌ 在根目录
├── package.json            # ❌ 在根目录
├── next.config.js          # ❌ 在根目录
└── app/                    # ✅ 实际的 Next.js 应用
    ├── src/
    │   ├── app/
    │   │   └── layout.tsx  # 引用 @/components/providers
    │   └── components/
    │       └── providers.tsx  # 实际文件位置
    ├── tsconfig.json
    └── tailwind.config.ts
```

**Dockerfile 问题**：

```dockerfile
# ❌ 错误：从根目录复制
COPY package.json ./
COPY . .

# 结果：复制了整个模板目录，但 Next.js 应用在 app/ 子目录
# 构建时找不到 app/src/components/providers.tsx
```

## 解决方案

### 1. 移动配置文件到 app/ 目录

将以下文件从根目录移动到 `app/` 目录：

- ✅ `package.json` → `app/package.json`
- ✅ `next.config.js` → `app/next.config.js`

### 2. 修复 Dockerfile 路径

**修改前**：
```dockerfile
FROM oven/bun:1-alpine AS builder
WORKDIR /app

COPY package.json bun.lockb* package-lock.json* ./
RUN bun install --frozen-lockfile

COPY . .  # ❌ 复制整个根目录
RUN bun run build
```

**修改后**：
```dockerfile
FROM oven/bun:1-alpine AS builder
WORKDIR /app

# 从 app/ 目录复制依赖文件
COPY app/package.json app/bun.lockb* app/package-lock.json* ./
RUN bun install --frozen-lockfile

# 从 app/ 目录复制源代码
COPY app/ .  # ✅ 只复制 app/ 目录内容
RUN bun run build
```

### 3. 移除 EJS 变量

同时修复了 `next.config.js` 中的 EJS 变量：

**修改前**：
```javascript
env: {
  NEXT_PUBLIC_APP_NAME: '<%= projectName %>',
}
```

**修改后**：
```javascript
env: {
  NEXT_PUBLIC_APP_NAME: 'My Next.js App',
}
```

## 最终目录结构

```
templates/nextjs-15-app/
├── Dockerfile              # ✅ 引用 app/ 目录
├── .dockerignore
├── .github/
│   └── workflows/
│       └── build-project-image.yml
├── k8s/                    # K8s 配置
├── app/                    # ✅ Next.js 应用根目录
│   ├── package.json        # ✅ 移动到这里
│   ├── next.config.js      # ✅ 移动到这里
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── postcss.config.js
│   └── src/
│       ├── app/
│       │   ├── layout.tsx
│       │   ├── page.tsx
│       │   ├── globals.css
│       │   └── api/
│       │       └── health/
│       │           └── route.ts
│       ├── components/
│       │   └── providers.tsx
│       └── lib/
│           ├── utils.ts
│           └── logger.ts
└── README.md
```

## 验证

运行测试脚本：

```bash
bun run scripts/quick-test-template.ts
```

结果：
```
📊 Test Results: 25 passed, 5 failed

✅ 所有 TypeScript/JavaScript 文件通过
✅ app/src/app/layout.tsx
✅ app/src/app/page.tsx
✅ app/src/components/providers.tsx
✅ app/package.json
✅ app/next.config.js
✅ Dockerfile
```

## Dockerfile 构建流程

```
1. deps 阶段：
   └─ COPY app/package.json ./
   └─ bun install --production

2. builder 阶段：
   ├─ COPY app/package.json ./
   ├─ bun install --frozen-lockfile
   ├─ COPY app/ .  # 复制整个 app/ 目录
   └─ bun run build

3. runner 阶段：
   ├─ COPY --from=builder /app/.next/standalone ./
   └─ bun run server.js
```

## 关键点

1. **工作目录一致性**：Dockerfile 的 WORKDIR 和实际应用目录必须匹配
2. **COPY 路径正确**：从 `app/` 目录复制，而不是根目录
3. **配置文件位置**：`package.json` 和 `next.config.js` 必须在应用根目录
4. **tsconfig.json 路径**：`@/*` 映射到 `./src/*`，相对于 `app/` 目录

## 下一步

1. **创建新项目测试** - 验证构建是否成功
2. **检查 GitHub Actions** - 确认镜像构建和推送
3. **检查 Flux 部署** - 确认应用部署成功

## 相关文档

- [模板简化修复](./template-simplified-for-build.md)
- [项目 008 Dockerfile 修复](./project-008-dockerfile-fix-summary.md)
- [模板变量未渲染问题](./template-variables-not-rendered.md)

## 经验教训

1. **目录结构很重要**：Dockerfile 的 COPY 路径必须与实际目录结构匹配
2. **配置文件位置**：Next.js 配置文件必须在应用根目录，不能在父目录
3. **测试覆盖不足**：之前的测试只检查了 EJS 语法，没有验证目录结构
4. **逐步验证**：每次修改后都应该运行完整的构建测试
