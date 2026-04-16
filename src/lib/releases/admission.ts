import {
  allowsDirectReleaseCreation,
  allowsGitRouting,
  type EnvironmentDeliveryModeLike,
  isPreviewEnvironment,
} from '@/lib/environments/model';

export type ReleaseEntryPoint =
  | 'repository_route'
  | 'manual_release'
  | 'promotion'
  | 'rollback'
  | 'preview_launch';

export interface ReleaseAdmissionEnvironmentLike extends EnvironmentDeliveryModeLike {
  name?: string | null;
}

export class ReleaseAdmissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReleaseAdmissionError';
  }
}

export function canCreateReleaseWithEntryPoint(
  environment: ReleaseAdmissionEnvironmentLike,
  entryPoint: ReleaseEntryPoint
): boolean {
  switch (entryPoint) {
    case 'repository_route':
      return allowsGitRouting(environment);
    case 'manual_release':
      return allowsDirectReleaseCreation(environment);
    case 'promotion':
    case 'rollback':
      return true;
    case 'preview_launch':
      return isPreviewEnvironment(environment);
    default:
      return false;
  }
}

export function getReleaseEntryPointGuardReason(
  _environment: ReleaseAdmissionEnvironmentLike,
  entryPoint: ReleaseEntryPoint
): string {
  switch (entryPoint) {
    case 'repository_route':
      return '当前环境只接受提升，不能接收 Git 路由发布';
    case 'manual_release':
      return '当前环境只接受提升，不能直接创建发布';
    case 'preview_launch':
      return '只有预览环境支持从分支或 PR 直接启动';
    default:
      return `当前环境不允许通过 ${entryPoint} 创建发布`;
  }
}

export function assertReleaseEntryPointAllowed(
  environment: ReleaseAdmissionEnvironmentLike,
  entryPoint: ReleaseEntryPoint
): void {
  if (!canCreateReleaseWithEntryPoint(environment, entryPoint)) {
    throw new ReleaseAdmissionError(getReleaseEntryPointGuardReason(environment, entryPoint));
  }
}
