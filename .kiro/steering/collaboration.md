---
inclusion: always
---

# 协作原则

**使用成熟工具，追求正确完整的实现，绝不向后兼容。**

## 技术选型

1. **优先使用成熟工具和库** - 不要重复造轮子
2. **使用前沿但稳定的技术** - Bun, Vite 7, Tailwind 4, tRPC, Drizzle, Biome
3. **避免临时方案** - 找根本原因，用官方方案，不用 setTimeout/any/@ts-ignore
4. **声明式优于命令式** - 用配置、ORM、状态机、Schema 验证

## 代码质量

1. **类型安全** - TS 严格模式，避免 any，用 Zod 验证，tRPC 端到端类型安全
2. **完整错误处理** - 捕获具体错误类型，记录日志，抛出友好错误
3. **现代特性** - 可选链 `?.`，空值合并 `??`，解构，模板字符串，async/await

## 架构

1. **关注点分离** - Service 层业务逻辑，DTO/Schema 验证，路由转换，组件 UI
2. **依赖注入** - 用 NestJS DI，不直接导入实例
3. **事件驱动** - 用事件解耦服务

## 常用工具

- 数据：lodash-es, dayjs, zod, nanoid
- 后端：NestJS, Drizzle ORM, BullMQ, tRPC
- 前端：Vue 3, Pinia, @vueuse/core, shadcn-vue, lucide-vue-next

## 核心原则

1. 使用成熟工具，不重复造轮子
2. 用正确方案，不临时 workaround
3. 类型安全优先
4. 关注点分离，声明式优于命令式
5. **❌ 绝不向后兼容** - 直接替换，删除旧代码，修改所有调用方
