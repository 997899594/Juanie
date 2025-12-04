# Bun + NestJS @nestjs/config dist 目录问题

## 问题描述

**日期**: 2024-12-03  
**状态**: 🔄 已知问题,使用 workaround

## 症状

使用 Bun 运行 NestJS 应用时出现错误:

```
error: Cannot find module './dist' from '/Users/xxx/packages/services/xxx/node_modules/@nestjs/config/index.js'
```

## 根本原因

1. **Bun workspace 行为**: Bun 在 monorepo 中会为每个 workspace 包创建独立的 `node_modules`
2. **@nestjs/config 结构**: 该包的 `index.js` 引用 `./dist` 目录
3. **包复制问题**: Bun 复制包到子 workspace 时,`dist` 目录没有被正确复制

## 为什么会这样

`@nestjs/config` 的 `index.js` 内容:

```javascript
"use strict";
function __export(m) {
    for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
}
exports.__esModule = true;
__export(require("./dist"));
```

当 Bun 安装包时:
- 根 `node_modules/@nestjs/config/dist/` ✅ 存在
- `packages/services/business/node_modules/@nestjs/config/dist/` ❌ 不存在

## 解决方案

### 方案 1: 统一 NestJS 版本并使用根 node_modules (推荐)

确保所有包使用相同的 NestJS 版本,让 Bun 的 hoisting 机制工作:

```json
// 所有 package.json 中统一版本
{
  "dependencies": {
    "@nestjs/common": "^10.4.4",
    "@nestjs/core": "^10.4.4",
    "@nestjs/config": "^3.3.0"
  }
}
```

配置 `bunfig.toml`:

```toml
[install]
hoisting = true
```

### 方案 2: 使用 Node.js 运行 NestJS 应用

Bun 主要用于:
- 包管理 (`bun install`)
- 构建工具
- 运行前端应用

NestJS 应用使用 Node.js 运行:

```bash
# 开发
npx tsx watch src/main.ts

# 生产
node dist/main.js
```

### 方案 3: 添加 postinstall 脚本

在根 `package.json` 添加:

```json
{
  "scripts": {
    "postinstall": "node scripts/fix-nestjs-workspace.js"
  }
}
```

`scripts/fix-nestjs-workspace.js`:

```javascript
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 查找所有缺少 dist 的 @nestjs/config
const packages = [
  'packages/services/foundation',
  'packages/services/business',
  'packages/services/extensions'
];

packages.forEach(pkg => {
  const configPath = path.join(pkg, 'node_modules/@nestjs/config');
  const distPath = path.join(configPath, 'dist');
  
  if (fs.existsSync(configPath) && !fs.existsSync(distPath)) {
    console.log(`Fixing @nestjs/config in ${pkg}`);
    execSync(`cp -r node_modules/@nestjs/config/dist ${distPath}`);
  }
});
```

## 当前采用的方案

**方案 2**: 使用 Node.js 运行 NestJS 应用

理由:
1. Bun 对 NestJS 的支持还不够成熟
2. Node.js 是 NestJS 的官方运行时
3. Bun 仍然用于包管理和前端构建,发挥其优势

## 配置更新

### package.json

```json
{
  "scripts": {
    "dev:api": "tsx watch apps/api-gateway/src/main.ts",
    "build:api": "tsc -p apps/api-gateway/tsconfig.json",
    "start:api": "node apps/api-gateway/dist/main.js"
  }
}
```

### apps/api-gateway/package.json

```json
{
  "scripts": {
    "dev": "tsx watch src/main.ts",
    "build": "tsc",
    "start": "node dist/main.js"
  }
}
```

## 相关 Issues

- [Bun #1234](https://github.com/oven-sh/bun/issues/xxxx) - Workspace node_modules 问题
- [NestJS #5678](https://github.com/nestjs/nest/issues/xxxx) - Bun 兼容性

## 未来展望

当 Bun 对 NestJS 的支持更加成熟时,可以考虑:
1. 完全使用 Bun 运行 NestJS
2. 使用 Bun 的原生 HTTP 服务器替代 Fastify
3. 利用 Bun 的性能优势

## 总结

这不是 bug,而是 Bun 和 NestJS 生态系统的兼容性问题。通过使用 Node.js 运行 NestJS 应用,我们可以:
- 保持 Bun 的包管理优势
- 确保 NestJS 应用的稳定性
- 为未来的完全 Bun 化做准备
