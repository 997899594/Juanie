# 故事：NexusNote 发布恢复

## 30 秒版本

NexusNote 是 Juanie 子应用链路的真实验证项目。它暴露过迁移、schema gate、runner 环境、release 状态和 production
rollout 的多处问题。这个故事可以用来证明我们不是只画架构，而是用真实项目把链路打穿。

## Situation

用户希望删除并重建 NexusNote 项目，验证 Juanie 的导入、配置注入、首发、schema gate、staging 和 production
promotion 是否能完整跑通。

过程中出现过多类问题：

- 旧 `juanie.yaml` 和新注入配置冲突。
- CI workflow inputs 不匹配。
- schema gate 阻断。
- schema-runner 运行时缺命令或超时。
- production release 进入受控放量后用户不知道下一步。

## Task

目标不是逐个打补丁，而是确认链路边界：

- 子应用仓库不保留旧 Juanie 配置。
- Juanie 导入项目时注入当前正确配置。
- Schema safety 和 migration 执行边界清晰。
- Release detail 能承接 production rollout。
- 失败能通过状态和 AI/日志解释。

## Action

- 清理 NexusNote 侧旧 Juanie 配置。
- 强化项目导入配置注入。
- 统一 schema-runner runtime。
- 修复 release/promotion 详情页路径。
- 清理旧迁移和重复链路。
- 将平台自身发布和子应用发布边界写入文档。

## Result

这个过程让 Juanie 的黄金路径更真实：

- 导入项目不是只存一条记录，而要注入正确 CI 和配置。
- 子应用不是平台 GitOps。
- Schema gate 是发布主链。
- Production promotion 不是完成发布，而是进入可控放量阶段。

## 面试表达

可以这样讲：

> 我们用 NexusNote 做端到端真实验证，发现问题后没有继续补丁式兼容旧配置，而是把导入配置注入、schema gate、
> runtime runner 和 production rollout 边界重新理顺。这个过程证明发布平台最难的不是写一个部署按钮，
> 而是让不同系统之间的状态、配置和用户下一步保持一致。
