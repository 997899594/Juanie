import { resolveProjectRuntimeStatus } from '@/lib/projects/runtime-status';
import { buildProjectGovernanceSnapshot } from '@/lib/projects/settings-view';
import { formatPlatformDateTimeShort } from '@/lib/time/format';

interface ProjectListEnvironmentLike {
  id: string;
  name: string;
  isProduction?: boolean | null;
  isPreview?: boolean | null;
  deliveryMode?: 'direct' | 'promote_only' | null;
  previewBuildStatus?: string | null;
}

export interface ProjectListItemLike {
  id: string;
  name: string;
  status?: string | null;
  createdAt?: Date | string | null;
  teamName: string;
  repositoryFullName?: string | null;
  role: 'owner' | 'admin' | 'member';
  environments: ProjectListEnvironmentLike[];
}

export interface ProjectListCard {
  id: string;
  name: string;
  status: string | null;
  statusLabel: string;
  teamName: string;
  repositoryLabel: string | null;
  createdAtLabel: string;
  roleLabel: ReturnType<typeof buildProjectGovernanceSnapshot>['roleLabel'];
}

export interface ProjectListStat {
  label: string;
  value: number;
}

function formatCreatedAtLabel(value?: Date | string | null): string {
  return formatPlatformDateTimeShort(value) ?? '—';
}

export function buildProjectListStats(input: {
  projectCount: number;
  teamCount: number;
}): ProjectListStat[] {
  return [
    { label: '项目', value: input.projectCount },
    { label: '团队', value: input.teamCount },
  ];
}

export function decorateProjectListCards<TProject extends ProjectListItemLike>(
  projects: TProject[]
): ProjectListCard[] {
  return projects.map((project) => {
    const governance = buildProjectGovernanceSnapshot({
      role: project.role,
      environments: project.environments,
    });
    const runtimeStatus = resolveProjectRuntimeStatus({
      status: project.status,
      environments: project.environments,
    });

    return {
      id: project.id,
      name: project.name,
      status: runtimeStatus.status,
      statusLabel: runtimeStatus.statusLabel,
      teamName: project.teamName,
      repositoryLabel: project.repositoryFullName ?? null,
      createdAtLabel: formatCreatedAtLabel(project.createdAt),
      roleLabel: governance.roleLabel,
    };
  });
}
