# Configuration Generator Service

AI-powered configuration file generator for DevOps workflows.

## Overview

The Configuration Generator Service uses AI to generate production-ready configuration files for various DevOps tools and platforms. It supports multiple configuration types and provides optimization suggestions.

## Features

- **Kubernetes Deployment**: Generate production-ready K8s Deployment YAML
- **Dockerfile**: Generate optimized, multi-stage Dockerfiles
- **GitHub Actions**: Generate complete CI/CD workflows
- **GitLab CI**: Generate complete CI/CD pipelines
- **Optimization Suggestions**: AI-powered recommendations for improvements

## Usage

### Generate Kubernetes Deployment

```typescript
import { ConfigGeneratorService } from './config-generator.service'

const result = await configGenerator.generateK8sDeployment({
  appName: 'my-app',
  appType: 'web',
  language: 'typescript',
  framework: 'next.js',
  port: 3000,
  replicas: 3,
  resources: {
    requests: { cpu: '200m', memory: '256Mi' },
    limits: { cpu: '1000m', memory: '512Mi' },
  },
  healthCheck: {
    path: '/api/health',
  },
})

console.log(result.config) // YAML configuration
console.log(result.optimizations) // Optimization suggestions
```

### Generate Dockerfile

```typescript
const result = await configGenerator.generateDockerfile({
  language: 'typescript',
  framework: 'next.js',
  nodeVersion: '20',
  packageManager: 'bun',
  buildCommand: 'bun run build',
  startCommand: 'bun run start',
  port: 3000,
})
```

### Generate GitHub Actions Workflow

```typescript
const result = await configGenerator.generateGitHubActions({
  appName: 'my-app',
  language: 'typescript',
  framework: 'next.js',
  buildCommand: 'bun run build',
  testCommand: 'bun test',
  lintCommand: 'bun run lint',
  branches: ['main', 'develop'],
  deployEnvironments: [
    { name: 'development', branch: 'develop', url: 'https://dev.example.com' },
    { name: 'production', branch: 'main', url: 'https://example.com' },
  ],
})
```

### Generate GitLab CI Pipeline

```typescript
const result = await configGenerator.generateGitLabCI({
  appName: 'my-app',
  language: 'typescript',
  framework: 'next.js',
  buildCommand: 'bun run build',
  testCommand: 'bun test',
  lintCommand: 'bun run lint',
  branches: ['main', 'develop'],
  deployEnvironments: [
    { name: 'development', branch: 'develop' },
    { name: 'staging', branch: 'main' },
    { name: 'production', branch: 'main' },
  ],
})
```

## Optimization Suggestions

Each generation method returns optimization suggestions categorized by:

- **Performance**: Improvements for speed and efficiency
- **Security**: Security best practices and hardening
- **Cost**: Cost optimization recommendations
- **Reliability**: Reliability and resilience improvements

Suggestions include:
- Category and severity level
- Description of the issue
- Specific recommendations
- Code examples (when applicable)

## AI Configuration

By default, the service uses Claude 3.5 Sonnet with low temperature (0.3) for deterministic outputs. You can customize the AI configuration:

```typescript
const customAIConfig = {
  provider: 'openai',
  model: 'gpt-4-turbo',
  temperature: 0.2,
  maxTokens: 4000,
}

const result = await configGenerator.generateK8sDeployment(options, customAIConfig)
```

## Best Practices

1. **Review Generated Configurations**: Always review AI-generated configurations before using in production
2. **Apply Optimizations**: Review and apply relevant optimization suggestions
3. **Customize for Your Needs**: Use generated configurations as a starting point and customize as needed
4. **Version Control**: Store generated configurations in version control
5. **Test Thoroughly**: Test configurations in non-production environments first

## Requirements Validation

This service validates requirements:
- **8.1**: Kubernetes Deployment generation
- **8.2**: Dockerfile generation
- **8.3**: GitHub Actions generation
- **8.4**: GitLab CI generation
- **8.5**: Configuration optimization suggestions

## Error Handling

The service handles errors gracefully:
- AI provider errors are caught and logged
- Failed optimizations return empty arrays (non-blocking)
- Detailed error messages for debugging

## Dependencies

- `AIService`: Core AI service for model interactions
- `Logger`: Logging service
- AI providers (Claude, GPT-4, etc.)
