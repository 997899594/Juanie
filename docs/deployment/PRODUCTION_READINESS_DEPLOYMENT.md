# 项目生产就绪功能部署指南

## 概述

本文档描述如何部署项目生产就绪功能，包括数据库迁移、系统模板初始化和服务更新。

---

## 部署前准备

### 1. 环境检查

确认以下环境已就绪：

```bash
# 检查数据库连接
psql $DATABASE_URL -c "SELECT version();"

# 检查 Kubernetes 集群
kubectl cluster-info

# 检查 Flux 状态
kubectl get pods -n flux-system

# 检查当前服务版本
kubectl get deployments -n your-namespace
```

### 2. 备份数据库

**重要：** 在执行任何迁移前，务必备份数据库！

```bash
# 创建备份目录
mkdir -p backups

# 备份数据库
pg_dump $DATABASE_URL > backups/backup_$(date +%Y%m%d_%H%M%S).sql

# 验证备份文件
ls -lh backups/
```

### 3. 准备配置

确认以下配置已更新：

- 环境变量（DATABASE_URL, QUEUE_URL 等）
- Kubernetes ConfigMap
- Kubernetes Secret
- Ingress 配置

---

## 数据库迁移

### 步骤 1: 生成迁移文件

```bash
cd packages/core/database

# 生成迁移文件
bun run drizzle-kit generate:pg

# 查看生成的迁移文件
ls -la drizzle/migrations/
```

### 步骤 2: 审查迁移 SQL

打开生成的迁移文件，确认 SQL 语句正确：

```sql
-- 应该包含以下内容:

-- 1. 创建 project_templates 表
CREATE TABLE IF NOT EXISTS "project_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "slug" text NOT NULL UNIQUE,
  ...
);

-- 2. 创建 project_events 表
CREATE TABLE IF NOT EXISTS "project_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id" uuid NOT NULL,
  ...
);

-- 3. 更新 projects 表
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "initialization_status" jsonb;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "template_id" text;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "health_score" integer;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "health_status" text;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "last_health_check" timestamp;

-- 4. 创建索引
CREATE INDEX IF NOT EXISTS "idx_projects_template_id" ON "projects"("template_id");
CREATE INDEX IF NOT EXISTS "idx_projects_health_status" ON "projects"("health_status");
CREATE INDEX IF NOT EXISTS "idx_project_events_project_id" ON "project_events"("project_id");
CREATE INDEX IF NOT EXISTS "idx_project_events_event_type" ON "project_events"("event_type");
```

### 步骤 3: 执行迁移

```bash
# 在开发环境测试
DATABASE_URL="postgresql://..." bun run drizzle-kit push:pg

# 验证迁移成功
psql $DATABASE_URL -c "\dt"  # 查看所有表
psql $DATABASE_URL -c "\d projects"  # 查看 projects 表结构
psql $DATABASE_URL -c "\d project_templates"  # 查看新表
psql $DATABASE_URL -c "\d project_events"  # 查看新表
```

### 步骤 4: 验证迁移

```bash
# 检查新表是否存在
psql $DATABASE_URL -c "SELECT COUNT(*) FROM project_templates;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM project_events;"

# 检查 projects 表的新字段
psql $DATABASE_URL -c "SELECT initialization_status, template_id, health_score FROM projects LIMIT 1;"
```

---

## 系统模板初始化

### 步骤 1: 准备 Seed 数据

系统模板数据已在 `packages/core/database/src/seeds/project-templates.seed.ts` 中定义。

包含以下模板：
1. React 应用模板
2. Node.js API 模板
3. Go 微服务模板
4. Python API 模板
5. 静态网站模板

### 步骤 2: 执行 Seed

```bash
cd packages/core/database

# 运行 seed 脚本
bun run src/seeds/project-templates.seed.ts

# 或者使用 tsx
npx tsx src/seeds/project-templates.seed.ts
```

### 步骤 3: 验证模板

```bash
# 检查系统模板数量
psql $DATABASE_URL -c "SELECT COUNT(*) FROM project_templates WHERE is_system = true;"

# 查看所有系统模板
psql $DATABASE_URL -c "SELECT id, name, slug, category FROM project_templates WHERE is_system = true;"

# 应该看到 5 个系统模板:
# - react-app
# - nodejs-api
# - go-microservice
# - python-api
# - static-website
```

---

## 服务部署

### 步骤 1: 构建新镜像

```bash
# 构建 API Gateway
cd apps/api-gateway
docker build -t your-registry/api-gateway:v2.0.0 .
docker push your-registry/api-gateway:v2.0.0

# 构建 Web 前端
cd apps/web
docker build -t your-registry/web:v2.0.0 .
docker push your-registry/web:v2.0.0
```

### 步骤 2: 更新 Kubernetes 配置

更新 `infra/gitops/apps/api-gateway/deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-gateway
spec:
  template:
    spec:
      containers:
      - name: api-gateway
        image: your-registry/api-gateway:v2.0.0  # 更新版本
        env:
        - name: ENABLE_PROJECT_ORCHESTRATOR
          value: "true"
        - name: ENABLE_TEMPLATE_MANAGER
          value: "true"
        - name: ENABLE_HEALTH_MONITOR
          value: "true"
```

### 步骤 3: 提交到 Git

```bash
cd infra/gitops

git add .
git commit -m "feat: deploy project production readiness features"
git push origin main
```

### 步骤 4: 等待 Flux 同步

```bash
# 查看 Flux 同步状态
kubectl get kustomization -n flux-system

# 强制同步（如果需要）
flux reconcile kustomization apps --with-source

# 查看部署状态
kubectl rollout status deployment/api-gateway -n your-namespace
kubectl rollout status deployment/web -n your-namespace
```

### 步骤 5: 验证服务

```bash
# 检查 Pod 状态
kubectl get pods -n your-namespace

# 查看服务日志
kubectl logs -n your-namespace deployment/api-gateway --tail=50

# 测试健康检查
curl http://your-api-gateway/health

# 应该返回:
# {
#   "status": "healthy",
#   "services": {
#     "database": "healthy",
#     "queue": "healthy",
#     "templateManager": "healthy",
#     "healthMonitor": "healthy"
#   }
# }
```

---

## 功能验证

### 1. 验证模板功能

```bash
# 测试模板列表 API
curl -X GET "http://your-api-gateway/api/trpc/templates.list" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 应该返回 5 个系统模板
```

### 2. 验证项目创建

通过 UI 测试：

1. 登录系统
2. 点击 "创建项目"
3. 选择一个模板（如 React 应用）
4. 配置 Git 仓库
5. 配置环境
6. 提交创建
7. 观察初始化进度
8. 验证项目创建成功

### 3. 验证健康度监控

```bash
# 测试健康度 API
curl -X GET "http://your-api-gateway/api/trpc/projects.getHealth?projectId=YOUR_PROJECT_ID" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 应该返回健康度信息
```

### 4. 验证审批流程

1. 创建一个部署到生产环境的请求
2. 验证审批请求是否创建
3. 验证审批人是否收到通知
4. 测试批准/拒绝功能
5. 验证部署是否正确执行

---

## 回滚计划

如果部署出现问题，按以下步骤回滚：

### 1. 回滚服务

```bash
# 回滚到上一个版本
kubectl rollout undo deployment/api-gateway -n your-namespace
kubectl rollout undo deployment/web -n your-namespace

# 或者回滚到特定版本
kubectl rollout undo deployment/api-gateway --to-revision=2 -n your-namespace
```

### 2. 回滚数据库

```bash
# 恢复数据库备份
psql $DATABASE_URL < backups/backup_YYYYMMDD_HHMMSS.sql

# 验证数据恢复
psql $DATABASE_URL -c "SELECT COUNT(*) FROM projects;"
```

### 3. 清理新数据

如果只需要清理新添加的数据：

```bash
# 删除系统模板
psql $DATABASE_URL -c "DELETE FROM project_templates WHERE is_system = true;"

# 删除新字段的数据（保留表结构）
psql $DATABASE_URL -c "UPDATE projects SET initialization_status = NULL, template_id = NULL, health_score = NULL, health_status = NULL;"
```

---

## 监控和告警

### 部署后监控

部署完成后，持续监控以下指标：

**应用指标：**
```bash
# 查看 Pod 资源使用
kubectl top pods -n your-namespace

# 查看服务日志
kubectl logs -f deployment/api-gateway -n your-namespace

# 查看事件
kubectl get events -n your-namespace --sort-by='.lastTimestamp'
```

**业务指标：**
- 项目创建成功率
- 初始化平均耗时
- 健康度计算性能
- API 响应时间

**数据库指标：**
```sql
-- 查看新表的数据量
SELECT 
  'project_templates' as table_name, 
  COUNT(*) as count 
FROM project_templates
UNION ALL
SELECT 
  'project_events' as table_name, 
  COUNT(*) as count 
FROM project_events;

-- 查看使用模板的项目数量
SELECT 
  template_id, 
  COUNT(*) as project_count 
FROM projects 
WHERE template_id IS NOT NULL 
GROUP BY template_id;
```

### 告警配置

在 Prometheus 中配置告警规则：

```yaml
# monitoring/alerts.yml
groups:
- name: project_production_readiness
  rules:
  - alert: ProjectInitializationFailed
    expr: rate(project_initialization_failures_total[5m]) > 0.1
    for: 5m
    annotations:
      summary: "项目初始化失败率过高"
      
  - alert: HealthMonitorSlow
    expr: health_calculation_duration_seconds > 10
    for: 5m
    annotations:
      summary: "健康度计算耗时过长"
      
  - alert: TemplateRenderingFailed
    expr: rate(template_rendering_failures_total[5m]) > 0.05
    for: 5m
    annotations:
      summary: "模板渲染失败率过高"
```

---

## 故障排查

### 常见问题

**问题 1: 迁移失败**

```bash
# 检查数据库连接
psql $DATABASE_URL -c "SELECT 1;"

# 检查数据库权限
psql $DATABASE_URL -c "SELECT current_user, current_database();"

# 查看详细错误
bun run drizzle-kit push:pg --verbose
```

**问题 2: Seed 失败**

```bash
# 检查是否已存在数据
psql $DATABASE_URL -c "SELECT * FROM project_templates WHERE slug = 'react-app';"

# 如果存在，先删除
psql $DATABASE_URL -c "DELETE FROM project_templates WHERE is_system = true;"

# 重新运行 seed
bun run src/seeds/project-templates.seed.ts
```

**问题 3: 服务启动失败**

```bash
# 查看 Pod 日志
kubectl logs deployment/api-gateway -n your-namespace

# 查看 Pod 事件
kubectl describe pod POD_NAME -n your-namespace

# 常见原因:
# - 环境变量配置错误
# - 数据库连接失败
# - 依赖服务不可用
```

---

## 性能优化建议

### 1. 数据库索引

确保以下索引已创建：

```sql
-- 项目查询优化
CREATE INDEX IF NOT EXISTS idx_projects_org_status 
ON projects(organization_id, status);

CREATE INDEX IF NOT EXISTS idx_projects_template 
ON projects(template_id) WHERE template_id IS NOT NULL;

-- 事件查询优化
CREATE INDEX IF NOT EXISTS idx_project_events_created 
ON project_events(project_id, created_at DESC);

-- 模板查询优化
CREATE INDEX IF NOT EXISTS idx_templates_category 
ON project_templates(category, is_public);
```

### 2. 缓存配置

启用 Redis 缓存：

```yaml
# 在 ConfigMap 中配置
REDIS_URL: redis://redis:6379
CACHE_TTL_TEMPLATES: 3600  # 模板缓存 1 小时
CACHE_TTL_HEALTH: 300      # 健康度缓存 5 分钟
```

### 3. 资源限制

调整服务资源配置：

```yaml
resources:
  requests:
    cpu: "500m"
    memory: "512Mi"
  limits:
    cpu: "2000m"
    memory: "2Gi"
```

---

## 相关文档

- [API 参考文档](../api/projects/PROJECT_API.md)
- [项目创建指南](../guides/PROJECT_CREATION_GUIDE.md)
- [故障排查指南](../guides/TROUBLESHOOTING_GUIDE.md)
- [数据库 Schema 文档](../architecture/database.md)
