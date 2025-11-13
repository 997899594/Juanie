# GitOps 使用流程

## 正确的使用流程

### 1. 系统准备（一次性）

**位置：设置 → GitOps**

- 安装 Flux v2 到 Kubernetes 集群
- 检查 Flux 组件健康状态

### 2. 项目配置

#### 2.1 创建项目
**位置：项目管理 → 新建项目**

#### 2.2 连接代码仓库
**位置：项目详情 → 仓库标签**

- 连接 GitHub/GitLab 仓库
- 配置访问令牌
- 设置默认分支

#### 2.3 创建环境
**位置：项目详情 → 环境标签**

- 创建开发/测试/生产环境
- 配置环境参数

#### 2.4 启用 GitOps（可选）
**位置：项目详情 → 环境标签 → 环境配置**

为每个环境配置 GitOps：
- 启用 GitOps
- 设置 Git 分支（如 main, develop）
- 设置配置路径（如 k8s/overlays/production）
- 配置同步间隔
- 启用/禁用自动同步

### 3. 部署应用

#### 方式 1：GitOps 部署（推荐）
**位置：项目详情 → 部署标签 → GitOps 部署**

1. 选择环境
2. 填写部署配置：
   - 容器镜像
   - 副本数
   - 环境变量
   - 资源限制
3. 预览 YAML 和变更
4. 输入 Commit 消息
5. 提交部署

**流程：**
```
UI 表单 → 生成 YAML → Git Commit → Git Push → Flux 检测 → 自动部署
```

#### 方式 2：Git Push 部署
**位置：本地 Git 仓库**

1. 修改 k8s 配置文件
2. Git commit & push
3. Flux 自动检测并部署

**流程：**
```
修改 YAML → Git Push → Flux 检测 → 自动部署
```

#### 方式 3：传统部署
**位置：项目详情 → 部署标签 → 新建部署**

手动触发部署（不使用 GitOps）

### 4. 查看 GitOps 资源

**位置：项目详情 → GitOps 标签**

或

**位置：GitOps 资源（全局）**

查看和管理：
- Kustomization 资源
- HelmRelease 资源
- 同步状态
- 错误信息

### 5. 监控部署

**位置：项目详情 → 部署标签**

查看：
- 部署历史
- 部署状态
- Git Commit 信息
- 部署方式（GitOps UI / GitOps Git / 手动）

## 关键概念

### GitOps 资源类型

1. **Kustomization**
   - 用于管理 Kubernetes 原生 YAML
   - 支持 Kustomize 覆盖和补丁

2. **HelmRelease**
   - 用于管理 Helm Chart
   - 支持 values 配置

### 部署方式标识

- `manual` - 手动部署
- `gitops-ui` - 通过 UI 触发的 GitOps 部署
- `gitops-git` - 通过 Git Push 触发的 GitOps 部署
- `pipeline` - 通过 CI/CD Pipeline 部署

### 环境配置

每个环境可以独立配置：
- 是否启用 GitOps
- Git 分支（不同环境使用不同分支）
- 配置路径（不同环境使用不同目录）
- 同步间隔
- 自动同步开关

## 最佳实践

### 1. 环境分离

```
开发环境:
  - 分支: develop
  - 路径: k8s/overlays/development
  - 自动同步: 启用
  - 同步间隔: 1m

生产环境:
  - 分支: main
  - 路径: k8s/overlays/production
  - 自动同步: 禁用（手动触发）
  - 同步间隔: 10m
```

### 2. Git 仓库结构

```
my-app/
├── k8s/
│   ├── base/                    # 基础配置
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   └── kustomization.yaml
│   └── overlays/                # 环境覆盖
│       ├── development/
│       │   ├── deployment.yaml
│       │   └── kustomization.yaml
│       ├── staging/
│       │   ├── deployment.yaml
│       │   └── kustomization.yaml
│       └── production/
│           ├── deployment.yaml
│           └── kustomization.yaml
└── src/                         # 应用代码
```

### 3. 部署策略

**开发环境：**
- 使用 GitOps UI 快速部署
- 启用自动同步
- 频繁更新

**生产环境：**
- 使用 Git Push 部署（代码审查）
- 禁用自动同步（手动触发）
- 需要审批流程

## 故障排查

### Flux 未检测到变更

1. 检查 Flux 组件状态（设置 → GitOps）
2. 检查 Git 仓库连接（项目 → 仓库）
3. 手动触发同步（GitOps 资源 → 手动同步）

### 部署失败

1. 查看部署详情中的错误信息
2. 检查 YAML 语法
3. 检查镜像是否存在
4. 检查资源配额

### Git 认证失败

1. 检查访问令牌是否有效
2. 检查令牌权限（需要读取仓库权限）
3. 重新连接仓库
