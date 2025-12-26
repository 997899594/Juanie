# Core 包重构 - 需要决策的方案

> 生成时间: 2024-12-24  
> 状态: 等待决策

## 决策 1: Logger 服务处理方式 🔴 高优先级

**当前问题**: `packages/core/src/logger/logger.service.ts` 只是简单的 re-export，没有提供任何价值

```typescript
// 当前代码
export { PinoLogger, PinoLogger as Logger, PinoLogger as LoggerService } from 'nestjs-pino'
```

### 方案 A: 直接删除，使用 nestjs-pino ✅ 推荐

**优点**:
- 减少不必要的抽象层
- 代码更清晰直接
- 减少维护成本

**缺点**:
- 需要更新约 100+ 处导入路径
- 失去统一的 Logger 接口（但 nestjs-pino 已经很统一）

**工作量**: 2-3 小时

**示例**:
```typescript
// 修改前
import { Logger } from '@juanie/core/logger'

// 修改后
import { PinoLogger } from 'nestjs-pino'

constructor(private readonly logger: PinoLogger) {
  this.logger.setContext(MyService.name)
}
```

### 方案 B: 提供真正的封装

**优点**:
- 统一的日志接口
- 可以添加增强功能（自动添加 context、格式化错误等）
- 不需要修改现有代码

**缺点**:
- 增加维护成本
- 可能过度设计

**工作量**: 4-5 小时

**示例**:
```typescript
@Injectable()
export class Logger {
  constructor(private readonly pino: PinoLogger) {}

  // 自动添加 context 和 timestamp
  info(message: string, context?: Record<string, any>) {
    this.pino.info({ ...context, timestamp: Date.now() }, message)
  }

  // 自动格式化错误
  error(message: string, error?: Error, context?: Record<string, any>) {
    this.pino.error({
      ...context,
      error: {
        message: error?.message,
        stack: error?.stack,
        name: error?.name,
      },
    }, message)
  }
}
```

---

**👉 你的决策**: [ ] 方案 A（直接删除） [ ] 方案 B（提供封装）


## 决策 2: Events 模块处理方式 🟡 中优先级

**当前问题**: 对 EventEmitter2 的过度封装，包含 `EventPublisher` 和 `EventReplayService`

```typescript
@Global()
@Module({
  imports: [EventEmitterModule.forRoot({ ... })],
  providers: [EventPublisher, EventReplayService],
  exports: [EventEmitterModule, EventPublisher, EventReplayService],
})
export class CoreEventsModule {}
```

### 方案 A: 直接使用 EventEmitterModule ✅ 推荐

**优点**:
- EventEmitter2 已经很好用，不需要额外封装
- 减少抽象层
- 代码更清晰

**缺点**:
- 需要更新约 30+ 处导入路径
- 失去 EventPublisher 和 EventReplayService（如果有业务逻辑，需要移到 Business 层）

**工作量**: 2-3 小时

**示例**:
```typescript
// 修改前
import { EventPublisher } from '@juanie/core/events'

// 修改后
import { EventEmitter2 } from '@nestjs/event-emitter'

constructor(private readonly eventEmitter: EventEmitter2) {}

async doSomething() {
  this.eventEmitter.emit('user.created', { userId: '123' })
}
```

### 方案 B: 保留极简封装

**优点**:
- 统一的配置
- 不需要修改现有代码

**缺点**:
- 仍然有一层抽象
- EventPublisher 和 EventReplayService 需要处理

**工作量**: 1-2 小时

**示例**:
```typescript
@Global()
@Module({
  imports: [EventEmitterModule.forRoot({ ... })],
  exports: [EventEmitterModule],
})
export class CoreEventsModule {}
```

---

**👉 你的决策**: [ ] 方案 A（直接使用 EventEmitterModule） [ ] 方案 B（保留极简封装）

**额外问题**: EventPublisher 和 EventReplayService 是否包含业务逻辑？
- [ ] 是，需要移到 Business 层
- [ ] 否，可以删除
- [ ] 不确定，需要检查代码


## 决策 3: Utils 目录处理方式 🟡 中优先级

**当前问题**: Utils 目录杂乱无章，包含多个工具文件

```
utils/
├── date.ts          # 日期工具
├── id.ts            # ID 生成
├── string.ts        # 字符串工具
├── validation.ts    # 验证工具
├── logger.ts        # 又一个 logger（与 logger/ 重复）
└── disposable.ts    # 资源管理
```

### 方案 A: 使用成熟库替代 ✅ 推荐

**优点**:
- 不重复造轮子
- 成熟库更可靠、功能更强大
- 减少维护成本

**缺点**:
- 需要更新约 50+ 处导入路径
- 需要安装新的依赖（但都是常用库）

**工作量**: 3-4 小时

**替代方案**:
```typescript
// date.ts → date-fns
import { format, parseISO, addDays } from 'date-fns'

// string.ts → lodash
import { camelCase, kebabCase, snakeCase } from 'lodash'

// validation.ts → zod
import { z } from 'zod'

// id.ts → nanoid（如果没有特殊需求）
import { nanoid } from 'nanoid'

// logger.ts → 删除（与 logger/ 重复）

// disposable.ts → 保留（资源管理是基础设施）
```

### 方案 B: 按功能域重新组织

**优点**:
- 保留自定义工具
- 不需要引入新依赖

**缺点**:
- 继续维护自定义工具
- 功能可能不如成熟库

**工作量**: 2-3 小时

**示例**:
```
core/
├── id/              # ID 生成（如果有特殊需求）
│   └── nanoid.ts
├── validation/      # 验证（如果有特殊需求）
│   └── zod-helpers.ts
└── disposable/      # 资源管理（保留）
    └── disposable.ts
```

---

**👉 你的决策**: [ ] 方案 A（使用成熟库） [ ] 方案 B（重新组织）

**额外问题**: 是否有特殊需求需要保留自定义工具？
- [ ] date.ts 有特殊需求
- [ ] string.ts 有特殊需求
- [ ] validation.ts 有特殊需求
- [ ] id.ts 有特殊需求
- [ ] 都没有特殊需求，可以全部替换

