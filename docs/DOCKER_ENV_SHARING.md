# Docker Compose 与 .env 配置共享

## 🎯 配置共享架构

所有 Docker 服务现在都从 `.env` 文件读取配置,实现真正的单一数据源:

```
.env (单一配置源)
  ↓
docker-compose.yml (引用环境变量)
  ↓
Docker 容器 (使用配置)
```

## 📋 已共享的配置

### 1. PostgreSQL 数据库

**`.env` 配置:**
```bash
POSTGRES_USER=findbiao
POSTGRES_PASSWORD=biao1996.
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=juanie_ai_devops
```

**`docker-compose.yml` 引用:**
```yaml
postgres:
  environment:
    POSTGRES_DB: ${POSTGRES_DB:-juanie_ai_devops}
    POSTGRES_USER: ${POSTGRES_USER:-findbiao}
    POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-biao1996.}
```

### 2. Redis/Dragonfly

**端口配置:**
- 默认端口: 6379
- 在 `.env` 中通过 `REDIS_URL` 配置

### 3. GitLab (可选)

**`.env` 配置:**
```bash
GITLAB_HOSTNAME=gitlab.local
GITLAB_DB=gitlab_dev
GITLAB_ROOT_PASSWORD=admin123456
```

**`docker-compose.yml` 引用:**
```yaml
gitlab:
  hostname: ${GITLAB_HOSTNAME:-gitlab.local}
  environment:
    GITLAB_OMNIBUS_CONFIG: |
      gitlab_rails['db_database'] = '${GITLAB_DB:-gitlab_dev}'
      gitlab_rails['db_username'] = '${POSTGRES_USER:-findbiao}'
      gitlab_rails['db_password'] = '${POSTGRES_PASSWORD:-biao1996.}'
      gitlab_rails['initial_root_password'] = '${GITLAB_ROOT_PASSWORD:-admin123456}'
```

### 4. 监控服务

- **Jaeger**: 端口 16686 (UI), 4318 (OTLP)
- **Prometheus**: 端口 9090
- **Grafana**: 端口 3000

## 🔧 使用方式

### 1. 修改配置

只需编辑 `.env` 文件:

```bash
vim .env
```

### 2. 重启服务

```bash
# 停止服务
docker-compose down

# 启动服务 (会自动读取新配置)
docker-compose up -d
```

### 3. 验证配置

```bash
# 查看容器环境变量
docker-compose exec postgres env | grep POSTGRES

# 查看 GitLab 配置
docker-compose exec gitlab cat /etc/gitlab/gitlab.rb | grep db_
```

## 📊 配置映射表

| .env 变量 | Docker 服务 | 用途 |
|-----------|-------------|------|
| `POSTGRES_USER` | postgres, gitlab | 数据库用户名 |
| `POSTGRES_PASSWORD` | postgres, gitlab | 数据库密码 |
| `POSTGRES_DB` | postgres | 主数据库名 |
| `POSTGRES_PORT` | postgres, gitlab | 数据库端口 |
| `GITLAB_HOSTNAME` | gitlab | GitLab 主机名 |
| `GITLAB_DB` | gitlab | GitLab 数据库名 |
| `GITLAB_ROOT_PASSWORD` | gitlab | GitLab root 密码 |

## ✅ 优点

1. **单一数据源** - 所有配置在 `.env` 中定义一次
2. **避免重复** - Docker 和应用共享相同配置
3. **易于维护** - 修改配置只需编辑一个文件
4. **环境隔离** - 不同环境使用不同的 `.env` 文件
5. **默认值** - 使用 `${VAR:-default}` 语法提供默认值

## 🔍 默认值机制

Docker Compose 支持默认值语法:

```yaml
${VARIABLE_NAME:-default_value}
```

**示例:**
```yaml
POSTGRES_USER: ${POSTGRES_USER:-findbiao}
```

- 如果 `.env` 中设置了 `POSTGRES_USER`,使用该值
- 如果未设置,使用默认值 `findbiao`

## 🚀 最佳实践

### 1. 开发环境

```bash
# .env
POSTGRES_USER=dev_user
POSTGRES_PASSWORD=dev_pass
POSTGRES_DB=juanie_dev
GITLAB_HOSTNAME=gitlab.dev.local
```

### 2. 生产环境

```bash
# .env.prod
POSTGRES_USER=prod_user
POSTGRES_PASSWORD=strong_prod_password
POSTGRES_DB=juanie_prod
GITLAB_HOSTNAME=gitlab.example.com
```

### 3. 切换环境

```bash
# 使用生产配置
cp .env.prod .env
docker-compose -f docker-compose.prod.yml up -d
```

## 🐛 故障排查

### 问题: 配置未生效

**原因**: Docker Compose 缓存了旧的环境变量

**解决方案**:
```bash
# 完全重建容器
docker-compose down -v
docker-compose up -d --force-recreate
```

### 问题: 变量未替换

**检查步骤**:

1. 验证 `.env` 文件存在:
```bash
ls -la .env
```

2. 检查变量格式:
```bash
cat .env | grep POSTGRES_USER
```

3. 测试变量替换:
```bash
docker-compose config | grep POSTGRES_USER
```

### 问题: GitLab 无法连接数据库

**原因**: GitLab 配置中的变量未正确替换

**解决方案**:
```bash
# 查看 GitLab 实际配置
docker-compose exec gitlab cat /etc/gitlab/gitlab.rb | grep db_

# 重新配置
docker-compose restart gitlab
```

## 📚 相关文档

- [配置管理指南](./CONFIGURATION.md)
- [数据库设计](./architecture/database.md)
- [快速启动指南](./getting-started/quick-start.md)

## 🔗 Docker Compose 文档

- [环境变量](https://docs.docker.com/compose/environment-variables/)
- [.env 文件](https://docs.docker.com/compose/env-file/)
- [变量替换](https://docs.docker.com/compose/compose-file/12-interpolation/)
