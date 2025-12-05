---
inclusion: always
---

# 协作原则

## 核心理念

**使用正确的方案，而非临时方案。优先使用成熟的工具和库，而非手写实现。**

**追求正确、完整、简洁而不简单的实现。不要为了"最小改动"而妥协设计质量。**

**❌ 绝不向后兼容：任何时候都直接替换现有实现，不保留旧代码，不添加兼容层。**

## 技术选型原则

### 1. 优先使用现有工具和库

**✅ 推荐做法：**
- 使用成熟的 npm 包解决常见问题
- 使用框架提供的官方工具和插件
- 使用行业标准的解决方案

**❌ 避免做法：**
- 手写已有成熟库的功能（如日期处理、UUID 生成、加密等）
- 自己实现框架已提供的功能
- 使用过时或不维护的包

**示例：**
```typescript
// ❌ 避免：手写 UUID 生成
function generateId() {
  return Math.random().toString(36).substring(7);
}

// ✅ 推荐：使用成熟的库
import { nanoid } from 'nanoid';
const id = nanoid();

// ❌ 避免：手写日期格式化
function formatDate(date: Date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

// ✅ 推荐：使用 dayjs
import dayjs from 'dayjs';
const formatted = dayjs(date).format('YYYY-MM-DD');
```

### 2. 使用前沿但稳定的技术

**技术选择标准：**
- 优先选择最新稳定版本（非 beta/alpha）
- 选择有活跃社区和维护的项目
- 选择有良好文档和类型支持的工具
- 选择符合行业趋势的技术

**当前项目的前沿选择：**
- Bun（而非 Node.js）- 更快的运行时
- Vite 7（而非 Webpack）- 更快的构建
- Tailwind CSS 4（而非传统 CSS）- 现代化样式方案
- tRPC（而非 REST）- 端到端类型安全
- Drizzle ORM（而非 TypeORM）- 更好的类型推断
- Biome（而非 ESLint + Prettier）- 更快的 linting

### 3. 避免临时方案和 Workaround

**✅ 正确做法：**
- 找到问题的根本原因
- 使用官方推荐的解决方案
- 如果需要自定义，基于官方 API 扩展
- 记录为什么选择某个方案

**❌ 避免做法：**
- 使用 `setTimeout` 解决竞态条件
- 使用 `any` 绕过类型检查
- 使用 `// @ts-ignore` 忽略错误
- 使用硬编码的延迟或重试
- 使用全局变量传递状态

**示例：**
```typescript
// ❌ 避免：临时方案
setTimeout(() => {
  // 等待某个异步操作完成
  checkStatus();
}, 1000);

// ✅ 推荐：使用正确的异步模式
await waitForCondition(() => isReady(), { timeout: 5000 });

// ❌ 避免：忽略类型错误
// @ts-ignore
const result = someFunction(wrongType);

// ✅ 推荐：修复类型定义
const result = someFunction(correctType as ExpectedType);
```

### 4. 使用声明式而非命令式

**✅ 推荐：**
- 使用配置文件而非脚本
- 使用 ORM 而非原始 SQL
- 使用状态机而非 if-else 链
- 使用 Schema 验证而非手动检查

**示例：**
```typescript
// ❌ 避免：命令式状态管理
if (status === 'pending') {
  if (hasError) {
    status = 'failed';
  } else if (isComplete) {
    status = 'success';
  }
}

// ✅ 推荐：使用状态机
const stateMachine = createMachine({
  initial: 'pending',
  states: {
    pending: {
      on: {
        ERROR: 'failed',
        COMPLETE: 'success',
      },
    },
    failed: { type: 'final' },
    success: { type: 'final' },
  },
});
```

## 代码质量原则

### 1. 类型安全优先

- 启用 TypeScript 严格模式
- 避免使用 `any`，使用 `unknown` 或具体类型
- 使用 Zod 等库进行运行时验证
- 利用 tRPC 实现端到端类型安全

### 2. 错误处理要完整

```typescript
// ❌ 避免：忽略错误
try {
  await riskyOperation();
} catch (e) {
  console.log('Error:', e);
}

// ✅ 推荐：完整的错误处理
try {
  await riskyOperation();
} catch (error) {
  if (error instanceof SpecificError) {
    // 处理特定错误
    logger.error('Specific error occurred', { error, context });
    throw new AppError('User-friendly message', { cause: error });
  }
  // 处理未知错误
  logger.error('Unexpected error', { error });
  throw error;
}
```

### 3. 使用现代 JavaScript/TypeScript 特性

```typescript
// ✅ 使用可选链
const value = obj?.nested?.property;

// ✅ 使用空值合并
const result = value ?? defaultValue;

// ✅ 使用解构
const { id, name, ...rest } = user;

// ✅ 使用模板字符串
const message = `User ${name} has ${count} items`;

// ✅ 使用 async/await 而非 Promise 链
const result = await fetchData();
```

## 架构原则

### 1. 关注点分离

- 业务逻辑放在 Service 层
- 数据验证放在 DTO/Schema
- 路由只负责请求/响应转换
- 组件只负责 UI 渲染

### 2. 依赖注入

```typescript
// ✅ 使用 NestJS 依赖注入
@Injectable()
export class ProjectService {
  constructor(
    private readonly db: DatabaseService,
    private readonly queue: QueueService,
  ) {}
}

// ❌ 避免：直接导入实例
import { db } from './database';
```

### 3. 事件驱动架构

```typescript
// ✅ 使用事件解耦
this.eventEmitter.emit('project.created', { projectId });

// ❌ 避免：直接调用其他服务
await this.gitopsService.setupProject(projectId);
await this.notificationService.sendEmail(projectId);
```

## 工具使用原则

### 优先使用的工具

**数据处理：**
- `lodash-es` - 数据操作
- `dayjs` - 日期处理
- `zod` - Schema 验证
- `nanoid` - ID 生成

**HTTP 请求：**
- `axios` - HTTP 客户端（如果不用 tRPC）
- `@trpc/client` - tRPC 客户端

**状态管理：**
- `pinia` - Vue 状态管理
- `@vueuse/core` - Vue 组合式工具

**UI 组件：**
- `shadcn-vue` - UI 组件库
- `lucide-vue-next` - 图标

**工具库：**
- `@nestjs/*` - NestJS 生态
- `drizzle-orm` - 数据库 ORM
- `bullmq` - 队列管理

### 避免重复造轮子

在实现新功能前，先问自己：
1. 是否有现成的 npm 包？
2. 框架是否已提供此功能？
3. 项目中是否已有类似实现？
4. 是否可以复用现有代码？

## 性能优化原则

### 1. 使用正确的数据结构

```typescript
// ❌ 避免：使用数组查找
const user = users.find(u => u.id === targetId);

// ✅ 推荐：使用 Map
const userMap = new Map(users.map(u => [u.id, u]));
const user = userMap.get(targetId);
```

### 2. 使用缓存

```typescript
// ✅ 使用 Redis 缓存
@Cacheable({ ttl: 3600 })
async getProject(id: string) {
  return this.db.query.projects.findFirst({ where: eq(schema.projects.id, id) });
}
```

### 3. 使用批量操作

```typescript
// ❌ 避免：循环中的数据库操作
for (const item of items) {
  await db.insert(schema.items).values(item);
}

// ✅ 推荐：批量插入
await db.insert(schema.items).values(items);
```

## 文档和注释原则

### 1. 代码应该自解释

```typescript
// ❌ 避免：需要注释才能理解的代码
// Check if user is admin
if (u.r === 1) {
  // ...
}

// ✅ 推荐：自解释的代码
if (user.role === UserRole.Admin) {
  // ...
}
```

### 2. 复杂逻辑需要注释

```typescript
// ✅ 解释"为什么"而非"是什么"
// GitHub requires Deploy Keys for SSH auth, while GitLab uses Project Access Tokens
// This is because GitHub doesn't support fine-grained tokens for Git operations
if (provider === 'github') {
  await this.createDeployKey(repoId);
} else {
  await this.createAccessToken(repoId);
}
```

### 3. 使用 JSDoc 注释公共 API

```typescript
/**
 * 初始化项目的 GitOps 配置
 * 
 * @param projectId - 项目 ID
 * @param options - 初始化选项
 * @returns 初始化结果，包含 Git 仓库 URL 和认证信息
 * @throws {GitOpsError} 当 Git 认证失败时
 */
async initializeGitOps(
  projectId: string,
  options: GitOpsInitOptions,
): Promise<GitOpsInitResult> {
  // ...
}
```

## 测试原则

### 1. 测试重要的业务逻辑

```typescript
// ✅ 测试状态机转换
describe('ProjectStateMachine', () => {
  it('should transition from pending to running', () => {
    const machine = createProjectStateMachine();
    const nextState = machine.transition('pending', 'START');
    expect(nextState.value).toBe('running');
  });
});
```

### 2. 使用测试工具而非手写断言

```typescript
// ✅ 使用 Vitest 的匹配器
expect(result).toMatchObject({ id: expect.any(String) });
expect(array).toHaveLength(3);
expect(fn).toHaveBeenCalledWith(expectedArg);
```

## 设计质量原则

### 正确、完整、简洁而不简单

**✅ 正确的实现：**
- 使用正确的架构模式解决问题
- 单一数据源，避免状态不一致
- 完整的错误处理和边界情况
- 符合业务逻辑的设计

**✅ 完整的实现：**
- 考虑所有使用场景
- 处理所有边界情况
- 提供必要的扩展点
- 包含适当的日志和监控

**✅ 简洁而不简单：**
- 代码清晰易懂，但不过度简化
- 抽象恰到好处，不过度设计
- 使用合适的设计模式，不滥用
- 保持代码可维护性和可扩展性

**❌ 避免的做法：**
- 为了"最小改动"而妥协设计质量
- 使用临时方案绕过问题
- 过度简化导致功能不完整
- 过度设计导致代码复杂

**示例：**
```typescript
// ❌ 避免：最小改动但不正确
// 在前端加个 if 判断防止进度回退
if (newProgress >= currentProgress) {
  setProgress(newProgress);
}

// ✅ 推荐：正确的单一数据源设计
// 使用 WebSocket 作为唯一的进度数据源
// 后端保证进度单调递增
// 前端只负责展示，不做业务逻辑
```

## 向后兼容原则

### ❌ 绝不向后兼容

**核心规则：**
- 任何时候都直接替换现有实现
- 不保留旧代码
- 不添加兼容层
- 不创建包装函数来保持旧 API
- 直接修改所有调用方

**为什么不向后兼容：**
1. 避免代码库中存在两套实现
2. 防止技术债务累积
3. 保持代码库简洁
4. 强制使用最新最好的方案
5. 减少维护负担

**示例：**
```typescript
// ❌ 错误：添加兼容层
// 旧实现
async function fetchOrganizations() {
  // 手动状态管理
}

// 新实现 + 兼容层
const { data: organizations } = useQuery(...)
const fetchOrganizations = () => organizations.value // 包装函数

// ✅ 正确：直接替换
// 删除旧的 fetchOrganizations 函数
// 所有调用方直接使用 useQuery 返回的 data
const { data: organizations } = useQuery(...)
// 调用方直接使用 organizations.value
```

**实施步骤：**
1. 实现新方案
2. 删除旧代码
3. 修改所有调用方
4. 不保留任何旧实现的痕迹

## 总结

记住这些核心原则：

1. **使用工具，不要重复造轮子**
2. **使用正确的方案，不要临时 workaround**
3. **使用前沿但稳定的技术**
4. **类型安全优先**
5. **代码应该自解释**
6. **关注点分离**
7. **声明式优于命令式**
8. **正确、完整、简洁而不简单**
9. **❌ 绝不向后兼容 - 直接替换，不保留旧代码**

当遇到问题时，优先考虑：
1. 是否有官方解决方案？
2. 是否有成熟的第三方库？
3. 是否可以用更好的架构模式解决？
4. 这个方案是否可维护和可扩展？
5. 这个方案是否正确、完整、简洁而不简单？
6. 是否需要向后兼容？（答案永远是：不需要）
