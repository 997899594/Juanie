# 构建问题排查指南

## UI 包构建卡住问题

### 症状
- 运行 `bun run build` 在 UI 包时卡住不动
- 没有错误信息，进程一直运行但没有输出
- 需要重启电脑才能解决

### 常见原因

#### 1. esbuild 进程僵死
**原因**：esbuild 是用 Go 编写的，有时会出现进程卡住的情况。

**解决方案**：
```bash
# 快速清理
bun run clean:stuck

# 或手动清理
pkill -f esbuild
pkill -f vite
```

#### 2. 文件监听器泄漏
**原因**：之前的构建进程没有正确清理，文件监听器仍在运行。

**解决方案**：
```bash
# 清理 UI 包
bun run ui:clean

# 或完整清理
rm -rf node_modules/.vite
rm -rf node_modules/.cache
rm -rf packages/ui/dist
```

#### 3. 内存不足
**原因**：构建过程需要大量内存，特别是使用 `preserveModules` 时。

**解决方案**：
- 关闭其他应用释放内存
- 使用 `build:fast` 跳过类型检查：
  ```bash
  cd packages/ui
  bun run build:fast
  ```

#### 4. 循环依赖
**原因**：代码中存在循环引用，导致构建死锁。

**检查方法**：
```bash
# 安装 madge
npm i -g madge

# 检查循环依赖
cd packages/ui
madge --circular src/index.ts
```

**解决方案**：
- 重构代码，消除循环依赖
- 使用动态导入 `import()` 打破循环

#### 5. TypeScript 类型检查卡住
**原因**：`vue-tsc` 在大型项目中可能很慢或卡住。

**解决方案**：
```bash
# 跳过类型检查直接构建
cd packages/ui
bun run build:fast
```

### 诊断工具

#### 运行诊断脚本
```bash
bun run diagnose
```

这会检查：
- 运行中的构建进程
- 端口占用情况
- 系统内存使用
- 磁盘空间
- 缓存大小
- 循环依赖

#### 手动检查进程
```bash
# 查看所有构建相关进程
ps aux | grep -E "(vite|esbuild|vue-tsc)"

# 查看端口占用
lsof -i :1997  # Web 应用
lsof -i :5173  # Vite 默认端口
```

### 预防措施

#### 1. 优化构建配置
已在 `packages/ui/vite.config.ts` 中添加：
- `reportCompressedSize: false` - 跳过压缩大小报告
- `maxParallelFileOps: 20` - 限制并行文件操作
- 错误处理和警告过滤

#### 2. 使用快速构建
开发时使用 watch 模式，跳过类型检查：
```bash
cd packages/ui
bun run dev  # 使用 watch 模式
```

#### 3. 定期清理
```bash
# 每天开始工作前
bun run clean:stuck

# 遇到问题时
bun run ui:clean
```

### 快速命令参考

```bash
# 诊断问题
bun run diagnose

# 清理卡住的进程
bun run clean:stuck

# 清理 UI 包并重新构建
bun run ui:clean

# 快速构建（跳过类型检查）
cd packages/ui && bun run build:fast

# 开发模式（watch）
cd packages/ui && bun run dev
```

### 最后手段

如果以上方法都不行：

1. **重启终端**
   ```bash
   # 完全退出终端应用，重新打开
   ```

2. **清理所有缓存**
   ```bash
   rm -rf node_modules
   rm -rf packages/*/node_modules
   rm -rf apps/*/node_modules
   bun install
   ```

3. **重启电脑**
   - 这通常能解决 esbuild 进程僵死的问题

### 报告问题

如果问题持续存在，请收集以下信息：

```bash
# 运行诊断
bun run diagnose > build-diagnosis.txt

# 系统信息
uname -a >> build-diagnosis.txt
node -v >> build-diagnosis.txt
bun -v >> build-diagnosis.txt

# 发送 build-diagnosis.txt 给团队
```

## 相关配置文件

- `packages/ui/vite.config.ts` - UI 包构建配置
- `packages/ui/scripts/clean-build.sh` - UI 包清理脚本
- `scripts/kill-stuck-processes.sh` - 全局进程清理脚本
- `scripts/diagnose-build.sh` - 诊断脚本
