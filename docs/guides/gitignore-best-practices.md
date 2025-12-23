# .gitignore 最佳实践

## Bun + Turborepo Monorepo 应该忽略的文件

### 1. **Bun 相关**

```gitignore
# Bun 缓存目录（包含 npm 包的 Git 仓库）
.bun-cache

# Bun lockfile（团队协作时可以提交，个人项目可忽略）
# bun.lock
```

**说明**:
- `.bun-cache/`: Bun 的包缓存，包含数千个 Git 仓库，**绝对不能提交**
- `bun.lock`: 类似 `package-lock.json`，建议提交以确保依赖版本一致

### 2. **Turborepo 相关**

```gitignore
# Turbo 构建缓存
.turbo

# Turbo 守护进程
.turbo/daemon
```

### 3. **Node.js / npm 相关**

```gitignore
# 依赖目录
node_modules

# npm 缓存
.npm

# Yarn 相关（如果不用 Yarn 可以忽略）
.yarn-integrity
.pnp.*
.yarn/cache
.yarn/unplugged
.yarn/build-state.yml
.yarn/install-state.gz
```

### 4. **构建产物**

```gitignore
# TypeScript 构建产物
dist
*.tsbuildinfo

# Vite 构建产物
dist-ssr
.vite

# Next.js 构建产物
.next
out
```

### 5. **环境变量**

```gitignore
# 环境变量文件（包含敏感信息）
.env
.env.local
.env.production
.env.test

# 但保留示例文件
!.env.example
!.env.prod.example
```

### 6. **IDE 和编辑器**

```gitignore
# VSCode
.vscode/settings.json
.vscode/launch.json

# 但保留推荐配置
!.vscode/extensions.json
!.vscode/tasks.json

# JetBrains IDEs
.idea/

# Vim
*.swp
*.swo
*~
```

### 7. **操作系统**

```gitignore
# macOS
.DS_Store
.AppleDouble
.LSOverride
._*

# Windows
Thumbs.db
ehthumbs.db
Desktop.ini

# Linux
*~
.directory
```

### 8. **测试和覆盖率**

```gitignore
# 测试覆盖率
coverage
*.lcov
.nyc_output

# Vitest
.vitest
```

### 9. **日志文件**

```gitignore
# 所有日志文件
logs
*.log
npm-debug.log*
yarn-debug.log*
pnpm-debug.log*
lerna-debug.log*
```

### 10. **临时文件**

```gitignore
# 临时目录
tmp/
temp/
.cache

# 备份文件
*.bak
*.backup
*.old
*.temp
```

## 完整的 .gitignore 模板

```gitignore
# ============================================
# Bun + Turborepo Monorepo .gitignore
# ============================================

# Bun
.bun-cache
# bun.lock  # 取消注释以忽略 lockfile

# Turborepo
.turbo

# Node.js
node_modules
.npm

# 构建产物
dist
dist-ssr
*.tsbuildinfo
.vite
.next
out
.nuxt

# 环境变量
.env
.env.local
.env.production
.env.test
!.env.example
!.env.prod.example

# IDE
.vscode/settings.json
.vscode/launch.json
.idea/
*.swp
*.swo
*~

# 操作系统
.DS_Store
._*
Thumbs.db

# 测试
coverage
*.lcov
.nyc_output

# 日志
logs
*.log

# 临时文件
tmp/
temp/
.cache
*.bak
*.backup
*.old
```

## 常见问题

### Q: 为什么 .bun-cache 有几千个 Git 提交？

**A**: `.bun-cache` 是 Bun 的包缓存目录，Bun 会将 npm 包作为 Git 仓库缓存在这里。每个包都是一个独立的 Git 仓库，所以会有大量的 Git 对象。

**解决方案**:
1. 确保 `.bun-cache` 在 `.gitignore` 中
2. 如果已经提交，使用以下命令删除：
```bash
git rm -r --cached .bun-cache
git commit -m "chore: remove .bun-cache from git"
```

### Q: bun.lock 应该提交吗？

**A**: 
- ✅ **团队协作项目**: 应该提交，确保所有人使用相同的依赖版本
- ❌ **个人项目**: 可以忽略，减少 Git 历史体积
- ✅ **生产环境**: 必须提交，确保部署的依赖版本一致

### Q: .turbo 目录很大，会影响 Git 吗？

**A**: 不会，`.turbo` 已经在 `.gitignore` 中，不会被提交。这个目录只是本地构建缓存。

### Q: 如何清理已经提交的缓存文件？

**A**: 
```bash
# 1. 从 Git 历史中删除（保留本地文件）
git rm -r --cached .bun-cache .turbo

# 2. 提交更改
git commit -m "chore: remove cache directories from git"

# 3. 如果需要清理整个 Git 历史（慎用）
git filter-branch --tree-filter 'rm -rf .bun-cache .turbo' HEAD
```

## 验证 .gitignore

```bash
# 检查哪些文件会被忽略
git status --ignored

# 检查特定文件是否被忽略
git check-ignore -v .bun-cache

# 查看 Git 追踪的所有文件
git ls-files
```

## 最佳实践总结

1. ✅ **缓存目录必须忽略**: `.bun-cache`, `.turbo`, `node_modules`
2. ✅ **环境变量必须忽略**: `.env`, `.env.local`（但保留 `.env.example`）
3. ✅ **构建产物必须忽略**: `dist`, `.next`, `out`
4. ✅ **IDE 配置选择性忽略**: 忽略个人设置，保留团队配置
5. ✅ **lockfile 建议提交**: `bun.lock` 确保依赖版本一致
6. ✅ **定期检查**: 使用 `git status --ignored` 验证配置

## 相关文档

- [Bun 官方文档 - 缓存](https://bun.sh/docs/install/cache)
- [Turborepo 官方文档 - .gitignore](https://turbo.build/repo/docs/handbook/what-is-a-monorepo#gitignore)
- [GitHub .gitignore 模板](https://github.com/github/gitignore)
