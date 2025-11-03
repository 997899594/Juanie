# 实施计划

- [-] 1. 准备工作
  - 创建备份分支保存当前状态
  - 创建工作分支进行清理
  - _需求: 1.3, 5.1_

- [ ] 2. 清理归档文档
  - [ ] 2.1 删除已完成的归档文档
    - 删除 `docs/archive/BACKEND_COMPLETE.md`
    - 删除 `docs/archive/CROSS_CUTTING_CONCERNS_COMPLETE.md`
    - 删除 `docs/archive/FRONTEND_CHECKLIST.md`
    - 删除 `docs/archive/FRONTEND_SUMMARY.md`
    - 删除 `docs/archive/READY_FOR_TESTING.md`
    - 删除 `docs/archive/THEME_SYSTEM_COMPLETE.md`
    - 删除 `docs/archive/TYPE_CHECK_COMPLETE.md`
    - 删除 `docs/archive/UI_BUILD_FREEZE_SOLUTION.md`
    - 删除 `docs/archive/VITE_FREEZE_SOLUTION.md`
    - _需求: 1.2, 1.3_
  
  - [ ] 2.2 移动有价值的归档文档
    - 移动 `docs/archive/ARCHITECTURE_ANALYSIS.md` 到 `docs/archive/`（保留）
    - 移动 `docs/archive/TYPE_ARCHITECTURE_FINAL.md` 到 `docs/archive/`（保留）
    - _需求: 1.2_

- [ ] 3. 创建新的文档结构
  - [ ] 3.1 创建文档分类目录
    - 创建 `docs/getting-started/` 目录
    - 创建 `docs/architecture/` 目录
    - 创建 `docs/development/` 目录
    - 创建 `docs/deployment/` 目录
    - 创建 `docs/troubleshooting/` 目录
    - _需求: 5.1, 5.2, 5.3_
  
  - [ ] 3.2 重组现有文档
    - 移动 `docs/ARCHITECTURE.md` → `docs/architecture/overview.md`
    - 移动 `docs/SERVICES.md` → `docs/architecture/services.md`
    - 移动 `docs/DATABASE_CONFIG.md` → `docs/architecture/database.md`
    - 移动 `docs/DEVELOPMENT.md` → `docs/development/setup.md`
    - 移动 `docs/DEPLOYMENT.md` → `docs/deployment/docker.md`
    - 移动 `K3S_SETUP.md` → `docs/deployment/k3s.md`
    - 移动 `docs/MONITORING.md` → `docs/deployment/monitoring.md`
    - 移动 `docs/TROUBLESHOOTING.md` → `docs/troubleshooting/common-issues.md`
    - 移动 `QUICK_START.md` → `docs/getting-started/quick-start.md`
    - _需求: 5.1, 5.2, 5.3_
  
  - [ ] 3.3 合并重复文档
    - 合并 `START_SERVICES.md` 内容到 `docs/getting-started/quick-start.md`
    - 删除 `START_SERVICES.md`
    - _需求: 1.1, 1.3_

- [ ] 4. 更新文档索引和链接
  - [ ] 4.1 删除重复的索引文件
    - 删除 `docs/INDEX.md`
    - _需求: 1.1, 1.3_
  
  - [ ] 4.2 更新主文档索引
    - 更新 `docs/README.md` 为统一的文档导航入口
    - 添加按分类的文档链接
    - 添加快速查找指南
    - 添加文档贡献说明
    - _需求: 2.1, 2.2, 2.3, 4.1, 4.3, 5.5_
  
  - [ ] 4.3 修复根目录 README
    - 更新 `README.md` 中的文档链接
    - 删除对不存在文件的引用（PROJECT_STRUCTURE.md, TYPE_ARCHITECTURE_FINAL.md, CONTRIBUTING.md）
    - 更新文档路径为新的结构
    - _需求: 1.3, 1.5_
  
  - [ ] 4.4 更新所有文档中的内部链接
    - 扫描所有 Markdown 文件中的链接
    - 更新链接指向新的文档位置
    - 删除失效的链接
    - _需求: 1.3, 1.5_

- [ ] 5. 创建脚本新结构
  - [ ] 5.1 创建脚本分类目录
    - 创建 `scripts/dev/` 目录
    - 创建 `scripts/ops/` 目录
    - _需求: 3.1, 3.2_
  
  - [ ] 5.2 整合开发脚本
    - 合并 `scripts/fix-vite-freeze.sh` 和 `scripts/kill-stuck-processes.sh` 创建 `scripts/dev/clean-cache.sh`
    - 移动 `scripts/dev-web-safe.sh` → `scripts/dev/start-dev.sh`
    - 移动 `scripts/diagnose-build.sh` → `scripts/dev/diagnose.sh`
    - 删除原有的 `fix-vite-freeze.sh`, `kill-stuck-processes.sh`, `dev-web-safe.sh`, `diagnose-build.sh`
    - _需求: 3.1, 3.2, 3.5_
  
  - [ ] 5.3 整理运维脚本
    - 移动 `scripts/check-env.sh` → `scripts/ops/check-env.sh`
    - 移动 `scripts/check-config-deps.sh` → `scripts/ops/check-deps.sh`
    - 删除原有的 `check-env.sh`, `check-config-deps.sh`
    - _需求: 3.1, 3.2_

- [ ] 6. 更新脚本文档和配置
  - [ ] 6.1 更新脚本 README
    - 更新 `scripts/README.md` 反映新的脚本结构
    - 添加脚本使用说明
    - 添加脚本开发规范
    - _需求: 3.2, 3.3, 4.2_
  
  - [ ] 6.2 更新 package.json 脚本命令
    - 添加 `dev:start` 命令指向 `./scripts/dev/start-dev.sh`
    - 添加 `dev:clean` 命令指向 `./scripts/dev/clean-cache.sh`
    - 添加 `dev:diagnose` 命令指向 `./scripts/dev/diagnose.sh`
    - 添加 `ops:check-env` 命令指向 `./scripts/ops/check-env.sh`
    - 添加 `ops:check-deps` 命令指向 `./scripts/ops/check-deps.sh`
    - 删除旧的脚本命令引用
    - _需求: 3.4_

- [ ] 7. 建立文档维护规范
  - [ ] 7.1 创建文档贡献指南
    - 在 `docs/README.md` 中添加文档编写规范
    - 添加文档审核流程说明
    - 添加文档更新流程说明
    - _需求: 2.1, 2.2, 2.3, 2.4, 4.1, 4.2, 4.3, 4.4_
  
  - [ ] 7.2 创建文档模板
    - 创建标准文档模板文件
    - 包含标题、简介、目录、内容、相关链接等部分
    - _需求: 2.3, 2.4_

- [ ] 8. 验证和测试
  - [ ] 8.1 验证文档链接
    - 检查所有文档中的内部链接是否有效
    - 检查所有文档中的外部链接是否可访问
    - _需求: 1.3, 1.5_
  
  - [ ] 8.2 测试脚本功能
    - 测试 `scripts/dev/start-dev.sh` 是否正常工作
    - 测试 `scripts/dev/clean-cache.sh` 是否正常工作
    - 测试 `scripts/dev/diagnose.sh` 是否正常工作
    - 测试 `scripts/ops/check-env.sh` 是否正常工作
    - 测试 `scripts/ops/check-deps.sh` 是否正常工作
    - _需求: 3.2, 3.3_
  
  - [ ] 8.3 验证 package.json 命令
    - 测试所有新添加的 npm 脚本命令
    - 确保命令指向正确的脚本文件
    - _需求: 3.4_

- [ ] 9. 清理和提交
  - [ ] 9.1 最终清理
    - 删除空的目录
    - 确认所有旧文件已删除
    - 确认所有新文件已创建
    - _需求: 1.2, 1.3_
  
  - [ ] 9.2 提交更改
    - 提交所有更改到 Git
    - 编写清晰的提交信息
    - 推送到远程仓库
    - _需求: 所有需求_
