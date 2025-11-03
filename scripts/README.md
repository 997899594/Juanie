# 🔧 脚本工具说明

## 📋 脚本列表

### 环境检查

#### `check-env.sh`
检查环境变量配置是否完整。

```bash
./scripts/check-env.sh
```

**用途：**
- 启动前检查必需的环境变量
- 验证配置文件是否存在
- 提示缺失的配置

#### `check-config-deps.sh`
检查配置包的依赖关系。

```bash
./scripts/check-config-deps.sh
```

### 开发工具

#### `dev-web-safe.sh`
安全启动 Web 应用（自动清理缓存和进程）。

```bash
./scripts/dev-web-safe.sh

# 或从根目录
bun run dev:safe
```

**用途：**
- 清理残留进程
- 清理缓存
- 干净启动开发服务器

### 故障排查

#### `fix-vite-freeze.sh`
修复 Vite 卡死问题的一键脚本。

```bash
./scripts/fix-vite-freeze.sh

# 或从根目录
bun run fix:vite
```

**功能：**
- 杀死所有僵尸进程（vite, esbuild, turbo）
- 清理所有缓存（.vite, .turbo, dist）
- 释放占用的端口
- 清理 macOS FSEvents 缓存（需要 sudo）
- 可选：重新安装依赖

**何时使用：**
- Vite 启动卡住不动
- 构建过程卡死
- 端口被占用
- 需要完全重置开发环境

#### `kill-stuck-processes.sh`
快速清理卡住的进程。

```bash
./scripts/kill-stuck-processes.sh

# 或从根目录
bun run clean:stuck
```

**功能：**
- 杀死 vite, esbuild, vue-tsc, turbo 进程
- 不清理缓存（比 fix-vite-freeze 更轻量）

**何时使用：**
- 进程卡住但不想清理缓存
- 快速清理后重试

#### `diagnose-build.sh`
诊断构建问题。

```bash
./scripts/diagnose-build.sh

# 或从根目录
bun run diagnose
```

**功能：**
- 检查运行中的进程
- 检查端口占用
- 检查系统内存
- 检查磁盘空间
- 检查缓存大小
- 检查构建产物

**何时使用：**
- 不确定问题原因
- 需要收集诊断信息
- 报告问题前

## 🚀 快速命令参考

### 日常开发

```bash
# 启动开发（推荐）
bun run dev:safe

# 或标准启动
bun run dev:web
```

### 遇到问题

```bash
# 1. 快速清理进程
bun run clean:stuck

# 2. 完全修复
bun run fix:vite

# 3. 诊断问题
bun run diagnose
```

### 环境检查

```bash
# 检查环境变量
./scripts/check-env.sh

# 检查配置
./scripts/check-config-deps.sh
```

## 📝 添加新脚本

新增脚本时请：

1. 添加到此 README
2. 添加执行权限：`chmod +x scripts/your-script.sh`
3. 添加清晰的注释
4. 在根 `package.json` 中添加快捷命令

## 🗑️ 已删除的脚本

以下脚本已删除（一次性使用或已过时）：

- `add-animations-to-pages.sh` - 一次性动画添加脚本
- `migrate-types.sh` - 类型迁移脚本（已完成）

## 💡 最佳实践

1. **使用 package.json 命令**而不是直接运行脚本
2. **遇到问题先运行诊断**：`bun run diagnose`
3. **定期清理**：每天开始前运行 `bun run clean:stuck`
4. **不要手动杀进程**：使用提供的脚本

## 🆘 需要帮助？

查看 [故障排查文档](../docs/TROUBLESHOOTING.md)
