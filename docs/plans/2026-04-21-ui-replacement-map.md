# Juanie UI Replacement Map

## 目标

把 Juanie 前端收敛成三层：

- 基座层：统一输入、选择、弹窗、提示、表单状态
- 页面层：只负责信息编排，不自己发明交互
- 领域层：继续保留项目、环境、发布、迁移、权限这些产品逻辑

## 现在就替换

### 1. 表单状态

- 引入：`@tanstack/react-form` + `zod`
- 替换范围：
  - `src/app/teams/new/page.tsx`
  - `src/components/settings/UserSettingsClient.tsx`
  - `src/components/teams/TeamSettingsClient.tsx`
  - `src/components/teams/TeamMembersClient.tsx`
  - `src/components/projects/create-project-form.tsx`
  - `src/components/projects/EnvVarManager.tsx`
  - `src/components/projects/ManualReleaseDialog.tsx`
  - `src/components/projects/ReleasePromoteDialog.tsx`

### 2. Toast / 页面反馈

- 引入：`sonner`
- 原则：
  - 成功操作统一 toast
  - 失败给单点错误，不在页面重复堆提示
  - 页面正文不再放“心里话式”状态说明

### 3. 表单布局 primitives

- 新基座：
  - `src/components/ui/form.tsx`
  - `src/components/ui/input.tsx`
  - `src/components/ui/select.tsx`
  - `src/components/ui/textarea.tsx`
- 原则：
  - label / help / error 统一
  - 字段 spacing 统一
  - 不再每页自己拼一套 field wrapper

## 下一批替换

### 4. 列表与筛选

- 建议引入：`@tanstack/react-table`
- 适用页面：
  - 环境列表
  - 发布列表
  - 团队成员
  - 审批列表
  - 数据库列表

### 5. 快捷入口

- 建议引入：`cmdk`
- 用途：
  - 创建环境
  - 创建发布
  - 邀请成员
  - 打开变量 / 域名 / 数据库动作

## 继续保留手写

- 项目 -> 环境 -> 发布 的对象模型
- promote / release / delivery 的产品语义
- 团队绑定、审批、成员权限
- 平台迁移治理、数据库修复计划
- 预览环境、域名、环境变量等控制面编排

## 高优先级文件

- `src/components/projects/create-project-form.tsx`
- `src/components/projects/EnvVarManager.tsx`
- `src/components/projects/ManualReleaseDialog.tsx`
- `src/components/teams/TeamMembersClient.tsx`
- `src/components/teams/TeamSettingsClient.tsx`

## 低优先级文件

- `src/components/ui/page-header.tsx`
- `src/components/ui/stats-card.tsx`
- `src/components/ui/empty-state.tsx`

这些不是不能改，而是先收敛交互基座，再统一展示容器会更稳。
