# 文档组织说明

> 本文档说明项目文档的组织结构和维护规范

**最后更新**: 2024-12-22

## 📁 目录结构

```
docs/
├── README.md                    # 文档导航（主入口）
├── ORGANIZATION.md              # 本文件
├── SUMMARY.md                   # 文档摘要
├── ROADMAP.md                   # 项目路线图
├── CHANGELOG.md                 # 变更日志
├── API_REFERENCE.md             # API 参考
├── ARCHITECTURE.md              # 架构概览
├── IMPLEMENTATION_SUMMARY.md    # 实现总结
│
├── guides/                      # 操作指南
│   ├── README.md               # 指南索引
│   ├── quick-start.md          # 快速开始
│   ├── QUICK_REFERENCE.md      # 快速参考
│   └── ...                     # 其他指南
│
├── architecture/                # 架构设计
│   ├── authentication-architecture.md
│   ├── template-system-ejs-migration.md
│   ├── database-design-standards.md
│   └── ...                     # 其他架构文档
│
├── troubleshooting/            # 问题排查
│   ├── README.md               # 问题索引
│   ├── template-system-handlebars-github-actions-conflict.md
│   ├── flux-performance-optimization.md
│   └── ...                     # 其他问题文档
│
├── tutorials/                   # 深入教程
│   ├── monorepo-turborepo.md
│   ├── trpc-fullstack-typesafety.md
│   └── ...                     # 其他教程
│
└── archive/                     # 历史文档
    ├── CLEANUP_SUMMARY.md
    ├── COMPLETE_ANALYSIS.md
    └── ...                     # 过时的文档
```

## 📚 文档分类

### 1. guides/ - 操作指南

**目的**: 告诉读者"怎么做"

**内容类型**:
- 快速开始指南
- 配置指南
- 部署指南
- 最佳实践
- 清单和检查表

**命名规范**:
- 使用动词开头: `setup-github-container-registry.md`
- 或使用名词 + 指南: `authentication-deployment-guide.md`

**示例**:
- `quick-start.md` - 5 分钟上手
- `k3s-optimization-checklist.md` - K3s 优化清单
- `production-readiness-checklist.md` - 生产就绪清单

### 2. architecture/ - 架构设计

**目的**: 告诉读者"为什么这样做"

**内容类型**:
- 系统架构
- 技术决策
- 设计模式
- 对比分析
- 迁移方案

**命名规范**:
- 使用名词描述: `authentication-architecture.md`
- 或使用主题 + 类型: `template-system-ejs-migration.md`

**示例**:
- `authentication-architecture.md` - 认证系统架构
- `template-system-ejs-migration.md` - 模板系统迁移决策
- `deployment-strategies-comparison.md` - 部署策略对比

### 3. troubleshooting/ - 问题排查

**目的**: 告诉读者"出错了怎么办"

**内容类型**:
- 问题描述
- 根本原因
- 解决方案
- 验证步骤
- 经验教训

**命名规范**:
- 使用问题描述: `drizzle-relations-circular-dependency.md`
- 或使用组件 + 问题: `flux-performance-optimization.md`

**示例**:
- `template-system-handlebars-github-actions-conflict.md` - 模板系统冲突
- `flux-performance-optimization.md` - Flux 性能问题
- `drizzle-relations-circular-dependency.md` - 数据库关系问题

### 4. tutorials/ - 深入教程

**目的**: 告诉读者"完整的实现过程"

**内容类型**:
- 端到端教程
- 集成指南
- 深入解析
- 实战案例

**命名规范**:
- 使用技术 + 主题: `monorepo-turborepo.md`
- 或使用场景描述: `trpc-fullstack-typesafety.md`

**示例**:
- `monorepo-turborepo.md` - Monorepo 完整设置
- `trpc-fullstack-typesafety.md` - tRPC 类型安全实现
- `ollama-ai-integration.md` - AI 模型集成

### 5. archive/ - 历史文档

**目的**: 保存过时但有参考价值的文档

**内容类型**:
- 已废弃的方案
- 历史分析文档
- 临时总结文档

**规则**:
- 不在主索引中显示
- 保留用于历史参考
- 定期清理（6 个月以上）

## 📝 文档模板

### 操作指南模板

```markdown
# [指南标题]

> 一句话描述这个指南的目的

## 前置条件

- 需要的环境
- 需要的权限
- 需要的知识

## 步骤

### 1. [第一步]

详细说明...

### 2. [第二步]

详细说明...

## 验证

如何确认操作成功...

## 常见问题

- Q: ...
- A: ...

## 相关文档

- [相关文档1](link)
- [相关文档2](link)

---

**最后更新**: YYYY-MM-DD  
**维护者**: 团队/个人
```

### 架构文档模板

```markdown
# [架构标题]

## 概述

简短描述这个架构的目的和范围...

## 背景

为什么需要这个架构...

## 设计目标

1. 目标1
2. 目标2

## 架构设计

### 核心组件

详细说明...

### 数据流

详细说明...

## 技术选型

| 技术 | 理由 |
|------|------|
| ... | ... |

## 对比分析

### 方案 A vs 方案 B

| 特性 | 方案 A | 方案 B |
|------|--------|--------|
| ... | ... | ... |

## 实现细节

详细说明...

## 相关文档

- [相关文档1](link)
- [相关文档2](link)

---

**最后更新**: YYYY-MM-DD  
**负责人**: 团队/个人
```

### 问题排查模板

```markdown
# [问题标题]

## 问题描述

**日期**: YYYY-MM-DD  
**严重程度**: 高/中/低  
**影响范围**: ...

### 症状

详细描述问题表现...

### 根本原因

为什么会出现这个问题...

## 尝试过的方案

### ❌ 方案 1: [方案名称]

**尝试**: ...  
**问题**: ...  
**结果**: 放弃

### ❌ 方案 2: [方案名称]

**尝试**: ...  
**问题**: ...  
**结果**: 不采用

## 最终解决方案

### ✅ 方案: [方案名称]

详细说明...

### 实现步骤

1. 步骤1
2. 步骤2

### 验证

如何确认问题已解决...

## 相关文档

- [相关文档1](link)
- [相关文档2](link)

## 经验教训

1. 教训1
2. 教训2

## 解决状态

**状态**: 已解决/进行中  
**解决方案**: ...  
**验证**: ...  
**文档**: 已完善

---

**最后更新**: YYYY-MM-DD  
**负责人**: 团队/个人  
**标签**: `tag1`, `tag2`, `tag3`
```

## 🔄 文档维护流程

### 创建新文档

1. **确定分类** - 选择合适的目录（guides/architecture/troubleshooting/tutorials）
2. **使用模板** - 根据文档类型使用对应模板
3. **命名规范** - 使用 kebab-case，描述性命名
4. **编写内容** - 遵循模板结构
5. **更新索引** - 在对应目录的 README.md 中添加链接
6. **更新主索引** - 在 docs/README.md 中添加链接
7. **格式化** - 运行 `biome check --write`

### 更新现有文档

1. **修改内容** - 更新文档内容
2. **更新日期** - 修改"最后更新"日期
3. **检查链接** - 确保所有链接有效
4. **格式化** - 运行 `biome check --write`

### 归档文档

1. **评估价值** - 确认文档是否过时
2. **移动文件** - 移动到 `docs/archive/`
3. **更新索引** - 从主索引中移除
4. **添加说明** - 在归档文档顶部添加归档原因

### 定期清理

**频率**: 每季度一次

**清理内容**:
- 6 个月以上的归档文档
- 重复的文档
- 过时的临时文档

## 📊 文档质量标准

### 必需元素

- [ ] 清晰的标题
- [ ] 简短的概述
- [ ] 结构化的内容
- [ ] 代码示例（如适用）
- [ ] 相关文档链接
- [ ] 最后更新日期

### 可选元素

- [ ] 目标读者
- [ ] 前置知识
- [ ] 图表和示意图
- [ ] 常见问题
- [ ] 视频教程链接

### 质量检查

- [ ] 语法正确
- [ ] 格式一致
- [ ] 链接有效
- [ ] 代码可运行
- [ ] 截图清晰

## 🎯 最佳实践

### 写作风格

1. **简洁明了** - 避免冗长的句子
2. **使用列表** - 提高可读性
3. **代码示例** - 提供实际可运行的代码
4. **视觉辅助** - 使用表格、图表、emoji
5. **链接相关** - 链接到相关文档

### 组织结构

1. **逻辑分组** - 相关内容放在一起
2. **层级清晰** - 使用标题层级
3. **索引完整** - 每个目录都有 README.md
4. **交叉引用** - 文档之间相互链接

### 维护原则

1. **及时更新** - 代码变更后立即更新文档
2. **定期审查** - 每季度审查一次
3. **删除过时** - 不保留过时的文档
4. **保持简洁** - 避免文档膨胀

## 📞 获取帮助

- 查看 [文档导航](README.md)
- 参考 [项目指南](../.kiro/steering/project-guide.md)
- 联系文档维护者

---

**最后更新**: 2024-12-22  
**维护者**: 开发团队
