'use client';

import { buildCreateProjectSubmissionSnapshot } from '@/lib/projects/create-view';

interface CreateProjectPayload {
  mode: 'import' | 'create';
  repositoryId?: string;
  repositoryFullName?: string;
  isPrivate?: boolean;
  template?: string;
  name: string;
  slug: string;
  description?: string;
  teamId: string;
  services: unknown[];
  databases: unknown[];
  domain?: string;
  useCustomDomain?: boolean;
  productionBranch: string;
  autoDeploy: boolean;
  productionDeploymentStrategy?: 'rolling' | 'controlled' | 'canary' | 'blue_green';
  previewDatabaseStrategy?: 'inherit' | 'isolated_clone';
  runtimeProfile?: 'standard' | 'resilient' | 'performance';
}

export async function submitCreateProject(payload: CreateProjectPayload): Promise<
  | {
      ok: true;
      project: { id: string };
    }
  | {
      ok: false;
      snapshot: ReturnType<typeof buildCreateProjectSubmissionSnapshot>;
    }
> {
  try {
    const response = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (response.ok) {
      return {
        ok: true,
        project: data.project,
      };
    }

    return {
      ok: false,
      snapshot: buildCreateProjectSubmissionSnapshot({
        code: data.code ?? 'project_create_failed',
        message: data.error ?? data.details ?? '创建项目失败',
      }),
    };
  } catch {
    return {
      ok: false,
      snapshot: buildCreateProjectSubmissionSnapshot({
        code: 'project_create_failed',
        message: '创建请求失败，请稍后重试',
      }),
    };
  }
}
