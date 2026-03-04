# Monorepo 支持设计

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 支持 Monorepo 项目的多服务构建和增量部署，**Architecture:** 基于 Turborepo 原生集成，**Tech Stack:** Turborepo, GitHub Actions, GitLab CI, Container Registry

---

## 1. 整体架构

```
用户推送代码
    ↓
GitHub/GitLab Webhook → Juanie
    ↓
Juanie 分析变更：
  1. 读取 turbo.json 获取依赖图
  2. 计算受影响的服务
    ↓
生成多个部署任务（每个受影响服务一个）
    ↓
并行部署到 K8s
```

---

## 2. 数据模型扩展

### 2.1 Service 表 configJson 扩展

```typescript
// Service 表 configJson 字段扩展
{
  // Monorepo 配置
  "monorepo": {
    "appDir": "apps/web",           // 应用目录
    "package": "@myorg/web",         // package.json 中的包名
    "dockerfile": "apps/web/Dockerfile",
    "dockerContext": "."
  }
}
```

### 2.2 Project 表 configJson 扩展

```typescript
{
  "monorepo": {
    "type": "turborepo",            // turborepo | nx | pnpm | none
    "rootPath": ".",                 // monorepo 根目录
    "lockFile": "pnpm-lock.yaml"    // 锁文件类型
  }
}
```

---

## 3. CI 模板设计（Monorepo 版本）

### 3.1 GitHub Actions

文件路径：`templates/ci/github-actions-monorepo.yml`

```yaml
name: Juanie CI

on:
  push:
    branches: [main, master]

env:
  REGISTRY: ghcr.io

jobs:
  detect:
    runs-on: ubuntu-latest
    outputs:
      services: ${{ steps.detect.outputs.services }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # 需要 git history

      - uses: oven-sh/setup-bun@v1

      - name: Setup Turborepo
        run: bun add -g turbo

      - name: Detect affected services
        id: detect
        run: |
          # 获取变更的服务，输出 JSON 数组
          AFFECTED=$(turbo ls --filter="...[origin/main^1]" --json 2>/dev/null || echo '[]')
          echo "services=$AFFECTED" >> $GITHUB_OUTPUT

  build:
    needs: detect
    if: ${{ needs.detect.outputs.services != '[]' }}
    strategy:
      matrix:
        service: ${{ fromJson(needs.detect.outputs.services) }}
    runs-on: ubuntu-latest
    permissions:
      packages: write
    steps:
      - uses: actions/checkout@v4

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push ${{ matrix.service }}
        run: |
          IMAGE_TAG=${{ env.REGISTRY }}/${{ github.repository }}/${{ matrix.service }}:sha-${{ github.sha }}

          # 使用服务配置的 Dockerfile 或 Buildpacks
          bun run scripts/build-service.ts ${{ matrix.service }} $IMAGE_TAG
          docker push $IMAGE_TAG
```

### 3.2 GitLab CI

文件路径：`templates/ci/gitlab-ci-monorepo.yml`

```yaml
stages:
  - detect
  - build

variables:
  REGISTRY: $CI_REGISTRY

detect:
  stage: detect
  image: oven/bun:1
  script:
    - bun add -g turbo
    - AFFECTED=$(turbo ls --filter="...[$CI_COMMIT_BEFORE_SHA]" --json 2>/dev/null || echo '[]')
    - echo "SERVICES=$AFFECTED" >> build.env
  artifacts:
    reports:
      dotenv: build.env

build:
  stage: build
  image: docker:24
  services:
    - docker:24-dind
  before_script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
  script:
    - |
      for SERVICE in $(echo $SERVICES | jq -r '.[]'); do
        IMAGE_TAG=$CI_REGISTRY_IMAGE/$SERVICE:sha-$CI_COMMIT_SHA
        docker build -t $IMAGE_TAG -f apps/$SERVICE/Dockerfile .
        docker push $IMAGE_TAG
      done
  rules:
    - if: $SERVICES != '[]'
```

---

## 4. Juanie 端处理

### 4.1 Git Push Webhook 处理

文件路径：`src/app/api/webhooks/git/route.ts` (修改)

```typescript
async function handleMonorepoPush(payload: GitPushPayload, project: Project) {
  const monorepoConfig = project.configJson?.monorepo;

  if (!monorepoConfig || monorepoConfig.type === 'none') {
    // 非 monorepo，走原有单服务流程
    return handleSingleServicePush(payload, project);
  }

  // 1. 获取项目所有服务
  const projectServices = await db.query.services.findMany({
    where: eq(services.projectId, project.id),
  });

  // 2. 调用 Git API 获取变更文件列表
  const changedFiles = await getChangedFiles(payload);

  // 3. 匹配变更文件到受影响的服务
  const affectedServices = projectServices.filter(service => {
    const appDir = service.configJson?.monorepo?.appDir;
    return appDir && isPathAffected(changedFiles, appDir);
  });

  // 4. 为每个受影响服务创建部署任务
  for (const service of affectedServices) {
    await addDeploymentJob({
      projectId: project.id,
      serviceId: service.id,
      image: buildImageName(project, service),
      triggeredBy: 'git-push',
    });
  }
}

function isPathAffected(changedFiles: string[], appDir: string): boolean {
  return changedFiles.some(file =>
    file.startsWith(appDir + '/') ||
    file.startsWith('packages/')  // 共享包变更影响所有服务
  );
}

function buildImageName(project: Project, service: Service): string {
  const repo = project.repository?.fullName || '';
  const serviceName = service.name;
  const registry = project.configJson?.imageRegistry || 'ghcr.io';
  return `${registry}/${repo}/${serviceName}`;
}
```

---

## 5. Registry Webhook 处理（多服务）

### 5.1 镜像命名规范

```
{registry}/{owner}/{repo}/{service}:sha-{commit}
```

例如：
- `ghcr.io/myorg/monorepo/web:sha-abc123`
- `ghcr.io/myorg/monorepo/api:sha-abc123`
- `ghcr.io/myorg/monorepo/worker:sha-abc123`

### 5.2 镜像名解析

```typescript
function parseMultiServiceImageName(fullName: string): { name: string; tag: string; service: string; projectName: string } {
  const [name, tag] = fullName.split(':');

  // 提取服务名（最后一个路径段）
  const parts = name.split('/');
  const service = parts[parts.length - 1];

  // 项目镜像名（去掉服务名）
  const projectName = parts.slice(0, -1).join('/');

  return {
    name: fullName,
    tag,
    service,
    projectName,  // 用于匹配项目
  };
}
```

### 5.3 匹配逻辑

```typescript
// 在 Registry Webhook 处理中
const imageInfo = parseMultiServiceImageName(imageName);

// 通过 imageName 前缀匹配项目
const project = await db.query.projects.findFirst({
  where: sql`config_json->>'imageName' = ${imageInfo.projectName}`,
});

// 通过服务名匹配具体服务
const service = await db.query.services.findFirst({
  where: and(
    eq(services.projectId, project.id),
    eq(services.name, imageInfo.service),
  ),
});
```

---

## 6. 非 Turborepo 项目的回退方案

### 6.1 检测逻辑

```typescript
function detectMonorepoType(files: string[]): 'turborepo' | 'nx' | 'pnpm' | 'none' {
  // 1. 检查 turbo.json
  if (files.includes('turbo.json')) return 'turborepo';

  // 2. 检查 pnpm-workspace.yaml
  if (files.includes('pnpm-workspace.yaml')) return 'pnpm';

  // 3. 检查 nx.json / lerna.json
  if (files.includes('nx.json') || files.includes('lerna.json')) return 'nx';

  // 4. 检查目录结构
  if (files.some(f => f.startsWith('packages/') || f.startsWith('apps/'))) return 'pnpm';

  return 'none';
}
```

### 6.2 回退策略

| 检测结果 | 构建方式 | 变更检测 |
|----------|----------|----------|
| `turborepo` | `turbo run build --filter` | Turborepo 依赖图 |
| `pnpm` | `pnpm -r --filter` | 读取 package.json 依赖 |
| `nx` | `nx affected -t build` | Nx 依赖图 |
| `none` | 单服务构建 | 全量部署 |

---

## 7. 文件清单

### 新增文件
- `templates/ci/github-actions-monorepo.yml` - GitHub Actions Monorepo 模板
- `templates/ci/gitlab-ci-monorepo.yml` - GitLab CI Monorepo 模板
- `src/lib/monorepo/detect.ts` - Monorepo 类型检测
- `src/lib/monorepo/affected.ts` - 受影响服务计算

### 修改文件
- `src/app/api/webhooks/git/route.ts` - 支持 Monorepo 变更检测
- `src/app/api/webhooks/registry/route.ts` - 支持多服务镜像解析
- `src/lib/queue/project-init.ts` - Monorepo 项目初始化
- `src/lib/db/schema.ts` - Service/Project configJson 类型扩展

---

## 8. 使用示例

### 8.1 创建 Monorepo 项目

```json
POST /api/projects
{
  "name": "My Monorepo",
  "slug": "my-monorepo",
  "teamId": "xxx",
  "mode": "import",
  "monorepo": {
    "type": "turborepo"
  },
  "services": [
    {
      "name": "web",
      "type": "web",
      "monorepo": {
        "appDir": "apps/web",
        "package": "@myorg/web",
        "dockerfile": "apps/web/Dockerfile"
      },
      "port": 3000
    },
    {
      "name": "api",
      "type": "web",
      "monorepo": {
        "appDir": "apps/api",
        "package": "@myorg/api"
      },
      "port": 4000
    },
    {
      "name": "worker",
      "type": "worker",
      "monorepo": {
        "appDir": "apps/worker",
        "package": "@myorg/worker"
      }
    }
  ]
}
```

### 8.2 部署流程

```
1. 开发者修改 apps/api/src/user.ts
2. 推送到 GitHub
3. CI: turbo ls --filter 检测到 api 服务受影响
4. CI: 构建并推送 ghcr.io/myorg/monorepo/api:sha-abc123
5. Registry Webhook 触发 Juanie
6. Juanie: 解析镜像名，匹配到 api 服务
7. Juanie: 创建 api 服务的部署任务
```

---

## 9. 安全考虑

1. **镜像名验证** - 严格验证镜像名格式，防止注入攻击
2. **服务隔离** - 每个服务独立的 K8s Deployment，资源隔离
3. **权限控制** - 服务部署需要项目级别的权限验证
