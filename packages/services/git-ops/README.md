# Git Operations Service

This service provides Git operations for the GitOps integration, enabling bidirectional GitOps workflows.

## Features

- **Repository Management**: Clone, pull, and manage Git repositories
- **UI to Git**: Convert UI operations to Git commits
- **YAML Smart Updates**: Intelligently update Kubernetes YAML files while preserving comments and formatting
- **Conflict Detection**: Detect and resolve concurrent editing conflicts
- **Credential Management**: Secure Git credential handling via K8s Secrets

## Core Functionality

### 1. Repository Operations
- Initialize and clone repositories
- Checkout branches
- Pull latest changes
- Manage Git credentials

### 2. UI → Git Conversion (Core Innovation)
- Accept UI configuration changes (image, replicas, env vars, etc.)
- Generate or update K8s YAML files
- Create friendly commit messages
- Push changes to remote repository

### 3. YAML Smart Updates
- Parse existing YAML files
- Update specific fields
- Preserve original formatting, comments, and whitespace
- Validate YAML syntax

### 4. Conflict Resolution
- Detect concurrent editing conflicts
- Auto-merge non-overlapping changes
- Provide conflict details for manual resolution

## Usage

```typescript
import { GitOpsService } from '@juanie/service-git-ops';

// Initialize repository
await gitOpsService.initRepository(repoUrl, localPath);

// Commit from UI changes
const commitSha = await gitOpsService.commitFromUI({
  projectId: 'project-123',
  environmentId: 'env-456',
  changes: {
    image: 'myapp:v1.2.3',
    replicas: 5,
    env: { NODE_ENV: 'production' }
  },
  userId: 'user-789'
});
```

## Requirements

This service implements requirements 4.1-4.5 from the GitOps integration specification:
- 4.1: Visual deployment forms
- 4.2: Automatic YAML generation
- 4.3: Automatic Git commit creation
- 4.4: Friendly commit messages
- 4.5: Deployment method tracking
