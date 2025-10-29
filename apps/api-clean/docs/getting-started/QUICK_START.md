# 快速开始

5 分钟快速上手 AI DevOps 平台。

## 前置要求

- **Bun** >= 1.1.38
- **Docker** & **Docker Compose**
- **PostgreSQL** 17 (通过 Docker)
- **Node.js** >= 20 (可选，用于某些工具)

## 1. 克隆项目

```bash
git clone <your-repo-url>
cd Juanie/apps/api-clean
```

## 2. 安装依赖

```bash
bun install
```

## 3. 启动服务

```bash
# 启动所有基础服务（PostgreSQL, Dragonfly, MinIO 等）
docker-compose up -d

# 等待服务启动（约 10 秒）
sleep 10
```

## 4. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件，至少配置以下内容：
# DATABASE_URL=postgresql://devops_user:devops_password@localhost:5432/devops
# REDIS_URL=redis://localhost:6379
```

## 5. 初始化数据库

```bash
# 生成迁移文件
bun run db:generate

# 应用迁移
bun run db:push
```

## 6. 启动开发服务器

```bash
bun run dev
```

服务将在 http://localhost:3001 启动。

## 7. 验证安装

访问以下端点验证服务：

- **API Health**: http://localhost:3001/health
- **Grafana**: http://localhost:3300 (admin/admin)
- **MinIO Console**: http://localhost:9001 (admin/admin123456)
- **Prometheus**: http://localhost:9090

## 下一步

- [创建第一个项目](./FIRST_PROJECT.md)
- [了解架构](../architecture/OVERVIEW.md)
- [配置 CI/CD](../features/CICD_TEMPLATES.md)

## 常见问题

### 端口被占用

如果端口被占用，修改 `docker-compose.yml` 中的端口映射。

### 数据库连接失败

确保 PostgreSQL 容器正在运行：
```bash
docker ps | grep postgres
```

### 权限问题

确保 Docker 有足够的权限访问文件系统。

## 获取帮助

- [完整安装指南](./INSTALLATION.md)
- [故障排查](../operations/TROUBLESHOOTING.md)
