# 多模态服务 (Multimodal Service)

提供图片分析和图文混合输入处理能力。

## 功能

- ✅ 图片上传和处理
- ✅ 图文混合输入
- ✅ 多模态模型集成
- ✅ 架构图分析
- ✅ UI 设计分析
- ✅ 错误截图分析
- ✅ 从图片生成代码

## 支持的模型

### 🌟 推荐模型（2025年最新）

#### 最强能力
- **`claude-3-5-sonnet-20241022`** (Anthropic) - 最强多模态能力，图片理解最佳
  - 定价: $3/$15 per 1M tokens
  - 适用: 复杂图片分析、架构图理解、UI 设计分析

#### 性价比之王
- **`gpt-4o-mini`** (OpenAI) - 性价比最高，日常使用推荐
  - 定价: $0.15/$0.60 per 1M tokens
  - 适用: 日常图片分析、错误截图诊断
  
- **`claude-3-5-haiku-20241022`** (Anthropic) - 最快最便宜
  - 定价: $0.80/$4 per 1M tokens
  - 适用: 快速响应场景、批量处理

#### 免费选择
- **`gemini-2.0-flash-exp`** (Google) - 最新实验版本，免费使用
  - 定价: Free (实验版)
  - 适用: 开发测试、预算有限场景

#### 中文优化
- **`glm-4v-flash`** (智谱) - 中文图片理解优秀，性价比高
  - 定价: ¥0.01/千tokens
  - 适用: 中文内容、国内部署
  
- **`qwen2-vl-7b`** (阿里) - 中文图片理解优秀，适合大规模使用
  - 定价: ¥0.008/千tokens
  - 适用: 大规模批量处理

### 完整模型列表

#### Claude 3.5 系列 (Anthropic)
- `claude-3-5-sonnet-20241022` - 最强多模态能力 ⭐
- `claude-3-5-haiku-20241022` - 最快最便宜 ⭐

#### OpenAI GPT-4o 系列
- `gpt-4o` - 最新多模态，速度快 ⭐
- `gpt-4o-mini` - 性价比最高 ⭐

#### Google Gemini 系列
- `gemini-2.0-flash-exp` - 最新实验版本，免费 ⭐
- `gemini-1.5-pro` - 稳定版本，长上下文
- `gemini-1.5-flash` - 快速版本，性价比高 ⭐

#### 智谱 GLM-4V Plus
- `glm-4v-plus` - 最新版本，中文优化
- `glm-4v-flash` - 快速版本，性价比高 ⭐

#### 阿里 Qwen2-VL
- `qwen2-vl-72b` - 最强版本
- `qwen2-vl-7b` - 性价比版本 ⭐

## 使用示例

### 基础图片分析

```typescript
import { MultimodalService } from './multimodal.service'

// 分析图片（使用性价比最高的模型）
const result = await multimodalService.analyzeImage(
  {
    url: 'https://example.com/image.png',
    // 或使用 base64
    // base64: 'iVBORw0KGgoAAAANSUhEUgA...',
    // mimeType: 'image/png',
  },
  '请描述这张图片的内容',
  'gpt-4o-mini' // 推荐：性价比最高
)

console.log(result.content)
console.log(`使用 tokens: ${result.usage.totalTokens}`)
```

### 图文混合输入

```typescript
// 处理图文混合输入
const result = await multimodalService.processMultimodal(
  {
    text: '请分析这个架构图，并提供改进建议',
    images: [
      { url: 'https://example.com/architecture.png' },
      { url: 'https://example.com/diagram.png' },
    ],
    systemPrompt: '你是一个资深的系统架构师',
  },
  'claude-3-5-sonnet-20241022'
)
```

### 架构图分析

```typescript
// 分析架构图
const result = await multimodalService.analyzeArchitectureDiagram(
  { url: 'https://example.com/architecture.png' },
  'claude-3-5-sonnet-20241022'
)

// 结果包含:
// - 系统组件和服务
// - 组件之间的关系和数据流
// - 使用的技术栈
// - 潜在的架构问题或改进建议
// - 对应的代码或配置
```

### UI 设计分析

```typescript
// 分析 UI 设计
const result = await multimodalService.analyzeUIDesign(
  { url: 'https://example.com/ui-design.png' },
  'claude-3-5-sonnet-20241022'
)

// 结果包含:
// - UI 组件和布局结构
// - 颜色方案和设计风格
// - 交互元素和用户流程
// - 可访问性考虑
// - 对应的前端代码
```

### 错误截图分析

```typescript
// 分析错误截图
const result = await multimodalService.analyzeErrorScreenshot(
  { url: 'https://example.com/error.png' },
  '这是在部署到 Kubernetes 时出现的错误',
  'claude-3-5-sonnet-20241022'
)

// 结果包含:
// - 错误类型和严重程度
// - 可能的根本原因
// - 详细的修复步骤
// - 预防措施
// - 相关的代码示例或配置修改
```

### 从图片生成代码

```typescript
// 从 UI 设计生成组件代码
const result = await multimodalService.generateCodeFromImage(
  { url: 'https://example.com/button-design.png' },
  'component',
  'Vue 3 + TypeScript + Tailwind CSS',
  'claude-3-5-sonnet-20241022'
)

// 从架构图生成项目结构
const result = await multimodalService.generateCodeFromImage(
  { url: 'https://example.com/architecture.png' },
  'architecture',
  undefined,
  'claude-3-5-sonnet-20241022'
)

// 从配置图生成配置文件
const result = await multimodalService.generateCodeFromImage(
  { url: 'https://example.com/k8s-diagram.png' },
  'config',
  'Kubernetes',
  'claude-3-5-sonnet-20241022'
)
```

## 图片输入格式

### URL 方式

```typescript
const image: ImageInput = {
  url: 'https://example.com/image.png',
  description: '可选的图片描述',
}
```

### Base64 方式

```typescript
const image: ImageInput = {
  base64: 'iVBORw0KGgoAAAANSUhEUgA...',
  mimeType: 'image/png', // 可选，默认 image/png
  description: '可选的图片描述',
}
```

## 图片验证

```typescript
// 验证图片格式
const isValid = multimodalService.validateImage(image)

if (!isValid) {
  throw new Error('Invalid image format')
}
```

## 获取支持的模型

```typescript
// 获取所有支持的多模态模型
const models = multimodalService.getSupportedModels()

models.forEach(({ model, provider, description }) => {
  console.log(`${model} (${provider}): ${description}`)
})
```

## 使用场景

### 1. 架构设计审查

上传架构图，AI 分析系统设计，提供改进建议和潜在问题。

### 2. UI 实现

上传 UI 设计稿，AI 生成对应的前端代码（HTML/CSS/Vue/React）。

### 3. 错误诊断

上传错误截图，AI 分析错误原因并提供修复方案。

### 4. 文档理解

上传技术文档截图，AI 提取关键信息并生成代码。

### 5. 代码生成

上传流程图或状态图，AI 生成对应的代码实现。

## 最佳实践

### 1. 选择合适的模型

**按场景选择**:

- **复杂分析** → `claude-3-5-sonnet-20241022` (最强能力)
- **日常使用** → `gpt-4o-mini` (性价比最高)
- **快速响应** → `claude-3-5-haiku-20241022` (最快最便宜)
- **免费测试** → `gemini-2.0-flash-exp` (免费)
- **中文内容** → `glm-4v-flash` 或 `qwen2-vl-7b` (中文优化)
- **批量处理** → `qwen2-vl-7b` (最便宜)

**按预算选择**:

- **高预算** ($3-15/1M tokens): `claude-3-5-sonnet-20241022`, `gpt-4o`
- **中预算** ($0.8-4/1M tokens): `claude-3-5-haiku-20241022`, `gemini-1.5-pro`
- **低预算** ($0.15-0.6/1M tokens): `gpt-4o-mini`, `gemini-1.5-flash`
- **极低预算** (¥0.008-0.01/千tokens): `qwen2-vl-7b`, `glm-4v-flash`
- **免费**: `gemini-2.0-flash-exp`

### 2. 优化提示词

提供清晰的指令和上下文，帮助 AI 更好地理解图片内容。

```typescript
const result = await multimodalService.processMultimodal({
  text: `请分析这个架构图，重点关注：
1. 微服务之间的通信方式
2. 数据流向和存储方案
3. 可扩展性和高可用性设计
4. 安全性考虑`,
  images: [{ url: 'architecture.png' }],
  systemPrompt: '你是一个有 10 年经验的系统架构师，擅长微服务架构设计',
})
```

### 3. 处理大图片

对于大图片，建议：
- 压缩图片大小（< 5MB）
- 使用适当的分辨率（1920x1080 通常足够）
- 考虑裁剪关键区域

### 4. 批量处理

对于多张图片，可以分批处理以控制成本：

```typescript
const images = [/* 多张图片 */]
const batchSize = 3

for (let i = 0; i < images.length; i += batchSize) {
  const batch = images.slice(i, i + batchSize)
  const result = await multimodalService.processMultimodal({
    text: '请分析这些图片',
    images: batch,
  })
  // 处理结果
}
```

## 错误处理

```typescript
try {
  const result = await multimodalService.analyzeImage(image, prompt)
} catch (error) {
  if (error.code === 'AI_INFERENCE_FAILED') {
    // 处理 AI 推理失败
    console.error('AI 推理失败:', error.message)
  } else if (error.code === 'AI_PROVIDER_ERROR') {
    // 处理提供商错误
    console.error('提供商错误:', error.message)
  } else {
    // 其他错误
    console.error('未知错误:', error)
  }
}
```

## 成本优化

1. **使用缓存**: 相同的图片和提示词会被缓存
2. **选择合适的模型**: Haiku 比 Opus 便宜 10 倍
3. **优化图片大小**: 减少不必要的分辨率
4. **批量处理**: 减少 API 调用次数

## 限制

1. **图片大小**: 建议 < 5MB
2. **图片格式**: 支持 PNG, JPEG, WebP, GIF
3. **图片数量**: 单次请求建议 < 5 张
4. **分辨率**: 建议 < 4K

## 相关文档

- [AI 模块使用指南](../../../../../docs/guides/ai-module-usage.md)
- [AI 服务 README](../ai/README.md)
- [需求文档](../../../../../.kiro/specs/ai-module-enhancement/requirements.md)
- [设计文档](../../../../../.kiro/specs/ai-module-enhancement/design.md)
