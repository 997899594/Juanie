# AI 提供商测试总结

## 测试日期
2025-12-10

## 测试结果

### Ollama 本地模型

**状态**: ❌ 内存不足

**问题**:
- Docker 内存: 7.7 GiB
- 模型大小: qwen2.5-coder:7b (4.36 GB)
- 错误: "model is too large for system memory"

**解决方案**:

1. **增加 Docker 内存** (推荐)
   ```bash
   # Docker Desktop -> Settings -> Resources -> Memory
   # 建议设置为 12 GB 或更高
   ```

2. **使用更小的模型**
   ```bash
   # 拉取更小的模型
   docker exec -it juanie-ollama-dev ollama pull qwen2.5-coder:3b
   # 或
   docker exec -it juanie-ollama-dev ollama pull qwen2.5-coder:1.5b
   ```

3. **更新环境变量**
   ```env
   OLLAMA_DEFAULT_MODEL=qwen2.5-coder:3b
   ```

### 智谱 GLM

**状态**: ✅ GLM-4.6 完全可用

**最新测试结果** (2025-12-10 - 直接 API 测试):
- ✅ 基本对话: 通过 (12 prompt + 1519 completion tokens)
  - 响应质量: 优秀,提供了详细的推理过程
  - reasoning_content: 1519 tokens (详细的思考过程)
  - content: 简洁的最终答案
- ✅ 代码生成: 通过 (44 prompt + 204 completion tokens)
  - 生成了正确的 TypeScript 递归斐波那契函数
  - reasoning_content 显示了完整的思考过程
- ✅ 简单问答: 通过 (10 prompt + 1384 completion tokens)
  - 提供了多个角度的解释和比喻
  - reasoning_content 展示了深度思考

**GLM-4.6 特点**:
- 🧠 **推理模型**: 会在 `reasoning_content` 字段中显示详细的思考过程
- 📊 **Token 消耗**: 推理过程会消耗大量 tokens (1000-1500 tokens)
- ⚡ **响应速度**: 正常,无明显延迟
- 🎯 **适用场景**: 
  - 需要深度思考的复杂问题
  - 代码生成和审查
  - 需要多角度分析的任务
  - 教学和解释性内容

**可用模型**: `glm-4.6`
- API Key 专用于 GLM-4.6 模型
- 支持推理能力,会显示思考过程
- 适合需要高质量输出的场景

**建议配置**:
```typescript
// 使用 glm-4.6 作为默认模型
const zhipu = createOpenAI({
  apiKey: ZHIPU_API_KEY,
  baseURL: 'https://open.bigmodel.cn/api/paas/v4',
})

// 调用时指定 glm-4.6,并设置足够的 maxTokens
const result = await generateText({
  model: zhipu('glm-4.6'),
  messages: [...],
  temperature: 0.7,
  maxTokens: 2000, // GLM-4.6 需要更多 tokens 用于推理
})

// 响应结构
// result.choices[0].message.content - 最终答案
// result.choices[0].message.reasoning_content - 推理过程
```

**注意事项**:
- ⚠️ **Token 消耗**: 推理过程会消耗大量 tokens,建议设置 maxTokens >= 2000
- 💰 **成本考虑**: 由于 reasoning_content 的存在,每次调用的 token 消耗较高
- 🎯 **使用建议**: 
  - 对于简单任务,考虑使用 glm-4-flash
  - 对于需要深度思考的任务,使用 glm-4.6
  - 可以选择性地记录或忽略 reasoning_content

### GLM-4-Flash vs GLM-4.6 对比

| 特性 | GLM-4-Flash | GLM-4.6 |
|------|-------------|---------|
| **响应速度** | ⚡ 快 (1.7-2.5s) | 🐢 慢 (需要推理时间) |
| **Token 消耗** | 💰 低 (40-400 tokens) | 💸 高 (200-1500 tokens) |
| **推理过程** | ❌ 无 | ✅ 有 (reasoning_content) |
| **适用场景** | 实时交互、快速响应 | 复杂推理、深度分析 |
| **成本** | 💚 低 | 💛 中等 |
| **代码生成** | ✅ 优秀 | ✅ 优秀 |
| **代码审查** | ✅ 详细 (356 tokens) | ✅ 非常详细 (500+ tokens) |
| **多轮对话** | ✅ 支持 | ✅ 支持 |
| **流式响应** | ✅ 快速 (首块 330ms) | ✅ 支持 |

**测试结果对比** (2025-12-10):

**GLM-4-Flash**:
- ✅ 基本对话: 1740ms, 52 tokens
- ✅ 代码生成: 1745ms, 89 tokens
- ✅ 流式响应: 2553ms (首块 330ms)
- ✅ 代码审查: 13973ms, 421 tokens
- ✅ 多轮对话: 17893ms, 626 tokens

**GLM-4.6**:
- ✅ 基本对话: ~3000ms, 1531 tokens (含推理)
- ✅ 代码生成: ~2000ms, 248 tokens (含推理)
- ✅ 简单问答: ~3000ms, 1394 tokens (含推理)

**选择建议**:
- 🎯 **实时场景**: 使用 GLM-4-Flash (聊天、代码补全、快速问答)
- 🧠 **复杂任务**: 使用 GLM-4.6 (深度分析、教学、需要看到思考过程)
- 💰 **成本优先**: 使用 GLM-4-Flash
- 📚 **学习研究**: 使用 GLM-4.6 (可以看到 AI 的思考过程)

## 推荐方案

### 方案 1: 使用智谱 GLM-4-Flash (强烈推荐)

**优点**:
- ✅ 有额度可用
- ✅ 响应速度快
- ✅ 成本低
- ✅ 无需本地资源

**配置**:
```env
ZHIPU_API_KEY=735ba3a60c984a82ac5e4ae790f14a19.kYrZdbmAHdZ6e3S7
AI_DEFAULT_PROVIDER=zhipu
AI_DEFAULT_MODEL=glm-4-flash
```

### 方案 2: 修复 Ollama + 使用更小模型

**优点**:
- ✅ 完全免费
- ✅ 本地运行，隐私保护
- ✅ 无网络依赖

**步骤**:
1. 增加 Docker 内存到 12 GB
2. 使用 qwen2.5-coder:3b 模型
3. 重启 Ollama 容器

**配置**:
```env
OLLAMA_HOST=http://localhost:11434
OLLAMA_DEFAULT_MODEL=qwen2.5-coder:3b
AI_DEFAULT_PROVIDER=ollama
```

### 方案 3: 混合使用

**策略**:
- 开发环境: 使用 Ollama (免费)
- 生产环境: 使用智谱 GLM-4-Flash (稳定)

**配置**:
```typescript
// 根据环境选择提供商
const provider = process.env.NODE_ENV === 'production' 
  ? 'zhipu' 
  : 'ollama'
```

## 下一步行动

1. **立即可用**: 修改代码使用 `glm-4-flash`
2. **长期方案**: 增加 Docker 内存，使用 Ollama 本地模型
3. **测试验证**: 运行更新后的测试脚本

## 相关文件

- 测试脚本: `scripts/test-ai-ollama.ts`, `scripts/test-ai-glm.ts`
- 环境配置: `.env`
- AI 适配器: `packages/services/extensions/src/ai/ai/adapters/`
