# AI 模块增强 - 实现计划

## 任务列表

- [x] 1. 扩展类型定义和 Schema
- [x] 1.1 扩展 `packages/types/src/ai.types.ts` 添加新的 AI 类型
  - 添加 `AIProvider`, `AIClientConfig`, `AIMessage`, `AICompletionOptions`, `AICompletionResult`, `AIFunction` 类型
  - 扩展 `AIModel` 类型支持 Claude, GPT, GLM, Qwen 模型
  - _Requirements: 1.1, 1.2, 1.3-1.7_

- [x] 1.2 创建数据库 Schema
  - 创建 `packages/core/src/database/schemas/ai-prompt-templates.schema.ts`
  - 创建 `packages/core/src/database/schemas/ai-conversations.schema.ts`
  - 创建 `packages/core/src/database/schemas/ai-usage.schema.ts`
  - 在 `packages/core/src/database/schemas/index.ts` 中导出新 schema
  - _Requirements: 2.4, 4.1, 5.1_

- [x] 1.3 创建数据库迁移文件
  - 创建 `packages/core/drizzle/0004_add_ai_features.sql`
  - 包含所有表和索引的创建语句
  - _Requirements: 2.4, 4.1, 5.1_

- [x] 2. 实现统一 AI 客户端接口
- [x] 2.1 创建 AI 客户端接口
  - 创建 `packages/services/extensions/src/ai/ai/ai-client.interface.ts`
  - 定义 `IAIClient` 接口
  - _Requirements: 1.1_

- [x] 2.2 实现 AI 客户端工厂
  - 创建 `packages/services/extensions/src/ai/ai/ai-client-factory.ts`
  - 实现 `AIClientFactory` 类,支持创建不同提供商的客户端
  - _Requirements: 1.2_

- [x] 2.3 实现 Claude 适配器
  - 创建 `packages/services/extensions/src/ai/ai/adapters/claude.adapter.ts`
  - 使用 Vercel AI SDK 的 `@ai-sdk/anthropic`
  - 实现同步和流式调用
  - _Requirements: 1.5, 1.8_

- [x] 2.4 实现 OpenAI 适配器
  - 创建 `packages/services/extensions/src/ai/ai/adapters/openai.adapter.ts`
  - 使用 Vercel AI SDK 的 `@ai-sdk/openai`
  - 实现同步和流式调用
  - _Requirements: 1.6, 1.8_

- [x] 2.5 实现智谱 GLM 适配器
  - 创建 `packages/services/extensions/src/ai/ai/adapters/zhipu.adapter.ts`
  - 使用 `createOpenAI` 创建智谱客户端
  - 实现同步和流式调用
  - _Requirements: 1.3, 1.8_

- [x] 2.6 实现阿里 Qwen 适配器
  - 创建 `packages/services/extensions/src/ai/ai/adapters/qwen.adapter.ts`
  - 使用 `createOpenAI` 创建 Qwen 客户端
  - 实现同步和流式调用
  - _Requirements: 1.4, 1.8_

- [x] 2.7 实现 Ollama 适配器
  - 创建 `packages/services/extensions/src/ai/ai/adapters/ollama.adapter.ts`
  - 复用现有的 `OllamaClient`
  - 实现同步和流式调用
  - _Requirements: 1.7, 1.8_

- [ ]* 2.8 编写属性测试 - 适配器接口一致性
  - **Property 1: 适配器接口一致性**
  - **Validates: Requirements 1.1, 1.8**
  - 测试所有适配器都实现了 `IAIClient` 接口的所有方法

- [ ]* 2.9 编写属性测试 - 提供商适配器创建
  - **Property 2: 提供商适配器创建**
  - **Validates: Requirements 1.2**
  - 测试工厂能为所有支持的提供商创建适配器

- [x] 3. 实现提示词模板管理
- [x] 3.1 创建提示词服务
  - 创建 `packages/services/extensions/src/ai/prompts/prompt.service.ts`
  - 实现 CRUD 操作 (create, findById, findByCategory, update, delete)
  - 实现模板渲染功能 (render)
  - _Requirements: 2.1, 2.2, 2.3, 2.5_

- [ ]* 3.2 编写属性测试 - 模板 CRUD 一致性
  - **Property 3: 模板 CRUD 一致性**
  - **Validates: Requirements 2.1**
  - 测试创建后能查询到,更新后内容改变,删除后查询不到

- [ ]* 3.3 编写属性测试 - 模板变量替换正确性
  - **Property 4: 模板变量替换正确性**
  - **Validates: Requirements 2.2**
  - 测试所有 `{{variable}}` 占位符被正确替换

- [ ]* 3.4 编写属性测试 - 模板分类查询正确性
  - **Property 5: 模板分类查询正确性**
  - **Validates: Requirements 2.3**
  - 测试按分类查询只返回该分类的模板

- [ ]* 3.5 编写属性测试 - 模板使用计数递增
  - **Property 6: 模板使用计数递增**
  - **Validates: Requirements 2.5**
  - 测试每次使用后 usageCount 增加 1

- [x] 4. 实现 RAG 服务
- [x] 4.1 创建 RAG 服务
  - 创建 `packages/services/extensions/src/ai/rag/rag.service.ts`
  - 集成 Qdrant 客户端
  - 实现文档嵌入 (embedDocument)
  - 实现语义搜索 (search)
  - 实现提示词增强 (enhancePrompt)
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ]* 4.2 编写属性测试 - 文档嵌入和检索一致性
  - **Property 7: 文档嵌入和检索一致性**
  - **Validates: Requirements 3.2, 3.3**
  - 测试嵌入后能通过语义搜索检索到

- [ ]* 4.3 编写属性测试 - RAG 提示词增强
  - **Property 8: RAG 提示词增强**
  - **Validates: Requirements 3.4**
  - 测试增强后的提示词包含检索到的文档

- [ ]* 4.4 编写属性测试 - 项目向量数据隔离
  - **Property 9: 项目向量数据隔离**
  - **Validates: Requirements 3.5**
  - 测试项目 A 的搜索不返回项目 B 的文档

- [x] 5. 实现对话历史管理
- [x] 5.1 创建对话服务
  - 创建 `packages/services/extensions/src/ai/conversations/conversation.service.ts`
  - 实现对话 CRUD 操作
  - 实现按项目筛选 (findByProject)
  - 实现搜索功能 (search)
  - 实现上下文管理 (保留最近 10 条消息)
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ]* 5.2 编写属性测试 - 对话持久化和查询
  - **Property 10: 对话持久化和查询**
  - **Validates: Requirements 4.1, 4.4**
  - 测试保存后能查询到,删除后查询不到

- [ ]* 5.3 编写属性测试 - 对话项目筛选正确性
  - **Property 11: 对话项目筛选正确性**
  - **Validates: Requirements 4.2**
  - 测试按项目筛选只返回该项目的对话

- [ ]* 5.4 编写属性测试 - 对话内容搜索正确性
  - **Property 12: 对话内容搜索正确性**
  - **Validates: Requirements 4.3**
  - 测试搜索结果包含关键词

- [ ]* 5.5 编写属性测试 - 对话上下文长度限制
  - **Property 13: 对话上下文长度限制**
  - **Validates: Requirements 4.5**
  - 测试超过 10 条消息时只保留最近 10 条

- [x] 6. 实现使用统计和成本追踪
- [x] 6.1 创建使用统计服务
  - 创建 `packages/services/extensions/src/ai/usage/usage-tracking.service.ts`
  - 实现使用记录 (record, recordCacheHit)
  - 实现成本计算 (calculateCost)
  - 实现统计聚合 (getStatistics)
  - 实现配额管理 (checkQuota)
  - 实现告警触发 (checkAndAlert)
  - 实现缓存命中率统计 (getCacheHitRate)
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ]* 6.2 编写属性测试 - AI 调用使用记录
  - **Property 14: AI 调用使用记录**
  - **Validates: Requirements 5.1, 5.2**
  - 测试调用后数据库有对应记录

- [ ]* 6.3 编写属性测试 - 使用统计聚合正确性
  - **Property 15: 使用统计聚合正确性**
  - **Validates: Requirements 5.3**
  - 测试统计数据等于所有记录的总和

- [ ]* 6.4 编写属性测试 - 配额告警触发
  - **Property 16: 配额告警触发**
  - **Validates: Requirements 5.5**
  - 测试使用量达到 90% 时触发告警

- [x] 7. 实现 AI 响应缓存
- [x] 7.1 创建缓存服务
  - 创建 `packages/services/extensions/src/ai/cache/ai-cache.service.ts`
  - 实现缓存键生成 (generateKey)
  - 实现缓存读写 (get, set)
  - 实现缓存清除 (clear, clearAll, clearByProvider)
  - 实现缓存命中率统计 (recordHit, recordMiss, getStats)
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

- [ ]* 7.2 编写属性测试 - 缓存键一致性
  - **Property 30: 缓存键一致性**
  - **Validates: Requirements 12.2**
  - 测试相同请求生成相同缓存键

- [ ]* 7.3 编写属性测试 - 缓存清除有效性
  - **Property 31: 缓存清除有效性**
  - **Validates: Requirements 12.4**
  - 测试清除后缓存不存在

- [ ]* 7.4 编写属性测试 - 缓存命中统计
  - **Property 32: 缓存命中统计**
  - **Validates: Requirements 12.5**
  - 测试缓存命中后统计数据更新

- [ ] 8. 实现安全和内容过滤
- [x] 8.1 创建内容过滤服务
  - 创建 `packages/services/extensions/src/ai/security/content-filter.service.ts`
  - 实现敏感信息检测 (detectSensitiveInfo)
  - 实现内容过滤 (filterMessages)
  - 实现过滤规则管理 (addRule, removeRule)
  - 实现审计日志记录 (logInteraction)
  - _Requirements: 13.1, 13.2, 13.4, 13.5_

- [ ]* 8.2 编写属性测试 - 敏感信息过滤
  - **Property 33: 敏感信息过滤**
  - **Validates: Requirements 13.1**
  - 测试包含敏感信息的输入被过滤或拒绝

- [ ]* 8.3 编写属性测试 - AI 交互审计日志
  - **Property 34: AI 交互审计日志**
  - **Validates: Requirements 13.2**
  - 测试每次交互后审计日志有记录

- [ ]* 8.4 编写属性测试 - 内容过滤规则生效
  - **Property 36: 内容过滤规则生效**
  - **Validates: Requirements 13.4**
  - 测试设置规则后匹配内容被过滤

- [ ]* 8.5 编写属性测试 - 敏感信息检测告警
  - **Property 37: 敏感信息检测告警**
  - **Validates: Requirements 13.5**
  - 测试检测到敏感信息时阻止并告警

- [ ] 9. 实现核心 AI 服务
- [x] 9.1 创建核心 AI 服务
  - 创建 `packages/services/extensions/src/ai/ai/ai.service.ts`
  - 整合所有子服务 (工厂、缓存、统计、过滤)
  - 实现 complete 方法
  - 实现 streamComplete 方法
  - 添加错误处理和重试逻辑
  - _Requirements: 1.1-1.9, 6.1-6.5, 12.1-12.5, 13.1-13.5_

- [ ]* 9.2 编写属性测试 - 流式响应数据块传输
  - **Property 17: 流式响应数据块传输**
  - **Validates: Requirements 6.1**
  - 测试流式调用返回多个数据块

- [ ] 10. 实现代码审查增强
- [x] 10.1 扩展代码审查服务
  - 更新 `apps/api-gateway/src/routers/ai-code-review.router.ts`
  - 实现全面审查模式
  - 实现严重级别分类
  - 实现修复建议生成
  - 实现批量审查
  - 实现审查摘要生成
  - _Requirements: 7.1-7.5_

- [ ]* 10.2 编写属性测试 - 审查结果包含严重级别
  - **Property 18: 审查结果包含严重级别**
  - **Validates: Requirements 7.2**
  - 测试每个问题包含严重级别

- [ ]* 10.3 编写属性测试 - 审查结果包含修复建议
  - **Property 19: 审查结果包含修复建议**
  - **Validates: Requirements 7.3**
  - 测试每个问题包含修复建议

- [ ]* 10.4 编写属性测试 - 批量审查文件数量一致性
  - **Property 20: 批量审查文件数量一致性**
  - **Validates: Requirements 7.4**
  - 测试 N 个文件返回 N 个结果

- [ ]* 10.5 编写属性测试 - 审查摘要包含统计信息
  - **Property 21: 审查摘要包含统计信息**
  - **Validates: Requirements 7.5**
  - 测试摘要包含总分、问题数、优点

- [x] 11. 实现配置生成增强
- [x] 11.1 创建配置生成服务
  - 创建 `packages/services/extensions/src/ai/config-gen/config-generator.service.ts`
  - 实现 Kubernetes Deployment 生成
  - 实现 Dockerfile 生成
  - 实现 GitHub Actions 生成
  - 实现 GitLab CI 生成
  - 实现配置优化建议
  - _Requirements: 8.1-8.5_

- [ ]* 11.2 编写属性测试 - 配置生成包含优化建议
  - **Property 22: 配置生成包含优化建议**
  - **Validates: Requirements 8.5**
  - 测试生成的配置包含优化建议

- [x] 12. 实现故障诊断增强
- [x] 12.1 创建故障诊断服务
  - 创建 `packages/services/extensions/src/ai/troubleshooting/troubleshooting.service.ts`
  - 实现日志分析
  - 实现 Kubernetes 事件分析
  - 实现根因分析
  - 实现修复指南生成
  - 实现修复时间估算
  - _Requirements: 9.1-9.5_

- [ ]* 12.2 编写属性测试 - 诊断结果包含根因分析
  - **Property 23: 诊断结果包含根因分析**
  - **Validates: Requirements 9.3**
  - 测试结果包含根因分析部分

- [ ]* 12.3 编写属性测试 - 修复指南是分步的
  - **Property 24: 修复指南是分步的**
  - **Validates: Requirements 9.4**
  - 测试修复指南包含多个有序步骤

- [ ]* 12.4 编写属性测试 - 诊断结果包含时间估算
  - **Property 25: 诊断结果包含时间估算**
  - **Validates: Requirements 9.5**
  - 测试结果包含修复时间估算

- [x] 13. 实现 Function Calling 支持
- [x] 13.1 创建 Function Calling 服务
  - 创建 `packages/services/extensions/src/ai/functions/function-calling.service.ts`
  - 实现函数注册 (registerFunction)
  - 实现函数查询 (getFunction)
  - 实现参数验证 (validateArguments)
  - 实现函数执行 (executeFunction)
  - _Requirements: 10.1, 10.4, 10.5_

- [ ]* 13.2 编写属性测试 - 函数注册和查询
  - **Property 26: 函数注册和查询**
  - **Validates: Requirements 10.1**
  - 测试注册后能通过名称查询到

- [ ]* 13.3 编写属性测试 - 函数参数验证
  - **Property 27: 函数参数验证**
  - **Validates: Requirements 10.4**
  - 测试无效参数被拒绝

- [ ]* 13.4 编写属性测试 - 函数执行结果返回
  - **Property 28: 函数执行结果返回**
  - **Validates: Requirements 10.5**
  - 测试函数被执行且结果返回

- [ ] 14. 实现多模态支持
- [ ] 14.1 创建多模态服务
  - 创建 `packages/services/extensions/src/ai/multimodal/multimodal.service.ts`
  - 实现图片上传处理
  - 实现图文混合输入处理
  - 集成多模态模型 (GLM-4V, QwenVL, GPT-4 Vision, Claude 3)
  - _Requirements: 11.1, 11.2, 11.4_

- [ ]* 14.2 编写属性测试 - 图文混合输入处理
  - **Property 29: 图文混合输入处理**
  - **Validates: Requirements 11.4**
  - 测试包含图片和文本的输入被正确处理

- [ ] 15. 实现智能代码补全
- [ ] 15.1 创建代码补全服务
  - 创建 `packages/services/extensions/src/ai/completion/code-completion.service.ts`
  - 实现基于上下文的补全
  - 实现多语言支持 (TypeScript, JavaScript, Python, Go)
  - 实现性能优化 (< 500ms)
  - 实现补全选项生成 (3-5 个)
  - 使用轻量级模型 (Qwen2.5-Coder, GLM-4-Flash, CodeLlama)
  - _Requirements: 14.1-14.5_

- [ ]* 15.2 编写属性测试 - 补全响应时间限制
  - **Property 38: 补全响应时间限制**
  - **Validates: Requirements 14.3**
  - 测试响应时间不超过 500ms

- [ ]* 15.3 编写属性测试 - 补全选项数量范围
  - **Property 39: 补全选项数量范围**
  - **Validates: Requirements 14.4**
  - 测试返回 3-5 个补全选项

- [ ] 16. 实现 Git 提交消息生成
- [ ] 16.1 创建提交消息生成服务
  - 创建 `packages/services/extensions/src/ai/git/commit-message.service.ts`
  - 实现 Git diff 分析
  - 实现 Conventional Commits 格式生成
  - 实现变更类型识别
  - 实现描述长度限制 (≤ 72 字符)
  - 实现详细正文生成
  - _Requirements: 15.1-15.5_

- [ ]* 16.2 编写属性测试 - 提交消息符合 Conventional Commits
  - **Property 40: 提交消息符合 Conventional Commits**
  - **Validates: Requirements 15.2**
  - 测试生成的消息符合规范格式

- [ ]* 16.3 编写属性测试 - 变更类型识别正确性
  - **Property 41: 变更类型识别正确性**
  - **Validates: Requirements 15.3**
  - 测试包含正确的变更类型

- [ ]* 16.4 编写属性测试 - 提交描述长度限制
  - **Property 42: 提交描述长度限制**
  - **Validates: Requirements 15.4**
  - 测试描述不超过 72 字符

- [ ]* 16.5 编写属性测试 - 提交正文包含详细信息
  - **Property 43: 提交正文包含详细信息**
  - **Validates: Requirements 15.5**
  - 测试正文包含变更详细信息

- [ ] 17. 创建 tRPC 路由
- [x] 17.1 创建 AI 路由
  - 更新 `apps/api-gateway/src/routers/ai.router.ts`
  - 添加 complete, streamComplete 端点
  - 添加提示词管理端点
  - 添加对话管理端点
  - 添加使用统计端点
  - _Requirements: 所有功能需求_

- [x] 17.2 在 `packages/types/src/schemas.ts` 中添加 Zod Schema
  - 添加 AI 相关的输入验证 schema
  - 导出类型定义

- [x] 18. 更新 AI Module
- [x] 18.1 更新 `packages/services/extensions/src/ai/ai/ai.module.ts`
  - 注册所有新服务
  - 配置依赖注入
  - 导出服务供其他模块使用

- [x] 19. 添加环境变量配置
- [x] 19.1 更新 `.env.example`
  - 添加所有 AI 提供商的 API 密钥
  - 添加 Qdrant 配置
  - 添加配额和缓存配置

- [ ] 20. 编写集成测试
- [ ]* 20.1 编写端到端 AI 调用测试
  - 测试从 API 路由到 AI 服务的完整流程
  - 测试缓存命中和未命中场景
  - 测试配额限制和告警

- [ ]* 20.2 编写 RAG 端到端测试
  - 测试文档嵌入到检索的完整流程
  - 测试提示词增强效果

- [ ] 21. 更新文档
- [ ] 21.1 更新 API 文档
  - 在 `docs/API_REFERENCE.md` 中添加 AI 相关 API

- [ ] 21.2 创建使用指南
  - 创建 `docs/guides/ai-module-usage.md`
  - 包含配置、使用示例、最佳实践

- [ ] 22. 最终检查点
- [ ] 22.1 确保所有测试通过
  - 运行所有单元测试
  - 运行所有属性测试
  - 运行所有集成测试
  - 确保类型检查通过
  - 确保 lint 检查通过

- [ ] 22.2 性能验证
  - 验证代码补全响应时间 < 500ms
  - 验证缓存命中率 > 50%
  - 验证并发处理能力

- [ ] 22.3 安全验证
  - 验证敏感信息过滤有效
  - 验证审计日志完整
  - 验证配额限制生效
