# 配置管理总结

## 📁 配置文件架构

```
项目配置体系
│
├── 环境变量层
│   ├── .env                    # 本地开发配置 (Git 忽略)
│   ├── .env.example            # 配置模板 (Git 跟踪)
│   └── .env.prod.example       # 生产环境模板
│
├── Docker 层
│   ├── docker-compose.yml      # 开发环境容器配置
│   └── docker-compose.prod.yml # 生产环境容器配置
│
├── 应用层
│   └── apps/*/src/
│       └── app.module.ts       # NestJS 配置模块
│
└── 文档层
    ├── docs/CONFIGURATION.md   # 详细配置指南
    ├── docs/CONFIG_SUMMARY.md  # 本文件
    └── QUICK_START.md          # 快速启动指南
```

## 🎯 配置原则

### 1. 单一数据源 (Single Source of Truth)

**问题**: 配置分散在多个文件,容易不一致

**解决方案**: 所有配置值在 `.env` 中定义,其他文件引用

```bash
# .env (数据源)
POSTGRES_USER=findbiao
POSTGRES_PASSWORD=secret
POSTGRES_DB=mydb

# docker-compose.yml (引用)
environment:
  POSTGRES_USER: ${POSTGRES_USER}
  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
  POSTGRES_DB: ${POSTGRES_DB}

# 应用代码 (读取)
DATABASE_URL=postgresql://findbiao:secret@localhost:5432/mydb
```

### 2. 配置与代码分离

**原则**: 
- ✅ 配置通过环境变量注入
- ❌ 不要硬编码配置值
- ✅ 使用 ConfigService 读取配置
- ❌ 不要直接使用 process.env

**示例**:

```typescript
// ❌ 错误: 硬编码
const dbUrl = 'postgresql://localhost:5432/mydb'

// ❌ 错误: 直接使用 process.env
const dbUrl = process.env.DATABASE_URL

// ✅ 正确: 使用 ConfigService
constructor(private config: ConfigService) {
  const dbUrl = this.config.get<string>('DATABASE_URL')
}
```

### 3. 环境隔离

不同环境使用不同的配置文件:

| 环境 | 配置文件 | Docker Compose |
|------|----------|----------------|
| 开发 | `.env` | `docker-compose.yml` |
| 测试 | `.env.test` | `docker-compose.test.yml` |
| 生产 | `.env.prod` | `docker-compose.prod.yml` |

## 🔄 配置流程

### 开发环境配置流程

```mermaid
graph LR
    A[.env.example] -->|复制| B[.env]
    B -->|编辑| C[填入实际值]
    C -->|验证| D[check:env]
    D -->|通过| E[启动应用]
    B -->|读取| F[docker-compose.yml]
    B -->|读取| G[NestJS App]
```

### 配置更新流程

```mermaid
graph TD
    A[修改 .env] --> B{需要重启?}
    B -->|Docker 配置| C[重启容器]
    B -->|应用配置| D[重启应用]
    C --> E[验证]
    D --> E
    E --> F{配置生效?}
    F -->|是| G[完成]
    F -->|否| H[检查日志]
```

## 📋 配置清单

### 必需配置 (Must Have)

| 配置项 | 说明 | 示例 |
|--------|------|------|
| `NODE_ENV` | 运行环境 | `development` |
| `PORT` | API 端口 | `3000` |
| `DATABASE_URL` | 数据库连接 | `postgresql://...` |
| `REDIS_URL` | Redis 连接 | `redis://localhost:6379` |
| `JWT_SECRET` | JWT 密钥 | 至少32字符 |
| `POSTGRES_USER` | 数据库用户 | `findbiao` |
| `POSTGRES_PASSWORD` | 数据库密码 | 强密码 |
| `POSTGRES_DB` | 数据库名 | `juanie_ai_devops` |

### 推荐配置 (Should Have)

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `CORS_ORIGIN` | CORS 来源 | `http://localhost:5173` |
| `LOG_LEVEL` | 日志级别 | `info` |
| `CACHE_ENABLED` | 启用缓存 | `true` |
| `TRACING_ENABLED` | 启用追踪 | `true` |

### 可选配置 (Nice to Have)

| 配置项 | 说明 | 用途 |
|--------|------|------|
| `GITHUB_CLIENT_ID` | GitHub OAuth | 第三方登录 |
| `GITLAB_CLIENT_ID` | GitLab OAuth | 第三方登录 |
| `OLLAMA_HOST` | Ollama 服务 | AI 功能 |
| `MINIO_*` | MinIO 配置 | 对象存储 |

## 🔧 配置验证

### 自动验证

```bash
# 运行配置检查
bun run check:env

# 检查输出
✅ 所有必需变量已正确配置
⚠️  有 3 个推荐变量未设置
🚀 可以启动应用了!
```

### 手动验证

```bash
# 1. 检查文件存在
ls -la .env

# 2. 检查变量设置
cat .env | grep DATABASE_URL

# 3. 测试数据库连接
docker-compose exec postgres pg_isready

# 4. 测试 Redis 连接
docker-compose exec dragonfly redis-cli ping
```

## 🚨 常见错误

### 错误 1: DATABASE_URL 未设置

**原因**: `.env` 文件不存在或变量未定义

**解决**:
```bash
cp .env.example .env
vim .env  # 添加 DATABASE_URL
```

### 错误 2: ConfigService 依赖注入失败

**原因**: 模块未导入 ConfigModule

**解决**:
```typescript
@Module({
  imports: [ConfigModule],  // 添加这一行
  providers: [YourService],
})
```

### 错误 3: Docker 容器配置不一致

**原因**: `.env` 与 `docker-compose.yml` 配置不匹配

**解决**:
```bash
# 确保 DATABASE_URL 与 POSTGRES_* 一致
POSTGRES_USER=findbiao
POSTGRES_PASSWORD=secret
POSTGRES_DB=mydb
DATABASE_URL=postgresql://findbiao:secret@localhost:5432/mydb
```

## 📚 最佳实践

### ✅ 推荐做法

1. **使用 .env.example 作为模板**
   ```bash
   cp .env.example .env
   ```

2. **运行配置检查**
   ```bash
   bun run check:env
   ```

3. **使用强密码和密钥**
   ```bash
   # 生成随机密钥
   openssl rand -base64 32
   ```

4. **保持配置一致性**
   ```bash
   # DATABASE_URL 必须与 POSTGRES_* 匹配
   ```

5. **使用环境变量引用**
   ```yaml
   # docker-compose.yml
   environment:
     POSTGRES_USER: ${POSTGRES_USER}
   ```

### ❌ 避免做法

1. **不要提交 .env 到 Git**
   ```bash
   # .gitignore 中已包含
   .env
   .env.local
   ```

2. **不要硬编码配置**
   ```typescript
   // ❌ 错误
   const dbUrl = 'postgresql://localhost:5432/mydb'
   ```

3. **不要在多处定义相同配置**
   ```bash
   # ❌ 错误: 在 .env 和 docker-compose.yml 中重复定义
   ```

4. **不要使用弱密码**
   ```bash
   # ❌ 错误
   POSTGRES_PASSWORD=123456
   
   # ✅ 正确
   POSTGRES_PASSWORD=xK9$mP2#vL8@nQ5!
   ```

## 🔗 相关资源

- [详细配置指南](./CONFIGURATION.md)
- [快速启动指南](../QUICK_START.md)
- [环境变量列表](./ENVIRONMENT_VARIABLES.md)
- [故障排查](./TROUBLESHOOTING.md)
- [部署指南](./DEPLOYMENT.md)

## 📞 获取帮助

遇到配置问题?

1. 运行 `bun run check:env` 检查配置
2. 查看 `docs/CONFIGURATION.md` 详细文档
3. 检查 `docker-compose logs` 查看错误日志
4. 参考 `QUICK_START.md` 快速启动指南
