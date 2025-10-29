# @juanie/config-*

Juanie 项目的共享配置包集合。

## 📦 包列表

### @juanie/config-typescript

TypeScript 配置预设。

**可用配置**:
- `base.json` - 基础配置
- `node.json` - Node 环境（后端项目）
- `dom.json` - DOM 环境（Vite 应用）
- `dom-lib.json` - DOM + Vue（组件库）

**使用示例**:

```json
// tsconfig.json - Node 项目
{
  "extends": "@juanie/config-typescript/node.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  }
}
```

```json
// tsconfig.json - Vue 应用
{
  "extends": "@juanie/config-typescript/dom-lib.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

---

### @juanie/config-vite

Vite 配置预设。

**可用配置**:
- `app` - Vue 应用配置
- `lib` - 纯 TS 库配置
- `lib-vue` - Vue 组件库配置

**使用示例**:

```ts
// vite.config.ts - Vue 应用
import { defineConfig } from 'vite'
import { defineAppConfig } from '@juanie/config-vite/app'

export default defineConfig(
  defineAppConfig({
    root: __dirname,
    port: 3000,
    tailwind: true,
  })
)
```

```ts
// vite.config.ts - Vue 组件库
import { defineConfig } from 'vite'
import { defineVueLibConfig } from '@juanie/config-vite/lib-vue'

export default defineConfig(
  defineVueLibConfig({
    name: 'MyLib',
    entry: 'src/index.ts',
    root: __dirname,
    dts: true,
    tailwind: true,
  })
)
```

---

### @juanie/config-vitest

Vitest 配置预设。

**可用配置**:
- `node` - Node 环境测试
- `dom` - DOM 环境测试

**使用示例**:

```ts
// vitest.config.ts - Node 环境
import { defineConfig, mergeConfig } from 'vitest/config'
import nodeConfig from '@juanie/config-vitest/node'

export default mergeConfig(
  nodeConfig,
  defineConfig({
    test: {
      setupFiles: ['./test/setup.ts'],
    },
  })
)
```

```ts
// vitest.config.ts - DOM 环境
import { defineConfig, mergeConfig } from 'vitest/config'
import domConfig from '@juanie/config-vitest/dom'

export default mergeConfig(
  domConfig,
  defineConfig({
    test: {
      setupFiles: ['./test/setup.ts'],
    },
  })
)
```

## 🔧 开发

所有配置包都是私有包（`private: true`），仅在 monorepo 内部使用。

## 📝 注意事项

1. **TypeScript 配置**: 使用 `extends` 继承配置
2. **Vite 配置**: 使用函数式配置，支持自定义选项
3. **Vitest 配置**: 使用 `mergeConfig` 合并配置

## 🚀 最佳实践

- 尽量使用预设配置，减少重复
- 只在必要时覆盖配置项
- 保持配置简洁明了
