# @juanie/service-templates

模板生成服务包，提供Dockerfile和CI/CD配置文件生成功能。

## 功能

- 生成Dockerfile（支持Node.js、Python、Bun）
- 生成CI/CD配置（GitHub Actions、GitLab CI）
- 提供常用框架预设配置
- 支持自定义配置

## 支持的运行时

### Node.js
- Express
- NestJS
- Fastify

### Python
- Django
- Flask
- FastAPI

### Bun
- 通用Bun应用

## 使用

```typescript
import { TemplatesModule, TemplatesService } from '@juanie/service-templates'

// 在模块中导入
@Module({
  imports: [TemplatesModule],
})
export class AppModule {}

// 使用服务
@Injectable()
export class MyService {
  constructor(private templates: TemplatesService) {}

  async generateDockerfile() {
    // 使用预设
    const preset = this.templates.getNodeJSPreset('nestjs')
    
    // 生成Dockerfile
    const dockerfile = await this.templates.generateDockerfile({
      ...preset,
      runtime: 'nodejs',
      version: '20',
      port: 3000,
      startCommand: 'node dist/main.js',
    })
    
    return dockerfile
  }

  async generateCICD() {
    const cicd = await this.templates.generateCICD({
      platform: 'github',
      runtime: 'nodejs',
      version: '20',
      installCommand: 'npm ci',
      hasTests: true,
      testCommand: 'npm test',
      deployBranch: 'main',
      environment: 'production',
      environmentUrl: 'https://example.com',
      deployScript: 'npm run deploy',
    })
    
    return cicd
  }
}
```

## 预设配置

```typescript
// Node.js预设
const nestjsPreset = templatesService.getNodeJSPreset('nestjs')
const expressPreset = templatesService.getNodeJSPreset('express')

// Python预设
const djangoPreset = templatesService.getPythonPreset('django')
const flaskPreset = templatesService.getPythonPreset('flask')

// Bun预设
const bunPreset = templatesService.getBunPreset()
```

## 依赖

- `@juanie/core-observability` - 可观测性追踪
- `handlebars` - 模板引擎
