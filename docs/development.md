# 开发指南

本文档提供 Juanie 项目的开发环境设置、工作流程和最佳实践。

---

## 🛠️ 开发环境设置

### 前置要求

- **Node.js**: >= 22.0.0
- **Bun**: >= 1.0.0
- **Docker**: >= 20.10.0
- **Docker Compose**: >= 2.0.0
- **Git**: >= 2.30.0

### 推荐工具

- **IDE**: VS Code 或 WebStorm
- **VS Code 扩展**:
  - Vue - Official
  - TypeScript Vue Plugin (Volar)
  - Tailwind CSS IntelliSense
  - Biome
  - GitLens
  - Docker

---

## 📦 安装步骤

### 1. 克隆仓库

```bash
git clone <repository-url>
cd juanie
```

### 2. 安装依赖

```bash
bun install
```

### 3. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件
```

### 4. 启动基础服务

```bash
bun run docker:up
```

### 5. 初始化数据库

```bash
bun run db:push
```

### 6. 启动开发服务器

```bash
bun run dev
```

访问：
- Web UI: http://localhost:5173
- API: http://localhost:3000

---

## 🔄 开发工作流

### 代码规范

使用 Biome 进行代码检查和格式化：

```bash
bun x biome check --write .
```

### 提交规范

使用 Conventional Commits：

```
feat: 新功能
fix: 修复 bug
docs: 文档更新
style: 代码格式
refactor: 重构
test: 测试
chore: 构建/工具
```

---

## 🗄️ 数据库操作

```bash
bun run db:generate  # 生成迁移
bun run db:push      # 推送 schema
bun run db:studio    # 打开 Drizzle Studio
```

---

详细内容请参考完整文档。
