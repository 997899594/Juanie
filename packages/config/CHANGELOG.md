# Changelog - @juanie/config-*

## 2025-01-XX - v0.1.0

### ✨ 新增

**@juanie/config-typescript**
- ✅ 完善 `base.json` - 添加更严格的类型检查
- ✅ 更新 `node.json` - Node 环境配置
- ✅ 新增 `dom.json` - DOM 环境配置（Vite 应用）
- ✅ 新增 `dom-lib.json` - DOM + Vue 配置（组件库）

**@juanie/config-vite** (新包)
- ✅ 新增 `app.ts` - Vue 应用配置
- ✅ 新增 `lib.ts` - 纯 TS 库配置
- ✅ 新增 `lib-vue.ts` - Vue 组件库配置

**@juanie/config-vitest**
- ✅ 重构为导出多个配置
- ✅ 新增 `node.ts` - Node 环境测试配置
- ✅ 新增 `dom.ts` - DOM 环境测试配置
- ✅ 添加覆盖率阈值配置

### 📝 文档
- ✅ 新增 `README.md` - 使用文档
- ✅ 新增 `CHANGELOG.md` - 变更日志

### 🔧 配置
- ✅ 更新根 `package.json` - 添加 `packages/config/*` 到 workspaces
