# CI/CD 模板使用指南

本平台提供了完整的 CI/CD 模板生成功能，支持 GitHub Actions 和 GitLab CI/CD。

## 功能概述

### 1. Dockerfile 生成
支持为以下运行时生成优化的 Dockerfile：
- **Node.js** (支持 npm, yarn, pnpm)
- **Python** (支持 pip)
- **Bun** (高性能 JavaScript 运行时)

### 2. CI/CD 配置生成
- **GitHub Actions** - 生成 `.github/workflows/ci.yml`
- **GitLab CI/CD** - 生成 `.gitlab-ci.yml`

## API 使用

### 生成 Dockerfile

```typescript
// tRPC 调用示例
const result = await trpc.templates.generateDockerfile.mutate({
  runtime: 'nodejs',
  version: '20',
  port: 3000,
  packageManager: 'npm',
  hasBuildStep: true,
  buildCommand: 'npm run build',
  buildOutput: 'dist',
  startCommand: 'node dist/main.js',
  healthCheck: true,
  healthCheckPath: '/health',
});

console.log(result.dockerfile);
```

### 生成 CI/CD 配置

```typescript
// GitHub Actions
const result = await trpc.templates.generateCICD.mutate({
  platform: 'github',
  runtime: 'nodejs',
  version: '20',
  packageManager: 'npm',
  installCommand: 'npm ci',
  hasLinter: true,
  lintCommand: 'npm run lint',
  hasTypeCheck: true,
  typeCheckCommand: 'npm run type-check',
  hasTests: true,
  testCommand: 'npm test',
  hasCoverage: true,
  coverageFile: './coverage/coverage-final.json',
  deployBranch: 'main',
  environment: 'production',
  environmentUrl: 'https://app.example.com',
  deployScript: 'docker-compose up -d',
  registry: 'docker.io',
  imageName: 'myorg/myapp',
});

console.log(result.cicd);
```

### 使用预设配置

```typescript
// 获取 NestJS 预设
const preset = await trpc.templates.getPreset.query({
  type: 'nodejs',
  framework: 'nestjs',
});

// 使用预设生成 Dockerfile
const dockerfile = await trpc.templates.generateDockerfile.mutate({
  ...preset.preset,
  // 覆盖特定配置
  port: 4000,
});
```

## 预设配置

### Node.js 框架

#### NestJS
```typescript
{
  runtime: 'nodejs',
  version: '20',
  port: 3000,
  packageManager: 'npm',
  hasBuildStep: true,
  buildCommand: 'npm run build',
  buildOutput: 'dist',
  startCommand: 'node dist/main.js',
  healthCheck: true,
  healthCheckPath: '/health',
}
```

#### Express
```typescript
{
  runtime: 'nodejs',
  version: '20',
  port: 3000,
  packageManager: 'npm',
  startCommand: 'node index.js',
  healthCheck: true,
  healthCheckPath: '/health',
}
```

#### Fastify
```typescript
{
  runtime: 'nodejs',
  version: '20',
  port: 3000,
  packageManager: 'npm',
  startCommand: 'node server.js',
  healthCheck: true,
  healthCheckPath: '/health',
}
```

### Python 框架

#### Django
```typescript
{
  runtime: 'python',
  version: '3.11',
  port: 8000,
  startCommand: 'gunicorn myproject.wsgi:application --bind 0.0.0.0:8000',
  healthCheck: true,
  healthCheckPath: '/health',
}
```

#### Flask
```typescript
{
  runtime: 'python',
  version: '3.11',
  port: 5000,
  startCommand: 'gunicorn app:app --bind 0.0.0.0:5000',
  healthCheck: true,
  healthCheckPath: '/health',
}
```

#### FastAPI
```typescript
{
  runtime: 'python',
  version: '3.11',
  port: 8000,
  startCommand: 'uvicorn main:app --host 0.0.0.0 --port 8000',
  healthCheck: true,
  healthCheckPath: '/health',
}
```

### Bun
```typescript
{
  runtime: 'bun',
  version: '1.1',
  port: 3000,
  hasBuildStep: true,
  buildCommand: 'bun run build',
  buildOutput: 'dist',
  startCommand: 'bun run start:prod',
  healthCheck: true,
  healthCheckPath: '/health',
}
```

## 完整示例

### 1. 为 NestJS 项目生成完整 CI/CD

```typescript
// 1. 生成 Dockerfile
const dockerfileResult = await trpc.templates.generateDockerfile.mutate({
  runtime: 'nodejs',
  version: '20',
  port: 3000,
  packageManager: 'npm',
  hasBuildStep: true,
  buildCommand: 'npm run build',
  buildOutput: 'dist',
  startCommand: 'node dist/main.js',
  healthCheck: true,
  healthCheckPath: '/health',
});

// 保存 Dockerfile
await fs.writeFile('Dockerfile', dockerfileResult.dockerfile);

// 2. 生成 GitHub Actions
const cicdResult = await trpc.templates.generateCICD.mutate({
  platform: 'github',
  runtime: 'nodejs',
  version: '20',
  packageManager: 'npm',
  installCommand: 'npm ci',
  hasLinter: true,
  lintCommand: 'npm run lint',
  hasTypeCheck: true,
  typeCheckCommand: 'npm run type-check',
  hasTests: true,
  testCommand: 'npm test',
  hasCoverage: true,
  coverageFile: './coverage/coverage-final.json',
  testEnvVars: {
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-secret',
  },
  services: ['postgres:17-alpine', 'redis:7-alpine'],
  deployBranch: 'main',
  environment: 'production',
  environmentUrl: 'https://api.example.com',
  deployScript: 'cd /opt/app && docker-compose pull && docker-compose up -d',
  registry: 'docker.io',
  imageName: 'myorg/api',
});

// 保存 CI/CD 配置
await fs.writeFile('.github/workflows/ci.yml', cicdResult.cicd);
```

### 2. 为 Python FastAPI 项目生成配置

```typescript
// 使用预设
const preset = await trpc.templates.getPreset.query({
  type: 'python',
  framework: 'fastapi',
});

// 生成 Dockerfile
const dockerfile = await trpc.templates.generateDockerfile.mutate(preset.preset);

// 生成 GitLab CI
const cicd = await trpc.templates.generateCICD.mutate({
  platform: 'gitlab',
  runtime: 'python',
  version: '3.11',
  installCommand: 'pip install -r requirements.txt',
  hasLinter: true,
  lintCommand: 'flake8 .',
  hasTests: true,
  testCommand: 'pytest',
  hasCoverage: true,
  coverageFile: 'coverage.xml',
  coverageRegex: 'TOTAL.*\\s+(\\d+)%',
  testEnvVars: {
    DATABASE_URL: 'postgresql://test:test@postgres:5432/test',
  },
  services: ['postgres:17-alpine'],
  deployBranch: 'main',
  environment: 'production',
  environmentUrl: 'https://api.example.com',
  deployScript: 'docker-compose up -d',
});
```

## 模板变量说明

### Dockerfile 变量

| 变量 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `runtime` | string | ✅ | 运行时：nodejs, python, bun |
| `version` | string | ✅ | 版本号 |
| `port` | number | ✅ | 应用端口 |
| `packageManager` | string | ❌ | 包管理器：npm, yarn, pnpm |
| `hasBuildStep` | boolean | ❌ | 是否需要构建步骤 |
| `buildCommand` | string | ❌ | 构建命令 |
| `buildOutput` | string | ❌ | 构建输出目录 |
| `startCommand` | string | ✅ | 启动命令 |
| `healthCheck` | boolean | ❌ | 是否添加健康检查 |
| `healthCheckPath` | string | ❌ | 健康检查路径 |

### CI/CD 变量

| 变量 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `platform` | string | ✅ | 平台：github, gitlab |
| `runtime` | string | ✅ | 运行时 |
| `version` | string | ✅ | 版本号 |
| `installCommand` | string | ✅ | 安装依赖命令 |
| `hasLinter` | boolean | ❌ | 是否运行 linter |
| `lintCommand` | string | ❌ | Lint 命令 |
| `hasTypeCheck` | boolean | ❌ | 是否类型检查 |
| `typeCheckCommand` | string | ❌ | 类型检查命令 |
| `hasTests` | boolean | ❌ | 是否运行测试 |
| `testCommand` | string | ❌ | 测试命令 |
| `hasCoverage` | boolean | ❌ | 是否生成覆盖率 |
| `coverageFile` | string | ❌ | 覆盖率文件路径 |
| `testEnvVars` | object | ❌ | 测试环境变量 |
| `services` | array | ❌ | 依赖服务 |
| `deployBranch` | string | ✅ | 部署分支 |
| `environment` | string | ✅ | 环境名称 |
| `environmentUrl` | string | ✅ | 环境 URL |
| `deployScript` | string | ✅ | 部署脚本 |
| `registry` | string | ❌ | 镜像仓库 |
| `imageName` | string | ❌ | 镜像名称 |

## 最佳实践

### 1. 多阶段构建
所有生成的 Dockerfile 都使用多阶段构建，减小镜像体积：
- `base` - 基础镜像
- `deps` - 生产依赖
- `builder` - 构建阶段
- `runner` - 运行阶段

### 2. 非 root 用户
所有镜像都创建并使用非 root 用户运行，提高安全性。

### 3. 健康检查
建议启用健康检查，确保容器正常运行。

### 4. 缓存优化
- 先复制依赖文件，再安装依赖
- 利用 Docker 层缓存加速构建

### 5. 环境变量
敏感信息通过环境变量或 secrets 传递，不要硬编码。

## 故障排查

### Dockerfile 构建失败
1. 检查 `buildCommand` 是否正确
2. 确认 `buildOutput` 目录存在
3. 验证依赖文件路径

### CI/CD 测试失败
1. 检查 `testEnvVars` 配置
2. 确认 `services` 正确启动
3. 验证数据库连接

### 部署失败
1. 检查 SSH 密钥配置
2. 确认 `deployScript` 正确
3. 验证服务器权限

## 相关文档

- [Dockerfile 最佳实践](https://docs.docker.com/develop/develop-images/dockerfile_best-practices/)
- [GitHub Actions 文档](https://docs.github.com/en/actions)
- [GitLab CI/CD 文档](https://docs.gitlab.com/ee/ci/)
