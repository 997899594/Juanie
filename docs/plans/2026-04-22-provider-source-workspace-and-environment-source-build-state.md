## Provider Source Workspace And Environment Source Build State

### Why

控制面的 schema gate、desired schema 导出和 Atlas 修复草稿之前在运行时依赖系统 `git`。这会让 `juanie-web` 这类只负责 API/准入判断的容器被迫携带额外系统依赖，也让源码获取路径和平台已有的 Git provider 抽象分叉。

同时，环境侧的“仓库构建中/失败”状态之前只按 preview 建模。结果是持久直发环境在项目初始化时已经触发了首发构建，但 UI 仍然显示“暂无版本 / Git 追踪待建立”，和真实链路不一致。

### Architecture

现在统一为两条平台级路径：

1. Provider-native source workspace
   - 继续复用现有 `GitProvider` 抽象。
   - provider 通过官方 API 下载仓库 archive。
   - 控制面在本地解压 archive，生成一次性的 source workspace。
   - desired schema 导出、Atlas schema repair draft 都只读取这个 workspace，不再 shell `git clone/fetch/checkout`。

2. Unified environment source build state
   - 继续复用现有环境构建状态存储列，避免引入第二套状态表。
   - 统一通过 `source-build-state.ts` 读写。
   - preview 环境和持久直发环境共用一条首发/源码构建状态展示链路。

### Behavior Changes

- 项目初始化触发首发构建时，会先把匹配的直发环境标记为 `building`。
- 如果仓库 CI 触发失败，环境状态会标记为 `failed`。
- 当 release 成功创建进入平台交付链路时，会清空该环境的 source build 状态。
- UI 在没有首个 release 之前，也能正确展示“预览构建中 / 首发构建中 / 构建失败”，不再误报“暂无版本”。

### Non-goals

- 这次没有改数据库列名；只是把旧的 preview-only helper 收口为通用 helper，等后续做 schema 清理时再统一命名。
- 这次没有引入第二套 Git 或 archive 依赖库，避免在 provider 抽象之上再长出新的获取路径。
