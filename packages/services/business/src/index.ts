// Business Layer - 业务层服务
// 提供项目管理、部署管理和 GitOps 功能

// 模块导出
export { BusinessModule } from './business.module';
export { DeploymentsService } from './deployments/deployments.service';
export type {
  ConfigureGitOpsInput,
  GitOpsConfig,
} from './environments/environments.service';
export { EnvironmentsService } from './environments/environments.service';
// ❌ 暂时注释掉不存在的导出
// export { CredentialManagerService } from './gitops/credentials/credential-manager.service'
export { ConflictResolutionService } from './gitops/git-sync/conflict-resolution.service';
// Git 同步服务
export { GitSyncService } from './gitops/git-sync/git-sync.service';
export { GitSyncWorker } from './gitops/git-sync/git-sync.worker';
export { OrganizationSyncService } from './gitops/git-sync/organization-sync.service';
// Git 权限映射类型
export type {
  GitPermission,
  ProjectRole,
} from './gitops/git-sync/permission-mapper';
export {
  isValidGitPermission,
  isValidProjectRole,
  mapProjectRoleToGitPermission,
} from './gitops/git-sync/permission-mapper';
export { ProjectCollaborationSyncService } from './gitops/git-sync/project-collaboration-sync.service';
export { GitPlatformSyncService } from './gitops/webhooks/git-platform-sync.service';
export { PipelinesService } from './pipelines/pipelines.service';

export { ProjectsService } from './projects/core/projects.service';
export { ProjectMembersService } from './projects/members/project-members.service';
export { ProjectStatusService } from './projects/status/project-status.service';
export { RepositoriesService } from './repositories/repositories.service';
export type {
  CICDConfig,
  DockerfileConfig,
} from './templates/templates.service';
export { TemplatesService } from './templates/templates.service';
