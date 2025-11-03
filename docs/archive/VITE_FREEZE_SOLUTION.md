# Vite 卡死问题终极解决方案

## 问题描述

运行 `bun dev:web` 后，Vite 启动卡住，没有任何输出，必须重启电脑才能解决。

## 根本原因

这是 **macOS + Vite + Monorepo** 的经典问题，主要原因：

1. **进程僵死**：之前的 Vite/esbuild 进程没有正确退出
2. **文件监听器泄漏**：macOS FSEvents 缓存导致文件监听失效
3. **端口占用**：1997 端口被僵尸进程占用
4. **缓存损坏**：`.vite` 缓存文件损坏导致启动卡住
5. **依赖问题**：workspace 依赖链接问题

## 立即解决方案

### 方案 1：使用修复脚本（推荐）

```bash
# 运行修复脚本
bun run fix:vite

# 然后使用安全启动
bun run dev:safe
```

### 方案 2：手动清理

```bash
# 1. 杀死所有相关进程
pkill -9 -f vite
pkill -9 -f esbuild
pkill -9 -f turbo

# 2. 释放端口
lsof -ti:1997 | xargs kill -9

# 3. 清理缓存
rm -rf node_modules/.vite
rm -rf apps/web/node_modules/.vite
rm -rf .turbo

# 4. 重新启动
bun dev:web
```

### 方案 3：完全重置

```bash
# 1. 运行修复脚本并选择重新安装依赖
bun run fix:vite
# 选择 'y' 重新安装依赖

# 2. 重启终端

# 3. 使用安全启动
bun run dev:safe
```

## 预防措施

### 1. 使用安全启动命令

不要直接使用 `bun dev:web`，而是使用：

```bash
bun run dev:safe
```

这个命令会：
- 自动清理残留进程
- 清理缓存
- 检查 UI 包是否已构建
- 干净启动开发服务器

### 2. 正确停止开发服务器

**不要直接关闭终端窗口！**

正确的停止方式：
1. 按 `Ctrl+C` 停止服务器
2. 等待进程完全退出（看到命令提示符）
3. 然后关闭终端

### 3. 定期清理

每天开始工作前运行：

```bash
bun run clean:stuck
```

### 4. 监控进程

如果怀疑有问题，运行诊断：

```bash
bun run diagnose
```

## 深度分析

### 为什么会卡死？

1. **Vite 的依赖预构建**
   - Vite 启动时会预构建依赖
   - 如果缓存损坏，会一直卡在这一步
   - 解决：清理 `.vite` 缓存

2. **文件监听器**
   - Monorepo 有大量文件需要监听
   - macOS 的 FSEvents 有时会卡住
   - 解决：清理 FSEvents 缓存，使用轮询模式

3. **esbuild 进程**
   - esbuild 是 Go 编写的，有时会僵死
   - 解决：强制杀死进程（`kill -9`）

4. **端口占用**
   - 僵尸进程占用端口
   - Vite 无法启动但也不报错
   - 解决：释放端口

### 配置优化

已在 `apps/web/vite.config.ts` 中添加：

```typescript
{
  server: {
    watch: {
      // 忽略不必要的目录
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
      ],
    },
    // 预热常用文件
    warmup: {
      clientFiles: ['./src/main.ts', './src/App.vue'],
    },
  },
  build: {
    // 禁用压缩大小报告
    reportCompressedSize: false,
    // 限制并行操作
    rollupOptions: {
      maxParallelFileOps: 20,
    },
  },
}
```

## 如果还是卡死

### 尝试轮询模式

编辑 `apps/web/vite.config.ts`：

```typescript
server: {
  watch: {
    usePolling: true,  // 改为 true
    interval: 1000,    // 添加这行
  },
}
```

轮询模式更可靠但会消耗更多 CPU。

### 增加文件描述符限制

```bash
# 临时增加
ulimit -n 10240

# 永久增加（添加到 ~/.zshrc）
echo "ulimit -n 10240" >> ~/.zshrc
```

### 检查系统资源

```bash
# 检查内存
vm_stat

# 检查磁盘空间
df -h

# 检查进程数
ps aux | wc -l
```

如果内存不足或磁盘空间不足，关闭其他应用。

## 命令速查表

| 命令 | 说明 |
|------|------|
| `bun run dev:safe` | 安全启动 Web 应用（推荐） |
| `bun run fix:vite` | 修复 Vite 卡死问题 |
| `bun run clean:stuck` | 清理卡住的进程 |
| `bun run diagnose` | 诊断构建问题 |
| `bun run ui:clean` | 清理并重新构建 UI 包 |

## 最后手段

如果所有方法都不行：

1. **完全重启**
   ```bash
   # 1. 保存所有工作
   # 2. 关闭所有终端
   # 3. 重启电脑
   # 4. 重新打开终端
   # 5. 运行: bun run fix:vite
   # 6. 运行: bun run dev:safe
   ```

2. **重新克隆项目**
   ```bash
   # 如果项目本身有问题
   cd ..
   git clone <repo-url> juanie-fresh
   cd juanie-fresh
   bun install
   bun run dev:safe
   ```

## 报告问题

如果问题持续存在，收集信息：

```bash
# 运行诊断并保存
bun run diagnose > vite-issue.txt

# 添加系统信息
uname -a >> vite-issue.txt
sw_vers >> vite-issue.txt
bun -v >> vite-issue.txt

# 添加进程信息
ps aux | grep -E "(vite|esbuild)" >> vite-issue.txt

# 发送 vite-issue.txt 给团队
```

## 相关文件

- `scripts/fix-vite-freeze.sh` - Vite 卡死修复脚本
- `scripts/dev-web-safe.sh` - 安全启动脚本
- `scripts/kill-stuck-processes.sh` - 进程清理脚本
- `scripts/diagnose-build.sh` - 诊断脚本
- `apps/web/vite.config.ts` - Vite 配置（已优化）
