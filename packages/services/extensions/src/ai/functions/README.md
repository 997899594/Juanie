# Function Calling Service

AI Function Calling 功能实现，允许 AI 模型调用预定义的系统函数。

## 功能特性

- ✅ 函数注册和管理
- ✅ 参数验证（支持 Zod Schema 和 JSON Schema）
- ✅ 函数执行和错误处理
- ✅ 批量函数执行
- ✅ 执行时间追踪

## 使用示例

### 1. 注册函数

```typescript
import { FunctionCallingService } from './function-calling.service'
import { z } from 'zod'

const functionService = new FunctionCallingService()

// 注册一个简单函数
functionService.registerFunction({
  name: 'getCurrentWeather',
  description: '获取指定城市的当前天气',
  parameters: {
    type: 'object',
    properties: {
      city: {
        type: 'string',
        description: '城市名称',
      },
      unit: {
        type: 'string',
        enum: ['celsius', 'fahrenheit'],
        description: '温度单位',
      },
    },
    required: ['city'],
  },
  handler: async (args) => {
    const { city, unit = 'celsius' } = args
    // 实际实现中应该调用天气 API
    return {
      city,
      temperature: 22,
      unit,
      condition: 'sunny',
    }
  },
})

// 使用 Zod Schema 进行更严格的验证
const weatherSchema = z.object({
  city: z.string().min(1),
  unit: z.enum(['celsius', 'fahrenheit']).optional(),
})

functionService.registerFunction({
  name: 'getCurrentWeather',
  description: '获取指定城市的当前天气',
  parameters: {
    type: 'object',
    properties: {
      city: { type: 'string' },
      unit: { type: 'string', enum: ['celsius', 'fahrenheit'] },
    },
    required: ['city'],
  },
  schema: weatherSchema,
  handler: async (args) => {
    const { city, unit = 'celsius' } = args
    return { city, temperature: 22, unit, condition: 'sunny' }
  },
})
```

### 2. 批量注册函数

```typescript
const functions = [
  {
    name: 'searchDocuments',
    description: '搜索项目文档',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        projectId: { type: 'string' },
      },
      required: ['query', 'projectId'],
    },
    handler: async (args) => {
      // 实现文档搜索
      return []
    },
  },
  {
    name: 'createDeployment',
    description: '创建新的部署',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        environment: { type: 'string' },
      },
      required: ['projectId', 'environment'],
    },
    handler: async (args) => {
      // 实现部署创建
      return { deploymentId: 'xxx' }
    },
  },
]

functionService.registerFunctions(functions)
```

### 3. 获取函数定义（用于 AI）

```typescript
// 获取所有函数的 AI 定义
const aiFunctions = functionService.getAIFunctionDefinitions()

// 传递给 AI 模型
const result = await aiService.complete({
  provider: 'openai',
  model: 'gpt-4',
}, {
  messages: [
    { role: 'user', content: '北京现在天气怎么样？' }
  ],
  functions: aiFunctions,
})

// 如果 AI 返回了函数调用
if (result.functionCall) {
  const executionResult = await functionService.executeFunction(
    result.functionCall.name,
    result.functionCall.arguments
  )
  
  console.log(executionResult)
  // {
  //   functionName: 'getCurrentWeather',
  //   success: true,
  //   result: { city: '北京', temperature: 22, unit: 'celsius', condition: 'sunny' },
  //   duration: 45
  // }
}
```

### 4. 验证参数

```typescript
// 验证函数参数
const validation = functionService.validateArguments('getCurrentWeather', {
  city: '北京',
  unit: 'celsius',
})

if (!validation.valid) {
  console.error('参数验证失败:', validation.error)
}
```

### 5. 执行函数

```typescript
// 执行单个函数
const result = await functionService.executeFunction('getCurrentWeather', {
  city: '北京',
  unit: 'celsius',
})

if (result.success) {
  console.log('执行成功:', result.result)
} else {
  console.error('执行失败:', result.error)
}

// 批量执行函数
const results = await functionService.executeFunctions([
  { name: 'getCurrentWeather', arguments: { city: '北京' } },
  { name: 'getCurrentWeather', arguments: { city: '上海' } },
])
```

### 6. 查询和管理函数

```typescript
// 获取函数定义
const func = functionService.getFunction('getCurrentWeather')

// 检查函数是否存在
if (functionService.hasFunction('getCurrentWeather')) {
  console.log('函数已注册')
}

// 获取所有函数
const allFunctions = functionService.getAllFunctions()

// 获取函数数量
const count = functionService.getFunctionCount()

// 注销函数
functionService.unregisterFunction('getCurrentWeather')

// 清空所有函数
functionService.clearFunctions()
```

## 与 AI 服务集成

```typescript
import { AIService } from '../ai/ai.service'
import { FunctionCallingService } from './function-calling.service'

@Injectable()
export class AIFunctionService {
  constructor(
    private aiService: AIService,
    private functionService: FunctionCallingService
  ) {
    // 注册系统函数
    this.registerSystemFunctions()
  }

  private registerSystemFunctions() {
    // 注册项目相关函数
    this.functionService.registerFunction({
      name: 'listProjects',
      description: '列出用户的所有项目',
      parameters: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
        },
        required: ['userId'],
      },
      handler: async (args) => {
        // 调用 ProjectsService
        return []
      },
    })

    // 注册部署相关函数
    this.functionService.registerFunction({
      name: 'getDeploymentStatus',
      description: '获取部署状态',
      parameters: {
        type: 'object',
        properties: {
          deploymentId: { type: 'string' },
        },
        required: ['deploymentId'],
      },
      handler: async (args) => {
        // 调用 DeploymentsService
        return { status: 'running' }
      },
    })
  }

  async chat(message: string, userId: string) {
    // 获取所有可用函数
    const functions = this.functionService.getAIFunctionDefinitions()

    // 调用 AI
    let result = await this.aiService.complete(
      { provider: 'openai', model: 'gpt-4' },
      {
        messages: [{ role: 'user', content: message }],
        functions,
      },
      { userId }
    )

    // 如果 AI 返回了函数调用，执行它
    while (result.functionCall) {
      const executionResult = await this.functionService.executeFunction(
        result.functionCall.name,
        result.functionCall.arguments
      )

      // 将函数执行结果返回给 AI
      result = await this.aiService.complete(
        { provider: 'openai', model: 'gpt-4' },
        {
          messages: [
            { role: 'user', content: message },
            {
              role: 'function',
              name: result.functionCall.name,
              content: JSON.stringify(executionResult.result),
            },
          ],
          functions,
        },
        { userId }
      )
    }

    return result.content
  }
}
```

## 常见函数示例

### 项目管理函数

```typescript
functionService.registerFunctions([
  {
    name: 'createProject',
    description: '创建新项目',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        template: { type: 'string' },
        organizationId: { type: 'string' },
      },
      required: ['name', 'organizationId'],
    },
    handler: async (args) => {
      // 调用 ProjectsService.create()
      return { projectId: 'xxx' }
    },
  },
  {
    name: 'deleteProject',
    description: '删除项目',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
      },
      required: ['projectId'],
    },
    handler: async (args) => {
      // 调用 ProjectsService.delete()
      return { success: true }
    },
  },
])
```

### 部署管理函数

```typescript
functionService.registerFunctions([
  {
    name: 'triggerDeployment',
    description: '触发部署',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        environment: { type: 'string', enum: ['development', 'staging', 'production'] },
      },
      required: ['projectId', 'environment'],
    },
    handler: async (args) => {
      // 调用 DeploymentsService.trigger()
      return { deploymentId: 'xxx' }
    },
  },
  {
    name: 'rollbackDeployment',
    description: '回滚部署',
    parameters: {
      type: 'object',
      properties: {
        deploymentId: { type: 'string' },
      },
      required: ['deploymentId'],
    },
    handler: async (args) => {
      // 调用 DeploymentsService.rollback()
      return { success: true }
    },
  },
])
```

### 监控和日志函数

```typescript
functionService.registerFunctions([
  {
    name: 'getApplicationLogs',
    description: '获取应用日志',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        environment: { type: 'string' },
        lines: { type: 'number', default: 100 },
      },
      required: ['projectId', 'environment'],
    },
    handler: async (args) => {
      // 调用 K8s API 获取日志
      return { logs: [] }
    },
  },
  {
    name: 'getMetrics',
    description: '获取应用指标',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        metric: { type: 'string', enum: ['cpu', 'memory', 'requests'] },
        timeRange: { type: 'string', default: '1h' },
      },
      required: ['projectId', 'metric'],
    },
    handler: async (args) => {
      // 调用 Prometheus API
      return { data: [] }
    },
  },
])
```

## 错误处理

函数执行失败时，会返回包含错误信息的结果：

```typescript
const result = await functionService.executeFunction('invalidFunction', {})

if (!result.success) {
  console.error('执行失败:', result.error)
  // 输出: "Function invalidFunction not found"
}
```

参数验证失败：

```typescript
const result = await functionService.executeFunction('getCurrentWeather', {
  // 缺少必需参数 city
  unit: 'celsius',
})

if (!result.success) {
  console.error('参数验证失败:', result.error)
  // 输出: "Missing required parameter: city"
}
```

## 性能考虑

- 函数注册是同步操作，开销很小
- 函数执行是异步的，支持长时间运行的操作
- 参数验证使用 Zod，性能优秀
- 执行时间会被自动追踪

## 安全考虑

1. **参数验证**: 始终验证函数参数，防止注入攻击
2. **权限检查**: 在函数 handler 中检查用户权限
3. **错误处理**: 不要在错误消息中泄露敏感信息
4. **审计日志**: 记录所有函数调用，包括参数和结果

## 相关文档

- [AI Service](../ai/README.md)
- [Requirements 10: Function Calling](../../../.kiro/specs/ai-module-enhancement/requirements.md#需求-10-function-calling-支持)
- [Design: Function Calling](../../../.kiro/specs/ai-module-enhancement/design.md)
