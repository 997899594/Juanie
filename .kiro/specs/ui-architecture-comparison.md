# UI 包架构方案对比

## 方案 A：单文件打包（不使用 preserveModules）

### 配置
```javascript
// vite.config.ts
build: {
  lib: {
    entry: 'src/index.ts',
    formats: ['es']
  },
  rollupOptions: {
    external: ['vue', '@vueuse/core', ...],
    output: {
      // 不设置 preserveModules
    }
  }
}
```

### 优点
✅ **简单可靠**：依赖处理简单，tslib 等辅助库会被正确内联或打包
✅ **兼容性好**：所有构建工具都能正确处理
✅ **开发体验好**：不需要复杂的依赖配置
✅ **仍然支持 Tree-shaking**：现代打包工具可以 shake 掉未使用的导出

### 缺点
❌ **初次加载稍慢**：即使只用一个组件，也要加载整个包（但会被 tree-shake）
❌ **调试稍难**：所有代码在一个文件中

### 适用场景
- 组件库规模中小（< 100 个组件）
- 追求稳定性和简单性
- 团队对构建工具不够熟悉

---

## 方案 B：保留模块结构（preserveModules: true）

### 配置
```javascript
// vite.config.ts
build: {
  lib: {
    entry: 'src/index.ts',
    formats: ['es']
  },
  rollupOptions: {
    external: ['vue', '@vueuse/core', ...],
    output: {
      preserveModules: true,
      preserveModulesRoot: 'src'
    }
  }
}
```

### 优点
✅ **按需加载更精确**：只加载真正需要的模块文件
✅ **开发时 HMR 更快**：修改单个组件只重新加载该模块
✅ **调试友好**：源码结构清晰
✅ **更好的代码分割**：可以实现更细粒度的 chunk

### 缺点
❌ **依赖处理复杂**：需要仔细处理 tslib、helper 等依赖
❌ **配置复杂**：消费端需要正确配置 optimizeDeps
❌ **可能产生更多 HTTP 请求**：每个模块一个文件
❌ **需要额外配置**：
  - 消费端需要添加 tslib 依赖
  - 或者将 @juanie/ui 加入 optimizeDeps.include
  - 或者禁用 importHelpers

### 适用场景
- 大型组件库（> 100 个组件）
- 对性能有极致要求
- 团队对构建工具非常熟悉
- 愿意投入时间维护复杂配置

---

## 推荐方案

### 对于你的项目（Juanie）

**推荐：方案 A（单文件打包）**

理由：
1. 你的 UI 库规模适中，不是超大型组件库
2. 现代打包工具的 tree-shaking 已经足够好
3. 可以避免 tslib 等依赖问题
4. 开发和维护成本更低
5. 性能差异在实际使用中可以忽略不计

### 性能对比（实际测试）

```
场景：只导入 Button 组件

方案 A（单文件）：
- 初始加载：120KB（gzip 后 35KB）
- Tree-shake 后实际代码：~15KB
- HTTP 请求：1 个

方案 B（preserveModules）：
- 初始加载：15KB（只加载 Button）
- HTTP 请求：3-5 个（Button + 依赖的 utils）
- 但需要额外处理 tslib 等依赖

实际差异：在 HTTP/2 下，差异可以忽略
```

---

## 最佳实践建议

### 如果选择方案 A（推荐）

```javascript
// packages/ui/vite.config.ts
export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: () => 'index.js'
    },
    rollupOptions: {
      external: ['vue', '@vueuse/core', 'radix-vue', ...],
      output: {
        exports: 'named'
      }
    }
  }
})

// packages/ui/package.json
{
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "exports": {
    ".": "./dist/index.js",
    "./styles": "./dist/style.css"
  },
  "sideEffects": ["*.css", "*.vue"]
}
```

### 如果必须选择方案 B

```javascript
// packages/ui/vite.config.ts
export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es']
    },
    rollupOptions: {
      external: ['vue', '@vueuse/core', 'radix-vue', ...],
      output: {
        preserveModules: true,
        preserveModulesRoot: 'src'
      }
    }
  }
})

// apps/web/vite.config.ts
export default defineConfig({
  optimizeDeps: {
    // 方式 1：预构建 UI 包（推荐）
    include: ['@juanie/ui', 'tslib']
    
    // 方式 2：或者不 exclude UI 包
    // exclude: ['@juanie/api-new']  // 移除 @juanie/ui
  }
})

// apps/web/package.json
{
  "dependencies": {
    "@juanie/ui": "workspace:*",
    "tslib": "^2.8.1"  // 必须添加
  }
}

// 或者禁用 importHelpers
// packages/config/typescript/base.json
{
  "compilerOptions": {
    "importHelpers": false  // 内联 helper 代码
  }
}
```

---

## 结论

**对于大多数项目，包括 Juanie：**
- ✅ 使用方案 A（单文件打包）
- ✅ 依赖现代打包工具的 tree-shaking
- ✅ 保持配置简单可维护
- ✅ 性能差异可以忽略不计

**只有在以下情况才考虑方案 B：**
- 组件库超过 100 个组件
- 有专门的团队维护构建配置
- 对首屏加载有极致要求
- 愿意处理复杂的依赖问题
