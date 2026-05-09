import type { JuaniePromptKey } from '@/lib/ai/prompts/registry';
import type { AITaskKind } from '@/lib/ai/tasks/catalog';

export type CopilotScopeKind = 'environment' | 'release';

export type CopilotTarget =
  | {
      kind: 'environment';
      projectId: string;
      environmentId: string;
    }
  | {
      kind: 'release';
      projectId: string;
      releaseId: string;
    };

export interface CopilotDefinition {
  kind: CopilotScopeKind;
  title: string;
  skillId: string;
  promptKey: JuaniePromptKey;
  taskKind: AITaskKind;
  getSuggestions(latestQuestion?: string): string[];
}

const copilotDefinitions: Record<CopilotScopeKind, CopilotDefinition> = {
  environment: {
    kind: 'environment',
    title: '当前环境',
    skillId: 'environment-skill',
    promptKey: 'environment-copilot',
    taskKind: 'environment_deep_analysis',
    getSuggestions(latestQuestion) {
      const normalized = latestQuestion?.toLowerCase() ?? '';

      if (normalized.includes('变量') || normalized.includes('env')) {
        return ['变量状态', '继承关系', '变更影响'];
      }

      if (normalized.includes('数据库') || normalized.includes('迁移')) {
        return ['数据库状态', '迁移风险', '处理动作'];
      }

      return ['环境状态', '风险点', '可执行动作'];
    },
  },
  release: {
    kind: 'release',
    title: '当前发布',
    skillId: 'release-skill',
    promptKey: 'release-copilot',
    taskKind: 'release_deep_analysis',
    getSuggestions(latestQuestion) {
      const normalized = latestQuestion?.toLowerCase() ?? '';

      if (normalized.includes('失败') || normalized.includes('故障')) {
        return ['失败信号', '阻塞点', '处理动作'];
      }

      if (normalized.includes('回滚') || normalized.includes('发布')) {
        return ['发布状态', '回滚条件', '检查项'];
      }

      return ['发布状态', '阻塞点', '处理动作'];
    },
  },
};

export function getCopilotDefinition(kind: CopilotScopeKind): CopilotDefinition {
  return copilotDefinitions[kind];
}

export function buildCopilotEndpoint(target: CopilotTarget): string {
  if (target.kind === 'environment') {
    return `/api/projects/${target.projectId}/environments/${target.environmentId}/copilot`;
  }

  return `/api/projects/${target.projectId}/releases/${target.releaseId}/copilot`;
}

export function buildCopilotTaskEndpoint(target: CopilotTarget): string {
  if (target.kind === 'environment') {
    return `/api/projects/${target.projectId}/environments/${target.environmentId}/tasks`;
  }

  return `/api/projects/${target.projectId}/releases/${target.releaseId}/tasks`;
}
