import type { JuaniePromptKey } from '@/lib/ai/prompts/registry';

export type CopilotScopeKind = 'environment' | 'release';

export interface CopilotDefinition {
  kind: CopilotScopeKind;
  title: string;
  skillId: string;
  promptKey: JuaniePromptKey;
  taskKind: 'environment_deep_analysis' | 'release_deep_analysis';
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
        return ['哪些变量最值得先检查？', '继承链里哪里最容易出错？', '现在改变量会影响什么？'];
      }

      if (normalized.includes('数据库') || normalized.includes('迁移')) {
        return ['哪个数据库最需要先处理？', '现在适合继续迁移吗？', '先看风险还是先看下一步？'];
      }

      return [
        '当前环境最该先看什么？',
        '这个环境为什么是现在这个状态？',
        '我下一步最合理的动作是什么？',
      ];
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
        return [
          '最像根因的信号是什么？',
          '先处理迁移还是先处理部署？',
          '有没有可以立刻执行的动作？',
        ];
      }

      if (normalized.includes('回滚') || normalized.includes('发布')) {
        return ['现在适合继续推进吗？', '回滚触发条件是什么？', '我应该先确认哪几个检查项？'];
      }

      return ['这次发布现在安全吗？', '最关键的阻塞点是什么？', '我下一步该做什么？'];
    },
  },
};

export function getCopilotDefinition(kind: CopilotScopeKind): CopilotDefinition {
  return copilotDefinitions[kind];
}
