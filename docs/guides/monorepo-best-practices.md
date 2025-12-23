# Bun + Turborepo Monorepo 最佳实践

## 核心理念：单一依赖树 (Single Dependency Tree)

### 什么是单一依赖树？

**单一依赖树**意味着：
- ✅ **所有依赖只安装在根 `node_modules`**
- ✅ **子包（packages/apps）没有独立的 node_modules**
- ✅ **Bun 自动分析所有子包的 package.json，提取公共依赖**
- ✅ **使用 `resolutions` 强制版本统一**

### 为什么单一依赖树是最佳实践？

#### 1. **性能提升**
```
传统 Monorepo (多依赖树):
├── node_modules/          (500MB)
├── packages/core/node_modules/     (200MB)
├── packages/business/node_modules/ (300MB)
└── apps/api-gateway/node_modules/  (400MB)
总计: 1.4GB, 安装时间 60s

单一依赖树:
└── node_modules/          (600MB)
总计: 600MB, 安装时间 15s
```

**节省 57% 磁盘空间，75% 安装时间**

#### 2. **版本一致性**
```typescript
// ❌ 多依赖树：版本冲突
packages/core/node_modules/@nestjs/config@3.3.0
packages/business/node_modules/@nestjs/config@4.0.2
// 结果：运行时错误，类型不匹配

// ✅ 单一依赖树：版本统一
node_modules/@nestjs/config@4.0.2
// 结果：完美运行，类型一致
```

#### 3. **TypeScript 编译速度**
- 单一依赖树：TypeScript 只扫描一个 `node_modules`
- 多依赖树：TypeScript 需要扫描多个 `node_modules`，处理版本冲突
- **编译速度提升 40-60%**

#### 4. **开发体验**
```bash
# ❌ 多依赖树：需要在每个包中安装
cd packages/core && bun install
cd packages/business && bun install
cd apps/api-gateway && bun install

# ✅ 单一依赖树：只需在根目录安装
bun install  # 自动处理所有子包
```

## 核心配置

### 1. 依赖版本统一 (resolutions)

**问题**: Monorepo 中不同包可能安装不同版本的依赖，导致构建失败或运行时错误。

**解决方案**: 在根 `package.json` 中使用 `resolutions` 字段强制统一版本：

```json
{
  "resolutions": {
    "@nestjs/common": "^11.1.7",
    "@nestjs/core": "^11.1.7",
    "@nestjs/config": "^4.0.2",
    "typescript": "^5.9.3",
    "drizzle-orm": "0.45.0"
  }
}
```

**效果**: 
- 所有子包使用相同版本的关键依赖
- 避免 Bun 构建时的 `dist` 目录缺失问题
- 减少 node_modules 体积

### 2. Bun 配置优化 (bunfig.toml)

```toml
[install]
# 完全提升依赖到根目录
hoisting = true
flattenWorkspace = true
# 使用硬链接提升性能
strategy = "hardlink"
# 不创建符号链接（避免文件监听问题）
symlink = false
linkNativeModules = false
# 自动安装 peer dependencies
auto = "auto"

[install.cache]
# 启用缓存加速安装
dir = ".bun-cache"
ttl = 604800

[run]
# 精确控制文件监听范围
watchExclude = [
  "node_modules/**",
  "dist/**",
  ".turbo/**"
]
watchInclude = [
  "src/**",
  "packages/*/src/**",
  "apps/*/src/**"
]
# 启用热重载
hot = true
```

**关键点**:
- `hoisting = true` + `flattenWorkspace = true`: 所有依赖提升到根 node_modules
- `symlink = false`: 避免 Bun 文件监听警告
- `strategy = "hardlink"`: 比符号链接更快
- 精确的 `watchExclude/watchInclude`: 减少文件监听开销

### 3. Turbo 缓存优化 (turbo.json)

```json
{
  "experimentalSpaces": {
    "id": "juanie-monorepo"
  },
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": [
        "$TURBO_DEFAULT$",
        ".env*",
        "!**/*.test.ts",
        "!**/*.spec.ts"
      ],
      "outputs": ["dist/**"],
      "outputLogs": "new-only",
      "cache": true
    },
    "dev": {
      "dependsOn": ["^build:packages"],
      "cache": false,
      "persistent": true
    }
  }
}
```

**关键优化**:
- `inputs` 排除测试文件: 测试变更不触发构建缓存失效
- `outputLogs: "new-only"`: 只显示新的日志，减少噪音
- `dependsOn: ["^build:packages"]`: dev 依赖包构建，不依赖 app 构建
- `persistent: true`: dev 任务持续运行

### 4. NPM 配置 (.npmrc)

```ini
# 自动安装 peer dependencies
auto-install-peers=true
strict-peer-dependencies=false

# 提升所有依赖
shamefully-hoist=true

# 优先使用 workspace 包
prefer-workspace-packages=true
link-workspace-packages=true

# 缓存目录
cache-dir=.bun-cache
```

## 依赖管理策略

### 共享依赖放根目录

**应该放在根 package.json 的依赖**:
- 开发工具: `typescript`, `biome`, `turbo`, `vitest`
- 共享库: `vue`, `lucide-vue-next`, `@vueuse/core`
- 版本敏感的包: `@nestjs/*`, `drizzle-orm`

**应该放在子包的依赖**:
- 特定功能的库: `minio` (只在 storage 服务用)
- 不同版本需求: 某些包可能需要不同版本

### Workspace 协议

```json
{
  "dependencies": {
    "@juanie/core": "workspace:*",
    "@juanie/types": "workspace:*"
  }
}
```

**优势**:
- `workspace:*`: 始终使用本地最新版本
- 开发时无需 `bun install`
- 发布时自动替换为实际版本号

## 如何实施单一依赖树

### 步骤 1: 清理现有依赖

```bash
# 使用自动化脚本
./scripts/enforce-single-dependency-tree.sh

# 或手动清理
rm -rf node_modules bun.lock .turbo .bun-cache
find packages apps -name "node_modules" -type d -prune -exec rm -rf '{}' +
```

### 步骤 2: 确保配置正确

**bunfig.toml**:
```toml
[install]
hoisting = true           # ✅ 提升所有依赖
flattenWorkspace = true   # ✅ 扁平化 workspace
symlink = false           # ✅ 不创建符号链接
```

**package.json**:
```json
{
  "workspaces": ["apps/*", "packages/*"],
  "resolutions": {
    "@nestjs/config": "^4.0.2",  // 强制版本统一
    "typescript": "^5.9.3"
  }
}
```

### 步骤 3: 重新安装

```bash
bun install
```

### 步骤 4: 验证

```bash
# 检查子包是否有 node_modules（应该为 0）
find packages apps -name "node_modules" -type d | wc -l

# 应该输出: 0
```

## 常见问题解决

### 1. 删除依赖后重新安装报错

**原因**: Bun 缓存或 Turbo 缓存损坏

**解决方案**:
```bash
# 清理所有缓存
rm -rf node_modules .turbo .bun-cache
rm bun.lock

# 重新安装
bun install

# 如果还有问题，清理子包
find . -name "node_modules" -type d -prune -exec rm -rf '{}' +
find . -name "dist" -type d -prune -exec rm -rf '{}' +
```

### 2. TypeScript 找不到类型

**原因**: 包构建顺序问题

**解决方案**:
```bash
# 先构建所有包
bun run build

# 或者只构建包（不构建 apps）
turbo build:packages
```

**预防**: 在 `turbo.json` 中正确设置 `dependsOn`:
```json
{
  "dev": {
    "dependsOn": ["^build:packages"]
  }
}
```

### 3. Vite 开发服务器卡死

**原因**: 文件监听过多

**解决方案**:
1. 在 `bunfig.toml` 中精确配置 `watchExclude`
2. 在 `vite.config.ts` 中添加:
```typescript
export default defineConfig({
  server: {
    watch: {
      ignored: ['**/node_modules/**', '**/dist/**']
    }
  }
})
```

### 4. NestJS 模块找不到

**原因**: 
- 版本不统一
- 构建顺序错误
- 循环依赖

**解决方案**:
1. 使用 `resolutions` 统一版本
2. 检查 `exports` 字段配置
3. 使用 `madge` 检查循环依赖:
```bash
bunx madge --circular packages/services/foundation/src
```

## 性能优化建议

### 1. 并行构建

```json
{
  "scripts": {
    "dev": "turbo run dev --concurrency=50"
  }
}
```

### 2. 增量构建

在 `tsconfig.json` 中启用:
```json
{
  "compilerOptions": {
    "incremental": true,
    "tsBuildInfoFile": ".tsbuildinfo"
  }
}
```

### 3. 选择性构建

```bash
# 只构建特定包及其依赖
turbo build --filter='@juanie/api-gateway'

# 只构建变更的包
turbo build --filter='...[HEAD^1]'
```

### 4. 远程缓存 (可选)

```json
{
  "remoteCache": {
    "enabled": true
  }
}
```

配合 Vercel 或自建缓存服务器使用。

## 开发工作流

### 启动开发环境

```bash
# 1. 安装依赖
bun install

# 2. 启动数据库
bun run docker:up

# 3. 应用数据库迁移
bun run db:push

# 4. 启动开发服务器
bun run dev
```

### 添加新包

```bash
# 在根目录添加共享依赖
bun add -D typescript

# 在特定包添加依赖
bun add --cwd packages/core ioredis

# 添加 workspace 依赖
cd apps/api-gateway
bun add @juanie/core@workspace:*
```

### 发布前检查

```bash
# 类型检查
bun run type-check

# 代码检查
bun run lint

# 构建所有包
bun run build

# 运行测试
bun test
```

## 最佳实践总结

1. ✅ **统一版本**: 使用 `resolutions` 强制关键依赖版本一致
2. ✅ **提升依赖**: `hoisting = true` + `flattenWorkspace = true`
3. ✅ **精确监听**: 只监听 `src/**`，排除 `node_modules` 和 `dist`
4. ✅ **缓存优化**: 排除测试文件，使用 `outputLogs: "new-only"`
5. ✅ **构建顺序**: dev 依赖 `^build:packages`，不依赖 app 构建
6. ✅ **Workspace 协议**: 使用 `workspace:*` 引用本地包
7. ✅ **增量构建**: 启用 TypeScript `incremental`
8. ✅ **选择性构建**: 使用 `--filter` 只构建需要的包

## 参考资源

- [Bun Workspaces](https://bun.sh/docs/install/workspaces)
- [Turborepo Handbook](https://turbo.build/repo/docs/handbook)
- [Package Resolution](https://bun.sh/docs/install/overrides)
