# 文档和脚本清理设计文档

## 概述

本设计文档描述了如何系统性地清理项目中的文档和脚本，建立清晰的文档结构和维护规范。清理工作将分为文档整理、脚本优化和规范建立三个主要部分。

## 架构

### 文档结构设计

```
项目根目录/
├── README.md                    # 项目概述和快速开始
├── QUICK_START.md              # 快速启动指南
├── docs/                       # 详细文档目录
│   ├── README.md               # 文档索引（统一入口）
│   ├── getting-started/        # 入门指南
│   │   ├── installation.md     # 安装指南
│   │   ├── quick-start.md      # 快速开始
│   │   └── configuration.md    # 配置说明
│   ├── architecture/           # 架构文档
│   │   ├── overview.md         # 架构概述
│   │   ├── services.md         # 服务说明
│   │   └── database.md         # 数据库设计
│   ├── development/            # 开发指南
│   │   ├── setup.md            # 开发环境搭建
│   │   ├── workflow.md         # 开发流程
│   │   └── testing.md          # 测试指南
│   ├── deployment/             # 部署文档
│   │   ├── docker.md           # Docker 部署
│   │   ├── k3s.md              # K3s 部署
│   │   └── monitoring.md       # 监控配置
│   └── troubleshooting/        # 故障排查
│       ├── common-issues.md    # 常见问题
│       └── debugging.md        # 调试技巧
├── scripts/                    # 脚本工具
│   ├── README.md               # 脚本说明
│   ├── dev/                    # 开发脚本
│   │   ├── start.sh            # 启动开发环境
│   │   └── clean.sh            # 清理缓存
│   └── ops/                    # 运维脚本
│       ├── check-env.sh        # 环境检查
│       └── diagnose.sh         # 问题诊断
└── .ai/                        # AI 辅助文档（保留）
    ├── documents/              # 产品和技术文档
    └── rules/                  # 项目规则
```

### 脚本分类设计

```
scripts/
├── README.md                   # 脚本总览和使用指南
├── dev/                        # 开发相关脚本
│   ├── start-dev.sh            # 启动开发环境（整合 dev-web-safe.sh）
│   ├── clean-cache.sh          # 清理缓存（整合 fix-vite-freeze.sh 和 kill-stuck-processes.sh）
│   └── diagnose.sh             # 诊断工具（保留 diagnose-build.sh）
└── ops/                        # 运维相关脚本
    ├── check-env.sh            # 环境检查（保留）
    └── check-deps.sh           # 依赖检查（保留 check-config-deps.sh）
```

## 组件和接口

### 1. 文档管理组件

#### 文档索引 (docs/README.md)
- **职责**: 提供统一的文档导航入口
- **内容**:
  - 按主题分类的文档链接
  - 快速查找指南
  - 文档贡献说明
- **格式**: 使用清晰的分类和表格

#### 分类文档目录
- **getting-started/**: 新手入门文档
- **architecture/**: 系统架构和设计
- **development/**: 开发指南和最佳实践
- **deployment/**: 部署和运维
- **troubleshooting/**: 问题排查

### 2. 脚本工具组件

#### 开发脚本 (scripts/dev/)

**start-dev.sh** - 启动开发环境
```bash
功能：
- 检查环境依赖
- 清理旧进程和缓存
- 启动开发服务器
- 提供友好的错误提示
```

**clean-cache.sh** - 清理缓存
```bash
功能：
- 杀死僵尸进程（vite, esbuild, turbo）
- 清理所有缓存目录
- 释放占用端口
- 可选：重新安装依赖
```

**diagnose.sh** - 诊断工具
```bash
功能：
- 检查运行中的进程
- 检查端口占用
- 检查系统资源
- 检查缓存大小
- 提供修复建议
```

#### 运维脚本 (scripts/ops/)

**check-env.sh** - 环境检查
```bash
功能：
- 验证环境变量配置
- 检查必需的服务
- 验证配置文件
```

**check-deps.sh** - 依赖检查
```bash
功能：
- 检查配置包依赖
- 验证版本兼容性
```

### 3. 文档维护规范

#### 文档生命周期
```
创建 → 审核 → 发布 → 维护 → 归档/删除
```

#### 文档模板
每个文档应包含：
- 标题和简介
- 目录（如果超过 3 个章节）
- 主要内容
- 相关链接
- 最后更新时间

#### 文档审核清单
- [ ] 内容准确无误
- [ ] 链接有效
- [ ] 代码示例可运行
- [ ] 格式统一
- [ ] 语言统一（中文）

## 数据模型

### 文档元数据

```typescript
interface DocumentMetadata {
  title: string              // 文档标题
  category: string           // 分类
  tags: string[]            // 标签
  lastUpdated: Date         // 最后更新时间
  author: string            // 作者
  status: 'draft' | 'published' | 'archived'  // 状态
  relatedDocs: string[]     // 相关文档
}
```

### 脚本元数据

```typescript
interface ScriptMetadata {
  name: string              // 脚本名称
  description: string       // 描述
  category: 'dev' | 'ops'   // 分类
  usage: string             // 使用方法
  dependencies: string[]    // 依赖
  permissions: string[]     // 所需权限
}
```

## 错误处理

### 文档问题处理

1. **链接失效**
   - 检测：使用工具扫描所有 Markdown 文件中的链接
   - 处理：修复或删除失效链接
   - 预防：建立链接检查机制

2. **内容过时**
   - 检测：定期审查文档更新时间
   - 处理：更新或标记为过时
   - 预防：建立文档审查流程

3. **格式不一致**
   - 检测：使用 Markdown linter
   - 处理：统一格式
   - 预防：提供文档模板

### 脚本问题处理

1. **脚本执行失败**
   - 提供清晰的错误信息
   - 给出修复建议
   - 记录错误日志

2. **权限不足**
   - 检测所需权限
   - 提示用户授权
   - 提供替代方案

3. **依赖缺失**
   - 检查依赖是否安装
   - 提供安装指令
   - 优雅降级

## 测试策略

### 文档测试

1. **链接测试**
   ```bash
   # 使用 markdown-link-check
   find docs -name "*.md" -exec markdown-link-check {} \;
   ```

2. **代码示例测试**
   - 提取文档中的代码块
   - 执行并验证结果
   - 确保示例可运行

3. **格式测试**
   ```bash
   # 使用 markdownlint
   markdownlint docs/**/*.md
   ```

### 脚本测试

1. **单元测试**
   - 测试脚本的各个功能
   - 模拟不同的环境条件
   - 验证错误处理

2. **集成测试**
   - 在真实环境中运行
   - 验证与其他工具的集成
   - 测试端到端流程

3. **兼容性测试**
   - 在不同操作系统上测试
   - 验证不同 Shell 的兼容性
   - 测试不同版本的依赖

## 清理计划

### 阶段 1: 文档清理

#### 1.1 删除重复文档
- 删除 `docs/INDEX.md`（保留 `docs/README.md`）
- 合并重复内容

#### 1.2 清理归档文档
删除以下已完成的文档：
- `docs/archive/BACKEND_COMPLETE.md`
- `docs/archive/CROSS_CUTTING_CONCERNS_COMPLETE.md`
- `docs/archive/FRONTEND_CHECKLIST.md`
- `docs/archive/FRONTEND_SUMMARY.md`
- `docs/archive/READY_FOR_TESTING.md`
- `docs/archive/THEME_SYSTEM_COMPLETE.md`
- `docs/archive/TYPE_CHECK_COMPLETE.md`
- `docs/archive/UI_BUILD_FREEZE_SOLUTION.md`
- `docs/archive/VITE_FREEZE_SOLUTION.md`

保留有参考价值的：
- `docs/archive/ARCHITECTURE_ANALYSIS.md`
- `docs/archive/TYPE_ARCHITECTURE_FINAL.md`

#### 1.3 修复根目录文档
更新 `README.md`，删除对不存在文件的引用：
- 删除 `PROJECT_STRUCTURE.md` 引用
- 删除 `TYPE_ARCHITECTURE_FINAL.md` 引用
- 删除 `CONTRIBUTING.md` 引用

#### 1.4 整理现有文档
将文档按新结构重新组织：
- `docs/ARCHITECTURE.md` → `docs/architecture/overview.md`
- `docs/SERVICES.md` → `docs/architecture/services.md`
- `docs/DATABASE_CONFIG.md` → `docs/architecture/database.md`
- `docs/DEVELOPMENT.md` → `docs/development/setup.md`
- `docs/DEPLOYMENT.md` → `docs/deployment/docker.md`
- `K3S_SETUP.md` → `docs/deployment/k3s.md`
- `docs/MONITORING.md` → `docs/deployment/monitoring.md`
- `docs/TROUBLESHOOTING.md` → `docs/troubleshooting/common-issues.md`
- `QUICK_START.md` → `docs/getting-started/quick-start.md`
- `START_SERVICES.md` → 合并到 `docs/getting-started/quick-start.md`

### 阶段 2: 脚本整合

#### 2.1 创建新的脚本结构
```bash
mkdir -p scripts/dev
mkdir -p scripts/ops
```

#### 2.2 整合开发脚本
- 合并 `fix-vite-freeze.sh` 和 `kill-stuck-processes.sh` → `scripts/dev/clean-cache.sh`
- 重命名 `dev-web-safe.sh` → `scripts/dev/start-dev.sh`
- 移动 `diagnose-build.sh` → `scripts/dev/diagnose.sh`

#### 2.3 整理运维脚本
- 移动 `check-env.sh` → `scripts/ops/check-env.sh`
- 重命名 `check-config-deps.sh` → `scripts/ops/check-deps.sh`

#### 2.4 更新 package.json
```json
{
  "scripts": {
    "dev:start": "./scripts/dev/start-dev.sh",
    "dev:clean": "./scripts/dev/clean-cache.sh",
    "dev:diagnose": "./scripts/dev/diagnose.sh",
    "ops:check-env": "./scripts/ops/check-env.sh",
    "ops:check-deps": "./scripts/ops/check-deps.sh"
  }
}
```

### 阶段 3: 建立规范

#### 3.1 创建文档贡献指南
在 `docs/README.md` 中添加：
- 文档编写规范
- 文档审核流程
- 文档更新流程

#### 3.2 创建脚本开发指南
在 `scripts/README.md` 中添加：
- 脚本编写规范
- 错误处理规范
- 测试要求

#### 3.3 建立自动化检查
- 添加 pre-commit hook 检查文档链接
- 添加 CI 检查文档格式
- 添加脚本测试

## 实施步骤

### 步骤 1: 备份
```bash
# 创建备份分支
git checkout -b docs-cleanup-backup
git push origin docs-cleanup-backup

# 切换到工作分支
git checkout -b docs-cleanup
```

### 步骤 2: 执行清理
按照清理计划逐步执行

### 步骤 3: 验证
- 检查所有链接是否有效
- 验证脚本是否正常工作
- 确保文档结构清晰

### 步骤 4: 提交
```bash
git add .
git commit -m "docs: 清理和重组文档及脚本"
git push origin docs-cleanup
```

## 维护计划

### 定期审查
- **每月**: 检查文档链接有效性
- **每季度**: 审查文档内容准确性
- **每半年**: 评估文档结构合理性

### 持续改进
- 收集用户反馈
- 优化文档结构
- 更新最佳实践

## 相关文档

- 需求文档: `requirements.md`
- 实施任务: `tasks.md`
