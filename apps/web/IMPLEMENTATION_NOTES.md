# AI Chat Frontend Implementation Notes

## 完成时间
2026-01-07

## 实施任务
- ✅ Task 3.4: 实现前端 AI Chat Composable
- ✅ Task 3.5: 编写前端 Chat 组件单元测试

## 技术决策

### 1. 为什么不使用 `@ai-sdk/vue` 的官方 API？

**原因**:
- 后端返回的是 **plain text streaming** (`text/plain; charset=utf-8`)
- `@ai-sdk/vue` 期望的是 AI SDK 格式的流式响应（包含 metadata、tool calls 等）
- 后端使用 NestJS + Vercel AI SDK，但响应格式是简化的纯文本流

**解决方案**:
- 实现自定义的 `useAiChat` composable
- 使用原生 `fetch` + `ReadableStream` API 处理流式响应
- 保持与 Vue 3 Composition API 的最佳实践一致

### 2. 消息类型定义

```typescript
interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: Date
}
```

**说明**:
- 不使用 `ai` 包的 `UIMessage` 类型（该类型不包含 `content` 字段）
- 使用简化的自定义类型，符合后端 API 契约
- 保持类型简单、易于理解和维护

### 3. 测试环境配置

**问题**: 
- `@juanie/ui` 包在测试环境中尝试访问 `document` 和 `localStorage`
- Bun test runner 不支持 vitest config

**解决方案**:
1. 创建 `vitest.config.ts` 配置文件
2. 创建 `vitest.setup.ts` mock 浏览器 API
3. 使用 `bunx vitest` 而不是 `bun test`
4. 配置 jsdom 环境

## 文件清单

### 新增文件
1. `apps/web/src/composables/useAiChat.ts` - AI Chat composable 实现
2. `apps/web/src/composables/useAiChat.test.ts` - 单元测试（18 个测试用例）
3. `apps/web/src/composables/README.md` - 使用文档
4. `apps/web/src/views/ai/AiChat.vue` - 示例 UI 组件
5. `apps/web/vitest.config.ts` - Vitest 配置
6. `apps/web/vitest.setup.ts` - 测试环境设置

### 修改文件
1. `apps/web/package.json` - 添加测试脚本和依赖
2. `.kiro/specs/ai-platform-phase1/tasks.md` - 标记任务完成

## 测试结果

```
✓ src/composables/useAiChat.test.ts (18 tests) 1108ms
  ✓ useAiChat (18)
    ✓ 初始化 (3)
    ✓ sendMessage (8)
    ✓ clearMessages (1)
    ✓ regenerate (2)
    ✓ setInput (1)
    ✓ setMessages (1)
    ✓ stopGeneration (1)
    ✓ setSystemPrompt (1)

Test Files  1 passed (1)
     Tests  18 passed (18)
```

**测试覆盖**:
- ✅ 初始化和默认值
- ✅ 流式消息发送和接收
- ✅ 错误处理和回调
- ✅ 多租户隔离（header 传递）
- ✅ 系统提示词传递
- ✅ 消息历史管理
- ✅ 重新生成功能
- ✅ 停止生成功能

## API 契约

### 后端端点
```
POST /api/ai/chat
```

### 请求
```typescript
{
  messages: Message[]
  tenantId: string
  systemPrompt?: string
}
```

### 响应
- Content-Type: `text/plain; charset=utf-8`
- Transfer-Encoding: `chunked`
- 流式文本响应

### Headers
- `x-tenant-id`: 租户 ID（多租户隔离）

## 功能特性

### 已实现 ✅
1. **流式响应处理** - 使用 ReadableStream API
2. **多租户隔离** - 通过 header 和 body 传递租户 ID
3. **错误处理** - 统一的错误处理和用户提示
4. **消息历史** - 完整的对话历史管理
5. **响应式状态** - Vue 3 Composition API
6. **TypeScript 支持** - 完整的类型定义
7. **单元测试** - 18 个测试用例，100% 通过

### 待实现 🚧
1. **AbortController** - 真正的停止生成功能
2. **消息编辑** - 编辑历史消息
3. **消息删除** - 删除特定消息
4. **持久化** - LocalStorage 保存对话历史
5. **工具调用可视化** - 动态 UI 组件渲染
6. **多模态输入** - 图片、文件上传

## 性能考虑

1. **流式渲染优化** - 使用数组解构触发响应式更新
2. **内存管理** - 及时清理 ReadableStream reader
3. **错误恢复** - 自动重试和降级策略
4. **租户隔离** - 使用 computed 避免重复计算

## 安全考虑

1. **租户隔离** - 多层验证（header + body）
2. **输入验证** - 空消息检查
3. **错误脱敏** - 不暴露敏感错误信息
4. **XSS 防护** - Vue 自动转义内容

## 下一步

### 立即任务
1. 继续 Task 4.1: 实现 Tool Registry Service
2. 继续 Task 4.2-4.4: 实现具体工具（showClusterDashboard, showDeploymentDiff, showDiagnosticTree）

### 后续优化
1. 实现 AbortController 支持
2. 添加消息持久化
3. 实现工具调用结果的动态 UI 渲染
4. 添加多模态输入支持

## 参考资料

- [Vercel AI SDK Documentation](https://sdk.vercel.ai/docs)
- [Vue 3 Composition API](https://vuejs.org/guide/extras/composition-api-faq.html)
- [ReadableStream API](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream)
- [Vitest Documentation](https://vitest.dev/)
