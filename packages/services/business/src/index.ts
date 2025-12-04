// Business Layer - 业务层服务
// 提供项目管理、部署管理和 GitOps 功能

// 模块导出
export { BusinessModule } from './business.module'
export { DeploymentsService } from './deployments/deployments.service'
export type { ConfigureGitOpsInput, GitOpsConfig } from './environments/environments.service'
export { EnvironmentsService } from './environments/environments.service'
// GitAuthService 已废弃，使用 CredentialManagerService 代替
export { CredentialManagerService } from './gitops/credentials/credential-manager.service'
// EncryptionService 已移至 @juanie/service-foundation
export { FluxService } from './gitops/flux/flux.service'
export { FluxMetricsService } from './gitops/flux/flux-metrics.service'
export { FluxResourcesService } from './gitops/flux/flux-resources.service'
export { FluxSyncService } from './gitops/flux/flux-sync.service'
export { YamlGeneratorService } from './gitops/flux/yaml-generator.service'
export { GitOpsService } from './gitops/git-ops/git-ops.service'
export { GitProviderService } from './gitops/git-providers/git-provider.service'
export { ConflictResolutionService } from './gitops/git-sync/conflict-resolution.service'
// Git 同步服务
export { GitSyncService } from './gitops/git-sync/git-sync.service'
export { GitSyncWorker } from './gitops/git-sync/git-sync.worker'
export { GitSyncErrorService } from './gitops/git-sync/git-sync-errors'
export { OrganizationSyncService } from './gitops/git-sync/organization-sync.service'
// Git 权限映射类型
export type { GitPermission, ProjectRole } from './gitops/git-sync/permission-mapper'
export {
  isValidGitPermission,
  isValidProjectRole,
  mapProjectRoleToGitPermission,
} from './gitops/git-sync/permission-mapper'
export { ProjectCollaborationSyncService } from './gitops/git-sync/project-collaboration-sync.service'
export { K3sService } from './gitops/k3s/k3s.service'
export { GitPlatformSyncService } from './gitops/webhooks/git-platform-sync.service'
export { PipelinesService } from './pipelines/pipelines.service'
export { ProjectMembersModule } from './projects/project-members.module'
export { ProjectMembersService } from './projects/project-members.service'
export { ProjectStatusService } from './projects/project-status.service'
// 服务导出
export { ProjectsService } from './projects/projects.service'
export { TemplateManager } from './projects/template-manager.service'
export { RepositoriesService } from './repositories/repositories.service'
export { TemplatesService } from './templates/templates.service'
