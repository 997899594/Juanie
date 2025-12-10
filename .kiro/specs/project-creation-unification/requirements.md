# 项目创建统一化 - 需求文档

## 简介

当前项目创建有两个路径：简单创建和模板初始化创建。这违反了"绝不向后兼容"原则，增加了代码复杂度和维护成本。本需求旨在统一为单一路径。

## 术语表

- **Project**: 项目，系统中的核心实体
- **ProjectOrchestrator**: 项目编排器，负责协调项目初始化流程
- **Template**: 模板，预定义的项目结构和配置
- **Repository**: Git 仓库，存储项目代码
- **Environment**: 环境，如 development、staging、production

## 需求

### 需求 1: 统一项目创建路径

**用户故事:** 作为开发者，我希望项目创建只有一个路径，这样代码更简洁、更易维护。

#### 验收标准

1. THE system SHALL use ProjectOrchestrator for all project creation
2. WHEN a user creates a project without template or repository THEN the system SHALL use ProjectOrchestrator with minimal configuration
3. WHEN a user creates a project with template or repository THEN the system SHALL use ProjectOrchestrator with full configuration
4. THE system SHALL NOT have conditional branching based on template or repository presence

### 需求 2: 简化输入类型

**用户故事:** 作为开发者，我希望只有一个项目创建输入类型，避免类型混乱。

#### 验收标准

1. THE system SHALL use a single input type for project creation
2. THE input type SHALL include optional fields for template and repository
3. THE system SHALL NOT require type guards or type casting
4. THE system SHALL validate input using Zod schema

### 需求 3: 保持功能完整性

**用户故事:** 作为用户，我希望重构后所有功能仍然正常工作。

#### 验收标准

1. WHEN a user creates a simple project THEN the system SHALL create project with basic configuration
2. WHEN a user creates a project with template THEN the system SHALL apply template configuration
3. WHEN a user creates a project with repository THEN the system SHALL connect to repository
4. THE system SHALL automatically add creator as project owner
5. THE system SHALL record audit logs for all creation scenarios

### 需求 4: 删除冗余代码

**用户故事:** 作为开发者，我希望删除所有向后兼容的代码，保持代码库整洁。

#### 验收标准

1. THE system SHALL remove the simple creation path
2. THE system SHALL remove CreateProjectInput type
3. THE system SHALL use only CreateProjectWithTemplateInputType (renamed to CreateProjectInput)
4. THE system SHALL NOT have comments mentioning "向后兼容" or "backward compatibility"

### 需求 5: 更新 API 层

**用户故事:** 作为 API 开发者，我希望 API 路由使用统一的输入类型。

#### 验收标准

1. THE projects router SHALL accept only the unified input type
2. THE router SHALL validate input using the unified Zod schema
3. THE router SHALL NOT perform type conversion or mapping
4. THE router SHALL pass input directly to ProjectsService

### 需求 6: 更新前端

**用户故事:** 作为前端开发者，我希望前端使用统一的创建接口。

#### 验收标准

1. THE ProjectWizard component SHALL use the unified input type
2. THE component SHALL always provide organizationId, name, and slug
3. THE component SHALL optionally provide templateId and repository
4. THE component SHALL NOT have conditional logic for different creation modes
