zhe# GitOps 快速参考

## 🚀 核心服务

### GitOpsOrchestratorService
```typescript
import { GitOpsOrchestratorService } from '@juanie/service-business'

// 设置 GitOps
await orchestrator.setupProjectGitOps({
  projectId, repositoryId, repositoryUrl, 
  repositoryBranch, accessToken, environments
})

// 同步状态
await orchestrator.syncGitOpsStatus(projectId)

// 获取摘要
await orchestrator.getProjectGitOpsSummary(projectId)

// 清理资源
await orchestrator.cleanupProjectGitOps(projectId)
```

## 📋 命名规范

| 资源 | 格式 | 示例 |
|------|------|------|
| Namespace | `project-{id}-{env}` | `project-123-dev` |
| GitRepository | `{id}-repo` | `123-repo` |
| Kustomization | `{id}-{env}` | `123-dev` |
| Secret | `{id}-git-auth` | `123-git-auth` |

## ⚙️ 配置

```bash
# 环境变量
KUBECONFIG_PATH=~/.kube/config
K3S_SKIP_TLS_VERIFY=true

# 安装 Flux
flux install
flux check
```

## 🔍 故障排查

```bash
# 检查 Flux 状态
flux check

# 查看 GitRepository
kubectl get gitrepositories -A

# 查看 Kustomization
kubectl get kustomizations -A

# 查看 Flux 日志
kubectl logs -n flux-system deploy/source-controller
kubectl logs -n flux-system deploy/kustomize-controller

# 查看项目资源
kubectl get all -n project-{id}-development
```

## 📚 文档

- `docs/gitops-modernization-assessment.md` - 现代化评估
- `docs/gitops-implementation-guide.md` - 完整实现指南
- `GITOPS_MODERNIZATION_COMPLETE.md` - 完成总结

## ✨ 现代化特性

- ✅ Server-Side Apply (SSA)
- ✅ 资源状态等待
- ✅ Namespace 隔离
- ✅ 声明式配置
- ✅ 完整生命周期管理
