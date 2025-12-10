# 项目创建流程 - 手动验证指南

**目的：** 验证项目创建统一化和流程修复后的功能正确性

**日期：** 2024-12-09

---

## 🎯 验证目标

验证以下核心改进：
1. ✅ 职责清晰（ProjectsService 简化）
2. ✅ 事务支持（失败时自动回滚）
3. ✅ 智能环境创建（避免重复）
4. ✅ 完整返回值（包含关联数据）
5. ✅ 错误处理（具体错误类型）

---

## 📝 前置准备

### 1. 启动服务

```bash
# 1. 启动 Docker 服务（PostgreSQL, Redis）
bun run docker:up

# 2. 确保数据库迁移已应用
bun run db:push

# 3. 启动后端服务
bun run dev:api

# 4. 启动前端服务（新终端）
bun run dev:web
```

### 2. 准备测试数据

```bash
# 清理数据库（可选，如果需要干净环境）
bun run scripts/clean-database.ts

# 检查数据库连接
psql $DATABASE_URL -c "SELECT version();"
```

### 3. 打开浏览器

```
前端: http://localhost:5173
后端: http://localhost:3000
```

---

## 🧪 测试场景

### 场景 1：创建项目（无模板）✅

**目的：** 验证基本项目创建流程

**步骤：**

1. **登录系统**
   - 访问 http://localhost:5173
   - 使用测试账号登录

2. **创建项目**
   - 点击「创建项目」按钮
   - 填写项目信息：
     - 名称：`test-project-no-template`
     - Slug：`test-project-no-template`
     - 描述：`测试项目（无模板）`
     - 可见性：`private`
   - **不选择模板**
   - 点击「创建」

3. **验证结果**

   **✅ 预期行为：**
   - 项目创建成功
   - 自动跳转到项目详情页
   - 显示项目基本信息
   - 显示 3 个默认环境：
     - 开发环境 (development)
     - 预发布环境 (staging)
     - 生产环境 (production)
   - 当前用户自动成为项目 owner

   **🔍 数据库验证：**
   ```sql
   -- 1. 检查项目记录
   SELECT id, name, slug, status, visibility 
   FROM projects 
   WHERE slug = 'test-project-no-template';

   -- 2. 检查项目成员（应该有 1 个 owner）
   SELECT pm.*, u.username, u.email
   FROM project_members pm
   JOIN users u ON pm.user_id = u.id
   WHERE pm.project_id = (SELECT id FROM projects WHERE slug = 'test-project-no-template');

   -- 3. 检查环境（应该有 3 个）
   SELECT id, name, type, status
   FROM environments
   WHERE project_id = (SELECT id FROM projects WHERE slug = 'test-project-no-template');

   -- 4. 检查审计日志
   SELECT action, resource_type, metadata
   FROM audit_logs
   WHERE resource_id = (SELECT id FROM projects WHERE slug = 'test-project-no-template')
   ORDER BY created_at DESC;
   ```

   **📊 API 响应验证：**
   - 打开浏览器开发者工具 → Network
   - 找到 `projects.create` 请求
   - 验证响应包含：
     ```json
     {
       "id": "...",
       "name": "test-project-no-template",
       "slug": "test-project-no-template",
       "status": "active",
       "members": [
         {
           "id": "...",
           "role": "owner",
           "user": { ... }
         }
       ],
       "environments": [
         { "name": "开发环境", "type": "development" },
         { "name": "预发布环境", "type": "staging" },
         { "name": "生产环境", "type": "production" }
       ]
     }
     ```

---

### 场景 2：创建项目（使用模板）✅

**目的：** 验证模板渲染和环境创建

**步骤：**

1. **创建项目**
   - 点击「创建项目」
   - 填写项目信息：
     - 名称：`test-project-with-template`
     - Slug：`test-project-with-template`
     - 描述：`测试项目（使用模板）`
   - **选择模板：** `Next.js 15 App`
   - 点击「创建」

2. **验证结果**

   **✅ 预期行为：**
   - 项目创建成功
   - 模板文件已渲染
   - 如果模板定义了环境，使用模板环境
   - 如果模板未定义环境，创建默认环境

   **🔍 数据库验证：**
   ```sql
   -- 检查项目和环境
   SELECT 
     p.id, p.name, p.slug, p.status,
     COUNT(e.id) as environment_count
   FROM projects p
   LEFT JOIN environments e ON p.id = e.project_id
   WHERE p.slug = 'test-project-with-template'
   GROUP BY p.id;
   ```

---

### 场景 3：创建项目（模板已定义环境）✅

**目的：** 验证智能环境创建（避免重复）

**前提：** 需要一个定义了环境的模板

**步骤：**

1. **检查模板配置**
   - 查看 `templates/nextjs-15-app/template.yaml`
   - 确认是否有 `environments` 配置

2. **创建项目**
   - 使用该模板创建项目
   - 名称：`test-project-template-envs`

3. **验证结果**

   **✅ 预期行为：**
   - 不创建默认环境
   - 只使用模板定义的环境
   - 环境数量 = 模板定义的数量

   **🔍 验证：**
   ```sql
   SELECT 
     e.name, e.type, e.config
   FROM environments e
   WHERE e.project_id = (SELECT id FROM projects WHERE slug = 'test-project-template-envs');
   ```

---

### 场景 4：创建失败 - 事务回滚验证 ⚠️

**目的：** 验证失败时数据一致性（事务回滚）

**步骤：**

1. **模拟创建失败**
   
   **方法 A：重复项目名称**
   - 创建项目：`test-duplicate`
   - 再次创建同名项目：`test-duplicate`
   - 应该失败并显示错误

   **方法 B：无效数据**
   - 使用无效的 organizationId
   - 应该失败

2. **验证结果**

   **✅ 预期行为：**
   - 显示具体错误消息（不是通用错误）
   - 数据库无孤儿数据：
     - 无项目记录
     - 无成员记录
     - 无环境记录
     - 无审计日志

   **🔍 数据库验证：**
   ```sql
   -- 检查是否有孤儿项目（有项目但无成员）
   SELECT p.id, p.name, p.slug
   FROM projects p
   LEFT JOIN project_members pm ON p.id = pm.project_id
   WHERE pm.id IS NULL
   AND p.deleted_at IS NULL;

   -- 检查是否有孤儿环境（有环境但项目不存在）
   SELECT e.id, e.name, e.project_id
   FROM environments e
   LEFT JOIN projects p ON e.project_id = p.id
   WHERE p.id IS NULL;
   ```

---

### 场景 5：错误处理验证 ✅

**目的：** 验证具体的错误类型和消息

**测试用例：**

1. **组织不存在**
   ```bash
   # 使用 API 测试
   curl -X POST http://localhost:3000/trpc/projects.create \
     -H "Content-Type: application/json" \
     -d '{
       "organizationId": "non-existent-org-id",
       "name": "test",
       "slug": "test"
     }'
   ```
   **预期：** `OrganizationNotFoundError` - "组织不存在"

2. **权限不足**
   - 使用非组织成员账号创建项目
   **预期：** `PermissionDeniedError` - "您没有权限执行此操作"

3. **项目名称冲突**
   - 创建已存在的项目名称
   **预期：** `ProjectAlreadyExistsError` - "项目名称 'xxx' 已存在"

4. **模板加载失败**
   - 使用不存在的模板 ID
   **预期：** `TemplateLoadFailedError` - "加载模板失败，请稍后重试"

---

## 📊 验证清单

### 功能验证

- [ ] **场景 1：** 创建项目（无模板）成功
- [ ] **场景 2：** 创建项目（使用模板）成功
- [ ] **场景 3：** 智能环境创建（避免重复）
- [ ] **场景 4：** 失败时事务回滚（无孤儿数据）
- [ ] **场景 5：** 错误处理正确（具体错误类型）

### 数据一致性验证

- [ ] 项目记录正确创建
- [ ] 项目成员（owner）正确添加
- [ ] 环境正确创建（3个默认或模板定义）
- [ ] 审计日志正确记录
- [ ] 失败时无孤儿数据

### API 响应验证

- [ ] 返回完整项目对象（包含 members, environments）
- [ ] 不需要额外查询
- [ ] 错误响应包含具体错误类型和消息

### 性能验证

- [ ] 项目创建时间 < 2 秒（无模板）
- [ ] 项目创建时间 < 5 秒（使用模板）
- [ ] 数据库查询次数合理（使用事务）

---

## 🐛 问题记录

如果发现问题，请记录：

### 问题模板

```markdown
**问题描述：**
[简要描述问题]

**复现步骤：**
1. ...
2. ...

**预期行为：**
[应该发生什么]

**实际行为：**
[实际发生了什么]

**错误日志：**
```
[粘贴错误日志]
```

**数据库状态：**
```sql
-- 相关查询结果
```

**优先级：** P0 / P1 / P2
```

---

## ✅ 验证通过标准

所有以下条件都满足：

1. ✅ 所有 5 个测试场景通过
2. ✅ 数据一致性验证通过
3. ✅ API 响应格式正确
4. ✅ 错误处理正确
5. ✅ 性能符合预期
6. ✅ 无孤儿数据
7. ✅ 事务回滚正常工作

---

## 📝 验证报告

**验证人：** [你的名字]  
**验证日期：** [日期]  
**验证结果：** ✅ 通过 / ⚠️ 部分通过 / ❌ 未通过

**通过的场景：**
- [ ] 场景 1
- [ ] 场景 2
- [ ] 场景 3
- [ ] 场景 4
- [ ] 场景 5

**发现的问题：**
[列出所有问题]

**建议：**
[改进建议]

---

## 🔗 相关文档

- [项目创建流程修复](../troubleshooting/refactoring/project-creation-flow-fixes.md)
- [项目创建统一化](../troubleshooting/refactoring/project-creation-unification-migration.md)
- [错误处理指南](../core/src/errors/error-handling-guide.md)

---

**最后更新：** 2024-12-09
