# 故事：Preview 现代化

## 30 秒版本

Preview 现代化的核心是：用户选择分支后，平台直接基于远端最新 commit 生成可访问环境，而不是要求用户为了部署再提交一次代码。

## Situation

用户提出一个明确诉求：

> 我想基于某个分支直接建立预览环境，相当于基于当前分支创建最新环境，不需要用户再提交一次代码。

这个诉求非常合理，因为现代 preview 应该是围绕需求和分支，而不是围绕“再触发一次 CI”。

## Task

目标是重新设计 preview 创建体验：

- 输入 branch/MR。
- 平台解析最新 commit。
- 创建环境和 release。
- 显示构建中状态。
- 成功后直接进入可访问 preview。

## Action

- 补齐远端分支解析。
- 建模 preview build source ref/commit/status。
- 通过 ApplicationSet 管理 scaffold。
- release 状态机负责部署。
- 数据库策略增加保护，避免 inherit 误操作。
- UI 弹窗和环境详情改成更清晰的流程。

## Result

Preview 从“隐藏在 CI 触发里的部署副产物”变成用户可主动创建的需求验证工具。

## 面试表达

可以这样讲：

> 这次改动体现了一个产品判断：Preview 的用户心智不是“我触发了一次流水线”，而是“我想看这个分支”。
> 所以平台应该负责解析远端最新 commit、创建环境、触发发布和展示状态。用户不需要理解底层 CI 触发细节。

## AI 可以怎么增强

AI 可以在 preview 场景做三件事：

- 解释 preview 创建失败原因，比如分支不存在、workflow 不支持、schema gate 阻断。
- 总结 preview 和目标环境的差异。
- 提醒数据库策略风险，比如 inherit 可能影响源环境。
