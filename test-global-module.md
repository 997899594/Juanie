# NestJS 全局模块测试

## 问题
在 monorepo 中，ConfigModule 设置为全局（`isGlobal: true`），但某些模块仍然无法注入 ConfigService。

## NestJS 官方文档说明

根据 NestJS 官方文档：
- 当模块使用 `@Global()` 装饰器或 `forRoot({ isGlobal: true })` 时，其 providers 应该在整个应用中可用
- 全局模块只需要在根模块或任何模块中导入一次
- 全局模块的 providers 不需要在其他模块中重复导入

## 实际测试结果

### 测试 1: 不导入 ConfigModule
```
GitOpsModule (不导入 ConfigModule)
  └─ GitOpsService (注入 ConfigService)
     ❌ 错误: Can't resolve dependencies of GitOpsService
```

### 测试 2: 导入 ConfigModule  
```
GitOpsModule (导入 ConfigModule)
  └─ GitOpsService (注入 ConfigService)
     ✅ 成功
```

## 可能的原因

### 1. Monorepo 包边界问题
在 monorepo 中，service packages 是独立的 npm 包：
- `@juanie/service-business`
- `@juanie/service-foundation`
- `@juanie/service-extensions`

这些包在构建时是独立的，它们不知道 AppModule 的配置。

### 2. 模块加载顺序
NestJS 的模块加载顺序可能影响全局模块的可用性：
```
AppModule
  ├─ ConfigModule (isGlobal: true) ← 在这里注册
  ├─ FoundationModule
  ├─ BusinessModule
  │   ├─ GitOpsModule ← 这里可能还没有 ConfigModule
  │   └─ ...
  └─ ExtensionsModule
```

### 3. NestJS 的依赖注入机制
NestJS 的依赖注入在处理嵌套模块时，可能需要显式的模块导入来建立依赖关系。

## 需要验证的点

1. ✅ ConfigModule 确实设置了 `isGlobal: true`
2. ❓ 全局模块是否在所有子模块加载前就已经注册
3. ❓ 是否是 monorepo 的包边界导致的问题
4. ❓ 是否是 NestJS 11 的特定行为

## 下一步

创建一个最小化的测试用例来验证：
1. 在单一包中的全局模块行为
2. 在跨包的全局模块行为
3. 对比两者的差异
