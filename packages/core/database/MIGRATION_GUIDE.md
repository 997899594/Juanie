# Database Migration Guide - Project Production Readiness

本指南说明如何应用 Project Production Readiness 功能的数据库迁移。

## 新增内容

### 新表

1. **project_templates** - 项目模板表
   - 存储系统预设和自定义项目模板
   - 包含 K8s 配置模板、CI/CD 模板等

2. **project_events** - 项目事件表
   - 记录项目生命周期中的所有事件
   - 支持事件驱动架构

### 更新的表

**projects** 表新增字段：
- `initialization_status` - 项目初始化状态
- `template_id` - 使用的模板 ID
- `template_config` - 模板配置
- `health_score` - 健康度评分 (0-100)
- `health_status` - 健康状态 (healthy/warning/critical)
- `last_health_check` - 最后健康检查时间

## 应用迁移

### 1. 生成迁移文件（已完成）

迁移文件已通过 Drizzle Kit 自动生成：
```bash
bun run db:generate
```

生成的文件：`drizzle/0001_blushing_groot.sql`

### 2. 应用迁移到数据库

```bash
# 方式 1: 使用 Drizzle Kit push（开发环境）
bun run db:push

# 方式 2: 使用 Drizzle Kit migrate（生产环境）
bun run db:migrate
```

### 3. 插入系统模板数据

迁移完成后，需要插入 5 个系统预设模板：

```bash
bun run db:seed:templates
```

这将插入以下模板：
- React Application
- Node.js API
- Go Microservice
- Python API
- Static Website

## 验证迁移

### 检查表是否创建成功

```sql
-- 检查 project_templates 表
SELECT COUNT(*) FROM project_templates WHERE is_system = true;
-- 应该返回 5

-- 检查 project_events 表
SELECT * FROM project_events LIMIT 1;

-- 检查 projects 表的新字段
SELECT 
  id, 
  name, 
  template_id, 
  health_status, 
  initialization_status 
FROM projects 
LIMIT 1;
```

### 使用 Drizzle Studio 查看

```bash
bun run db:studio
```

在浏览器中打开 https://local.drizzle.studio 查看数据库结构。

## 回滚迁移

如果需要回滚迁移：

```sql
-- 删除新表
DROP TABLE IF EXISTS project_events CASCADE;
DROP TABLE IF EXISTS project_templates CASCADE;

-- 删除 projects 表的新字段
ALTER TABLE projects 
  DROP COLUMN IF EXISTS initialization_status,
  DROP COLUMN IF EXISTS template_id,
  DROP COLUMN IF EXISTS template_config,
  DROP COLUMN IF EXISTS health_score,
  DROP COLUMN IF EXISTS health_status,
  DROP COLUMN IF EXISTS last_health_check;

-- 删除新索引
DROP INDEX IF EXISTS projects_template_idx;
DROP INDEX IF EXISTS projects_health_status_idx;
```

## 注意事项

1. **备份数据库**：在应用迁移前，请务必备份生产数据库
2. **测试环境先行**：先在测试环境验证迁移，确认无误后再应用到生产环境
3. **停机时间**：迁移过程中可能需要短暂停机，建议在低峰期进行
4. **监控**：迁移后密切监控应用日志和数据库性能

## 相关文件

- Schema 定义：
  - `src/schemas/project-templates.schema.ts`
  - `src/schemas/project-events.schema.ts`
  - `src/schemas/projects.schema.ts`
  
- Seed 数据：
  - `src/seeds/project-templates.seed.ts`
  
- 迁移文件：
  - `drizzle/0001_blushing_groot.sql`
  
- Seed 脚本：
  - `src/scripts/seed-templates.ts`
