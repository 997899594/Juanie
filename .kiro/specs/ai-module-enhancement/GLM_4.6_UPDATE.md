# GLM-4.6 多模态模型更新

## 更新时间
2025-12-11

## 更新背景

根据智谱AI官方文档（https://docs.bigmodel.cn/cn/guide/start/migrate-to-glm-4.6），智谱发布了最新的 **GLM-4.6** 模型，这是他们的最新旗舰多模态模型。

## 关键发现

**重要澄清**：
- ❌ **GLM-6 不存在** - 这是误解
- ✅ **GLM-4.6 才是最新版本** - 智谱官方2025年最新发布

## 更新内容

### 1. 添加 GLM-4.6 模型支持

**模型名称**: `glm-4.6`

**核心特性**:
- 最新旗舰多模态模型
- 支持深度思考（reasoning）
- 中文优化
- 支持流式工具调用
- 支持图文混合输入

**定价**: ¥0.05/千tokens

### 2. 更新的文件

#### `packages/services/extensions/src/ai/multimodal/multimodal.service.ts`
- 添加 `glm-4.6` 到 `MULTIMODAL_MODELS` 常量
- 将默认模型从 `claude-3-5-sonnet-20241022` 更改为 `glm-4.6`
- 更新所有方法的默认参数
- 在 `getSupportedModels()` 中将 GLM-4.6 标记为强烈推荐

#### `packages/types/src/ai.types.ts`
- 添加 `glm-4.6` 到 `AIModel` 类型
- 移除不存在的 `glm-6`
- 更新注释说明最新版本

### 3. 支持的多模态模型列表（更新后）

**智谱 GLM 系列**（2025年最新）:
- ✅ `glm-4.6` - 最新旗舰，支持深度思考，**强烈推荐**
- ✅ `glm-4v-plus` - 增强版本，中文优化
- ✅ `glm-4v-flash` - 快速版本，性价比高

**OpenAI GPT 系列**:
- ✅ `gpt-4o` - 最新多模态
- ✅ `gpt-4o-mini` - 性价比最高

**Anthropic Claude 系列**:
- ✅ `claude-3-5-sonnet-20241022` - 最强多模态
- ✅ `claude-3-5-haiku-20241022` - 最快最便宜

**Google Gemini 系列**:
- ✅ `gemini-2.0-flash-exp` - 免费实验版
- ✅ `gemini-1.5-pro` - 稳定版本
- ✅ `gemini-1.5-flash` - 快速版本

**阿里 Qwen 系列**:
- ✅ `qwen2-vl-72b` - 最强版本
- ✅ `qwen2-vl-7b` - 性价比版本

## GLM-4.6 新特性

### 1. 深度思考（Reasoning）

GLM-4.6 支持深度思考模式，可以在生成回答前进行推理：

```python
response = client.chat.completions.create(
    model="glm-4.6",
    messages=[{"role": "user", "content": "北京天气怎么样"}],
    stream=True,
)

# 流式输出包含推理过程
for chunk in response:
    if hasattr(delta, 'reasoning_content'):
        print("🧠 思考过程：", delta.reasoning_content)
    if hasattr(delta, 'content'):
        print("💬 回答内容：", delta.content)
```

### 2. 流式工具调用

支持流式输出时的工具调用，参数会逐步拼接：

```python
response = client.chat.completions.create(
    model="glm-4.6",
    tools=[...],
    stream=True,
    tool_stream=True,  # 启用工具流式输出
)
```

### 3. 多模态能力

支持图文混合输入，可以分析图片并生成回答。

## 使用示例

### TypeScript 使用

```typescript
import { MultimodalService } from '@juanie/service-extensions'

// 使用 GLM-4.6 分析图片
const result = await multimodalService.analyzeImage(
  { url: 'https://example.com/image.jpg' },
  '请分析这张图片',
  'glm-4.6' // 使用最新的 GLM-4.6
)

// 或者使用默认模型（已经是 GLM-4.6）
const result = await multimodalService.analyzeImage(
  { url: 'https://example.com/image.jpg' },
  '请分析这张图片'
)
```

## 推荐使用场景

### GLM-4.6 最适合：
- ✅ 中文内容处理
- ✅ 需要深度思考的复杂任务
- ✅ 图文混合分析
- ✅ 架构图理解
- ✅ UI 设计分析
- ✅ 代码生成

### 其他模型推荐：
- **GPT-4o**: 英文内容，通用任务
- **Claude 3.5 Sonnet**: 复杂推理，长文本
- **Gemini 2.0 Flash**: 开发测试（免费）
- **Qwen2-VL 7B**: 大规模批量处理（成本最低）

## 迁移指南

### 从旧模型迁移到 GLM-4.6

```typescript
// 旧代码
const result = await multimodalService.analyzeImage(
  image,
  prompt,
  'glm-4v-plus' // 旧模型
)

// 新代码（推荐）
const result = await multimodalService.analyzeImage(
  image,
  prompt,
  'glm-4.6' // 最新模型，支持深度思考
)

// 或者直接使用默认值
const result = await multimodalService.analyzeImage(image, prompt)
```

## 性能对比

| 模型 | 中文能力 | 多模态 | 深度思考 | 定价 | 推荐度 |
|------|---------|--------|---------|------|--------|
| GLM-4.6 | ⭐⭐⭐⭐⭐ | ✅ | ✅ | ¥0.05/千tokens | ⭐⭐⭐⭐⭐ |
| GLM-4V Plus | ⭐⭐⭐⭐⭐ | ✅ | ❌ | ¥0.05/千tokens | ⭐⭐⭐⭐ |
| GPT-4o | ⭐⭐⭐⭐ | ✅ | ❌ | $2.50/$10 per 1M | ⭐⭐⭐⭐ |
| Claude 3.5 | ⭐⭐⭐ | ✅ | ❌ | $3/$15 per 1M | ⭐⭐⭐⭐ |
| Gemini 2.0 | ⭐⭐⭐ | ✅ | ❌ | Free | ⭐⭐⭐ |

## 验证步骤

### 1. 类型检查
```bash
bun run type-check --filter='@juanie/service-extensions'
```

### 2. 测试多模态服务
```bash
bun run scripts/test-ai-multimodal.ts
```

### 3. 验证模型列表
```typescript
const models = multimodalService.getSupportedModels()
console.log(models.filter(m => m.model.startsWith('glm')))
```

## 注意事项

1. **GLM-6 不存在**: 如果之前有提到 GLM-6，那是误解，正确的是 GLM-4.6
2. **API 兼容性**: GLM-4.6 使用与 GLM-4 相同的 API 端点
3. **深度思考**: 需要在流式模式下才能看到推理过程
4. **工具调用**: 支持流式工具调用，需要设置 `tool_stream=True`

## 官方文档

- 迁移指南: https://docs.bigmodel.cn/cn/guide/start/migrate-to-glm-4.6
- API 文档: https://docs.bigmodel.cn/
- 定价信息: https://open.bigmodel.cn/pricing

## 总结

✅ **更新完成**: 成功添加智谱最新的 GLM-4.6 多模态模型支持

**核心价值**:
1. **最新模型** - GLM-4.6 是智谱2025年最新发布
2. **深度思考** - 支持推理过程可视化
3. **中文优化** - 中文理解和生成能力最强
4. **性价比高** - ¥0.05/千tokens，比国际模型便宜10倍
5. **默认推荐** - 已设置为多模态服务的默认模型

**推荐配置**:
- 中文内容: `glm-4.6` ⭐⭐⭐⭐⭐
- 英文内容: `gpt-4o`
- 复杂推理: `claude-3-5-sonnet-20241022`
- 开发测试: `gemini-2.0-flash-exp` (免费)
- 批量处理: `qwen2-vl-7b` (最便宜)

这次更新基于智谱官方文档，使用真实可用的最新模型！🎉
