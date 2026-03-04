# CI/CD 集成设计

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为创建和关联的项目自动配置 CI/CD 流水线，实现代码推送后自动构建镜像并部署。

**Architecture:**
- CI 只负责构建和推送镜像（GitHub Actions / GitLab CI）
- 镜像仓库（GHCR / Docker Hub）推送完成后通过 Webhook 通知 Juanie
- Juanie 接收通知后触发 K8s 部署

**Tech Stack:**
- CI: GitHub Actions, GitLab CI
- 构建: Docker (有 Dockerfile) / Cloud Native Buildpacks (无 Dockerfile)
- 镜像仓库: GHCR (GitHub), GitLab Registry (GitLab)
- 触发: 镜像仓库 Webhook

---

## 1. 整体流程

### 创建项目流程
```
1. create_repository        → 在 Git 平台创建仓库
2. push_template            → 推送模板代码 + CI 配置 + .env.juanie.example
3. setup_webhook            → 配置 Git webhook（push 事件）
4. setup_registry_webhook   → 配置镜像仓库 webhook（package/registry 事件）
5. setup_namespace          → 创建 K8s namespace
6. deploy_services          → 部署服务
7. provision_databases      → 创建数据库
8. configure_dns            → 配置域名
```

### 关联项目流程
```
1. validate_repository      → 验证仓库权限
2. push_cicd_config         → 推送 CI 配置 + .env.juanie.example（如果没有）
3. setup_webhook            → 配置 Git webhook
4. setup_registry_webhook   → 配置镜像仓库 webhook
5. setup_namespace          → 创建 K8s namespace
6. deploy_services          → 部署服务
7. provision_databases      → 创建数据库
8. configure_dns            → 配置域名
```

---

## 2. CI Workflow 配置

### 2.1 GitHub Actions

文件路径：`.github/workflows/juanie-ci.yml`

```yaml
name: Juanie CI

on:
  push:
    branches: [main, master]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and Push
        run: |
          IMAGE_TAG=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:sha-${{ github.sha }}

          if [ -f Dockerfile ]; then
            # 使用 Dockerfile 构建
            docker buildx build --push \
              --tag $IMAGE_TAG \
              --cache-from type=gha \
              --cache-to type=gha,mode=max \
              .
          else
            # 使用 Buildpacks 构建（自动检测语言）
            docker run --rm \
              -v /var/run/docker.sock:/var/run/docker.sock \
              -v $PWD:/workspace \
              -w /workspace \
              paketobuildpacks/builder-jammy-full \
              pack build $IMAGE_TAG --builder paketobuildpacks/builder-jammy-full
          fi
```

### 2.2 GitLab CI

文件路径：`.gitlab-ci.yml`

```yaml
stages:
  - build

variables:
  REGISTRY: $CI_REGISTRY
  IMAGE_TAG: $CI_REGISTRY_IMAGE:sha-$CI_COMMIT_SHA

build:
  stage: build
  image: docker:24
  services:
    - docker:24-dind
  before_script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
  script:
    - |
      if [ -f Dockerfile ]; then
        docker build -t $IMAGE_TAG .
        docker push $IMAGE_TAG
      else
        docker run --rm \
          -v /var/run/docker.sock:/var/run/docker.sock \
          -v $PWD:/workspace \
          -w /workspace \
          paketobuildpacks/builder-jammy-full \
          pack build $IMAGE_TAG --builder paketobuildpacks/builder-jammy-full
      fi
```

---

## 3. 镜像仓库 Webhook 配置

### 3.1 GitHub Packages Webhook

通过 GitHub API 自动配置组织级 webhook：

```typescript
// 配置 GHCR package webhook
async function setupGitHubPackageWebhook(
  accessToken: string,
  owner: string,
  projectId: string,
  webhookSecret: string
) {
  const webhookUrl = `https://juanie.art/api/webhooks/registry?project_id=${projectId}`;

  // GitHub 组织 webhook API
  const response = await fetch(`https://api.github.com/orgs/${owner}/hooks`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'web',
      active: true,
      events: ['package'],
      config: {
        url: webhookUrl,
        content_type: 'json',
        secret: webhookSecret,
      },
    }),
  });

  return response.json();
}
```

### 3.2 GitLab Registry Webhook

GitLab project webhook 支持 registry 事件：

```typescript
async function setupGitLabRegistryWebhook(
  accessToken: string,
  projectId: number,
  juanieProjectId: string,
  webhookSecret: string
) {
  const webhookUrl = `https://juanie.art/api/webhooks/registry?project_id=${juanieProjectId}`;

  const response = await fetch(
    `https://gitlab.com/api/v4/projects/${projectId}/hooks`,
    {
      method: 'POST',
      headers: {
        'PRIVATE-TOKEN': accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: webhookUrl,
        token: webhookSecret,
        push_events: false,
        tag_push_events: false,
        pipeline_events: false,
        job_events: false,
        deployment_events: false,
        releases_events: false,
        container_registry_events: true, // 镜像推送事件
      }),
    }
  );

  return response.json();
}
```

---

## 4. Webhook 接收端

### 4.1 新增 API 路由

文件：`src/app/api/webhooks/registry/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { projects, webhooks } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { addDeploymentJob } from '@/lib/queue';

export async function POST(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get('project_id');

  if (!projectId) {
    return NextResponse.json({ error: 'Missing project_id' }, { status: 400 });
  }

  // 1. 获取项目的 webhook 配置
  const webhook = await db.query.webhooks.findFirst({
    where: eq(webhooks.projectId, projectId),
  });

  if (!webhook?.secret) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 404 });
  }

  // 2. 验证签名
  const payload = await request.text();
  const signature = request.headers.get('x-hub-signature-256');

  if (!verifySignature(payload, signature, webhook.secret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // 3. 解析镜像信息
  const data = JSON.parse(payload);
  const imageName = extractImageName(data); // 从 payload 提取

  // 4. 验证镜像名匹配
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });

  if (!project || !imageMatchesProject(imageName, project)) {
    return NextResponse.json({ error: 'Image mismatch' }, { status: 403 });
  }

  // 5. 触发部署
  await addDeploymentJob({
    projectId,
    image: imageName,
    triggeredBy: 'registry-webhook',
  });

  return NextResponse.json({ success: true });
}
```

### 4.2 签名验证

```typescript
import { createHmac } from 'crypto';

function verifySignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) return false;

  const expectedSignature = `sha256=${createHmac('sha256', secret)
    .update(payload)
    .digest('hex')}`;

  return signature === expectedSignature;
}
```

---

## 5. 环境变量配置推送

### 5.1 模板文件

文件：推送到用户仓库的 `.env.juanie.example`

```env
# ===========================================
# Juanie 环境变量模板
# ===========================================
# 复制此文件为 .env 并填入实际值
# 真实值可在 Juanie 控制台 → 项目 → 环境变量 中查看

# 项目信息
PROJECT_NAME={{PROJECT_NAME}}
PROJECT_SLUG={{PROJECT_SLUG}}

# -------------------------------------------
# PostgreSQL（如果项目配置了 PostgreSQL）
# -------------------------------------------
DATABASE_URL=postgresql://postgres:<密码>@{{PROJECT_SLUG}}-postgres.juanie-{{PROJECT_SLUG}}.svc.cluster.local:5432/main
POSTGRES_HOST={{PROJECT_SLUG}}-postgres.juanie-{{PROJECT_SLUG}}.svc.cluster.local
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<在 Juanie 控制台查看>
POSTGRES_DB=main

# -------------------------------------------
# Redis（如果项目配置了 Redis）
# -------------------------------------------
REDIS_URL=redis://:<密码>@{{PROJECT_SLUG}}-redis.juanie-{{PROJECT_SLUG}}.svc.cluster.local:6379
REDIS_HOST={{PROJECT_SLUG}}-redis.juanie-{{PROJECT_SLUG}}.svc.cluster.local
REDIS_PORT=6379
REDIS_PASSWORD=<在 Juanie 控制台查看>
```

### 5.2 推送逻辑

在 `push_cicd_config` 步骤中：

```typescript
async function pushCicdConfig(project: Project) {
  const { provider, client } = await getTeamGitProvider(project.teamId);

  // 1. 检测是否已有 CI 配置
  const hasGitHubCI = await client.fileExists(repo, '.github/workflows/juanie-ci.yml');
  const hasGitLabCI = await client.fileExists(repo, '.gitlab-ci.yml');

  // 2. 根据平台推送对应 CI 配置
  const files: Record<string, string> = {};

  if (!hasGitHubCI && provider.type === 'github') {
    files['.github/workflows/juanie-ci.yml'] = renderGitHubCI(project);
  }

  if (!hasGitLabCI && provider.type === 'gitlab') {
    files['.gitlab-ci.yml'] = renderGitLabCI(project);
  }

  // 3. 推送环境变量模板
  files['.env.juanie.example'] = renderEnvTemplate(project);

  // 4. 如果没有 Dockerfile，推送说明文档
  const hasDockerfile = await client.fileExists(repo, 'Dockerfile');
  if (!hasDockerfile) {
    files['BUILDPACKS.md'] = `# 使用 Buildpacks 构建
本项目没有 Dockerfile，将使用 Cloud Native Buildpacks 自动构建。
支持的语言：Node.js, Python, Go, Java, Ruby, PHP 等。

## 本地测试构建
\`\`\`bash
pack build myapp --builder paketobuildpacks/builder-jammy-full
\`\`\`
`;
  }

  // 5. 提交推送
  if (Object.keys(files).length > 0) {
    await client.pushFiles(provider.accessToken, {
      repoFullName: project.repository.fullName,
      branch: project.productionBranch || 'main',
      files,
      message: 'Configure Juanie CI/CD',
    });
  }
}
```

---

## 6. 镜像名规则

项目与镜像的对应关系：

| Git Provider | 镜像仓库 | 镜像名格式 |
|--------------|----------|------------|
| GitHub | GHCR | `ghcr.io/{owner}/{repo}:sha-{commit}` |
| GitLab | GitLab Registry | `registry.gitlab.com/{owner}/{repo}:sha-{commit}` |
| 自托管 | 自定义 | `{registry}/{team}/{project}:sha-{commit}` |

存储在 `projects` 表的 `configJson` 字段：

```typescript
{
  "imageName": "ghcr.io/myorg/myproject",
  "imageRegistry": "ghcr.io",
  "buildType": "dockerfile" | "buildpacks"
}
```

---

## 7. 数据库变更

### 7.1 新增字段

```sql
-- webhooks 表添加 registry 类型支持
ALTER TABLE "webhook" ADD COLUMN IF NOT EXISTS "type" TEXT DEFAULT 'git-push';
-- type: 'git-push' | 'registry'

-- webhooks 表添加外部 webhook ID（用于删除/更新）
ALTER TABLE "webhook" ADD COLUMN IF NOT EXISTS "externalRegistryHookId" TEXT;
```

### 7.2 projects 表扩展

```typescript
// configJson 字段扩展
{
  "imageName": "ghcr.io/org/repo",
  "imageRegistry": "ghcr.io",
  "buildType": "dockerfile" | "buildpacks",
  "registryWebhookConfigured": true
}
```

---

## 8. 错误处理

| 场景 | 处理方式 |
|------|----------|
| 镜像仓库不支持 API 配置 webhook | 标记为手动配置，在 UI 显示配置指南 |
| Webhook 签名验证失败 | 返回 401，记录日志 |
| 镜像名不匹配项目 | 返回 403，拒绝部署 |
| CI 文件已存在 | 跳过推送，不覆盖用户配置 |

---

## 9. 文件清单

### 新增文件
- `src/app/api/webhooks/registry/route.ts` - Registry webhook 接收端
- `templates/ci/github-actions.yml` - GitHub Actions 模板
- `templates/ci/gitlab-ci.yml` - GitLab CI 模板
- `templates/env/.env.juanie.example` - 环境变量模板

### 修改文件
- `src/lib/queue/project-init.ts` - 添加 `push_cicd_config` 和 `setup_registry_webhook` 步骤
- `src/lib/db/schema.ts` - webhooks 表添加字段
- `src/lib/git/index.ts` - 添加 webhook 配置方法

---

## 10. 安全考虑

1. **Webhook Secret** - 每个项目唯一，256 位随机
2. **签名验证** - 所有 webhook 请求必须验证签名
3. **镜像名白名单** - 只接受已注册项目的镜像
4. **最小权限** - CI 只需 packages:write，不需要其他权限
5. **敏感信息** - 数据库密码不在仓库中存储，仅通过 K8s Secret 注入
