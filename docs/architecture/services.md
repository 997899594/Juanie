# 服务架构说明

## 🏗️ 服务分类

### 1. Docker 容器服务 (推荐)

这些服务通过 `docker-compose.yml` 管理,一键启动:

| 服务 | 端口 | 说明 | 启动命令 |
|------|------|------|----------|
| **PostgreSQL** | 5432 | 主数据库 | `bun run docker:up` |
| **Dragonfly** | 6379 | Redis 兼容缓存 | `bun run docker:up` |
| **Ollama** | 11434 | AI 模型服务 | `bun run docker:up` |
| **MinIO** | 9000, 9001 | 对象存储 | `bun run docker:up` |
| **Jaeger** | 16686, 4318 | 链路追踪 | `bun run docker:up:all` |
| **Prometheus** | 9090 | 指标监控 | `bun run docker:up:all` |
| **Grafana** | 3000 | 可视化面板 | `bun run docker:up:all` |
| **GitLab** | 8080, 2222 | Git 私服 | `bun run docker:up:all` |

### 2. 外部服务 (需要单独安装)

这些服务需要在宿主机上单独安装:

| 服务 | 说明 | 安装方式 |
|------|------|----------|
| **K3s** | 轻量级 Kubernetes | [安装指南](./K3S_SETUP.md) |
| **Node.js** | 运行时环境 | `brew install node` |
| **Bun** | 包管理器 | `brew install bun` |

## 🚀 快速启动

### 最小化启动 (核心服务)

只启动必需的服务:

```bash
# 启动数据库、缓存、AI、存储
bun run docker:up

# 等价于
docker-compose up -d postgres dragonfly ollama minio
```

**包含服务**:
- ✅ PostgreSQL (数据库)
- ✅ Dragonfly (缓存)
- ✅ Ollama (AI)
- ✅ MinIO (对象存储)

### 完整启动 (所有服务)

启动所有服务,包括监控和 GitLab:

```bash
# 启动所有服务
bun run docker:up:all

# 等价于
docker-compose up -d
```

**额外包含**:
- ✅ Jaeger (链路追踪)
- ✅ Prometheus (指标监控)
- ✅ Grafana (可视化)
- ✅ GitLab (Git 私服)

## 📋 服务详情

### PostgreSQL (数据库)

**用途**: 主数据库,存储所有业务数据

**配置**:
```bash
POSTGRES_USER=findbiao
POSTGRES_PASSWORD=biao1996.
POSTGRES_DB=juanie_ai_devops
```

**访问**:
```bash
# 命令行连接
docker-compose exec postgres psql -U findbiao -d juanie_ai_devops

# 或使用 GUI 工具
# Host: localhost
# Port: 5432
# User: findbiao
# Password: biao1996.
# Database: juanie_ai_devops
```

### Dragonfly (Redis 缓存)

**用途**: 高性能缓存,比 Redis 快 25 倍

**配置**:
```bash
REDIS_URL=redis://localhost:6379
```

**访问**:
```bash
# 测试连接
docker-compose exec dragonfly redis-cli ping
# 应该返回: PONG
```

### Ollama (AI 服务)

**用途**: 本地运行 AI 大模型

**配置**:
```bash
OLLAMA_HOST=http://localhost:11434
```

**使用**:
```bash
# 拉取模型
docker-compose exec ollama ollama pull llama2

# 运行模型
docker-compose exec ollama ollama run llama2

# 列出模型
docker-compose exec ollama ollama list
```

**Web UI**: http://localhost:11434

### MinIO (对象存储)

**用途**: S3 兼容的对象存储,用于文件上传

**配置**:
```bash
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
```

**访问**:
- **API**: http://localhost:9000
- **Console**: http://localhost:9001
- **登录**: minioadmin / minioadmin

**创建 Bucket**:
```bash
# 使用 mc (MinIO Client)
docker run --rm --network host minio/mc \
  alias set local http://localhost:9000 minioadmin minioadmin

docker run --rm --network host minio/mc \
  mb local/logos
```

### Jaeger (链路追踪)

**用途**: 分布式追踪,查看请求链路

**配置**:
```bash
JAEGER_ENDPOINT=http://localhost:4318
```

**访问**: http://localhost:16686

### Prometheus (指标监控)

**用途**: 收集和存储时序数据

**访问**: http://localhost:9090

### Grafana (可视化)

**用途**: 数据可视化面板

**访问**: http://localhost:3000
**登录**: admin / admin

### GitLab (Git 私服)

**用途**: 私有 Git 仓库和 CI/CD

**配置**:
```bash
GITLAB_HOSTNAME=gitlab.local
GITLAB_ROOT_PASSWORD=admin123456
```

**访问**: http://localhost:8080
**登录**: root / admin123456

**注意**: GitLab 启动需要 2-3 分钟

## 🔧 服务管理

### 查看服务状态

```bash
# 查看所有服务
bun run docker:ps

# 或
docker-compose ps
```

### 查看日志

```bash
# 查看所有服务日志
bun run docker:logs

# 查看特定服务日志
docker-compose logs -f postgres
docker-compose logs -f ollama
```

### 重启服务

```bash
# 重启特定服务
docker-compose restart postgres

# 重启所有服务
docker-compose restart
```

### 停止服务

```bash
# 停止所有服务
bun run docker:down

# 停止并删除数据卷 (慎用!)
docker-compose down -v
```

## 💾 数据持久化

所有服务数据都持久化到 Docker volumes:

| 服务 | Volume | 数据内容 |
|------|--------|----------|
| PostgreSQL | `postgres_data` | 数据库文件 |
| Dragonfly | `dragonfly_data` | 缓存数据 |
| Ollama | `ollama_data` | AI 模型 |
| MinIO | `minio_data` | 对象存储 |
| GitLab | `gitlab_*` | Git 仓库和配置 |

**查看 volumes**:
```bash
docker volume ls | grep juanie
```

**备份数据**:
```bash
# 备份 PostgreSQL
docker-compose exec postgres pg_dump -U findbiao juanie_ai_devops > backup.sql

# 备份 MinIO
docker run --rm --volumes-from juanie-minio-dev -v $(pwd):/backup \
  alpine tar czf /backup/minio-backup.tar.gz /data
```

## 🎯 服务依赖关系

```
应用程序
  ├─→ PostgreSQL (必需)
  ├─→ Dragonfly (必需)
  ├─→ Ollama (AI 功能需要)
  ├─→ MinIO (文件上传需要)
  ├─→ Jaeger (可选 - 追踪)
  ├─→ Prometheus (可选 - 监控)
  └─→ K3s (可选 - 部署功能)

GitLab (可选)
  ├─→ PostgreSQL (共享)
  └─→ Dragonfly (共享)
```

## 🔍 健康检查

```bash
# 检查所有服务健康状态
docker-compose ps

# 测试数据库连接
docker-compose exec postgres pg_isready

# 测试 Redis 连接
docker-compose exec dragonfly redis-cli ping

# 测试 MinIO 连接
curl http://localhost:9000/minio/health/live

# 测试 Ollama 连接
curl http://localhost:11434/api/tags
```

## 📊 资源使用

### 最小配置 (核心服务)

- **内存**: ~2GB
- **磁盘**: ~5GB
- **服务**: postgres, dragonfly, ollama, minio

### 完整配置 (所有服务)

- **内存**: ~8GB
- **磁盘**: ~20GB
- **服务**: 所有服务

### 优化建议

1. **开发环境**: 只启动核心服务
   ```bash
   bun run docker:up
   ```

2. **测试环境**: 启动核心服务 + 监控
   ```bash
   docker-compose up -d postgres dragonfly ollama minio jaeger
   ```

3. **完整环境**: 启动所有服务
   ```bash
   bun run docker:up:all
   ```

## 🐛 故障排查

### 服务无法启动

```bash
# 查看详细日志
docker-compose logs <service-name>

# 重新创建容器
docker-compose up -d --force-recreate <service-name>
```

### 端口冲突

```bash
# 查找占用端口的进程
lsof -i :5432
lsof -i :6379

# 修改 .env 中的端口配置
POSTGRES_PORT=5433
MINIO_PORT=9001
```

### 数据丢失

```bash
# 检查 volume 是否存在
docker volume ls

# 恢复备份
docker-compose exec -T postgres psql -U findbiao juanie_ai_devops < backup.sql
```

## 📚 相关文档

- [配置管理](../CONFIGURATION.md)
- [Docker 配置共享](../DOCKER_ENV_SHARING.md)
- [快速启动](../getting-started/quick-start.md)
- [K3s 部署](../deployment/k3s.md)
