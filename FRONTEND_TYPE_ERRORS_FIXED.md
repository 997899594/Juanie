# 前端类型错误修复总结

## 已解决的问题 ✅

### 1. Cookie 类型问题 ✅
- **问题**：`@fastify/cookie` 的 `setCookie` 方法类型找不到
- **解决方案**：在 `auth.router.ts` 顶部添加 `import '@fastify/cookie'` 确保类型扩展被加载

### 2. Monorepo 类型引用 ✅
- **问题**：web 直接引用 api-gateway 源码，导致 vue-tsc 检查后端代码
- **解决方案**：
  - api-gateway 通过 `package.json` 的 `exports` 字段导出类型路径
  - web 通过 `@juanie/api-gateway/router-types` 引用
  - web 的 `tsconfig.json` 排除 `../api-gateway/**/*`

### 3. 已添加的 API 别名 ✅
- `projects.getById` - 别名到 `get`
- `projects.members.*` - 嵌套 router（list/add/remove）
- `projects.getRecentActivities` - stub 实现
- `projects.updateDeploySettings` - stub 实现
- `environments.getById` - 别名到 `get`
- `environments.listByProject` - 返回 `{ environments: [] }`
- `deployments.getByProject` - stub 实现
- `deployments.getStats` - stub 实现

### 4. 已修复的前端调用 ✅
- `CreateEnvironmentModal` - 添加 `type` 字段
- `EditProjectModal` - 使用 `projectId` 而不是 `id`
- `ProjectSettings` - delete 方法参数修正

## 剩余问题（131 个错误）

### 主要问题类型

1. **数据结构不匹配**（~80 个）
   - 后端返回的数据结构和前端期望的不一致
   - 例如：`getStats` 返回 `{ total, success, failed, pending }` 但前端期望有 `avgDeploymentTime`
   - 例如：`getByProject` 返回空数组，前端无法推断类型

2. **缺失的字段**（~30 个）
   - `environment.description` - 数据库 schema 没有这个字段
   - `environment.status` - 数据库 schema 没有这个字段
   - `project.displayName` - 数据库 schema 没有这个字段

3. **类型推断问题**（~21 个）
   - 空数组导致 TypeScript 推断为 `never[]`
   - 需要明确的类型定义

## 下一步行动

### 选项 1：完善后端实现（推荐）
1. 实现真实的业务逻辑
2. 确保返回的数据结构符合前端期望
3. 添加缺失的数据库字段

### 选项 2：调整前端期望（临时方案）
1. 修改前端代码适配当前的后端返回
2. 移除对不存在字段的引用
3. 添加类型断言处理空数据

### 选项 3：添加类型定义（快速修复）
1. 为 stub API 添加明确的返回类型
2. 使用 `as` 断言临时绕过类型检查
3. 标记 TODO 待后续实现

## 错误统计

- 初始错误：79（包含 setCookie）
- Cookie 修复后：64
- 添加 API 后：133（引入新的类型不匹配）
- 修复前端调用后：131
- 目标：0

## 建议

当前的 131 个错误主要是因为：
1. 后端 API 是 stub 实现，返回空数据
2. 数据库 schema 和前端期望不一致
3. 需要完善业务逻辑

**建议采用选项 3（快速修复）+ 选项 1（长期方案）**：
- 先添加类型定义让项目能编译通过
- 然后逐步实现真实的业务逻辑
