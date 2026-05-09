import { z } from 'zod';

export const aiTaskKinds = ['environment_deep_analysis', 'release_deep_analysis'] as const;

export type AITaskKind = (typeof aiTaskKinds)[number];

export const aiTaskRequestSchema = z.object({
  kind: z.literal('deep_analysis'),
  question: z.string().trim().min(1).max(4000),
});

export const AI_TASK_ENQUEUED_SUMMARY = '已开始后台分析。';

const defaultTaskTitleLength = 36;

function buildTitle(question: string): string {
  return question.length > defaultTaskTitleLength
    ? `${question.slice(0, defaultTaskTitleLength)}...`
    : question;
}

export const aiTaskCatalog = {
  environment_deep_analysis: {
    kind: 'environment_deep_analysis',
    resourceType: 'environment',
    buildTitle,
  },
  release_deep_analysis: {
    kind: 'release_deep_analysis',
    resourceType: 'release',
    buildTitle,
  },
} as const satisfies Record<
  AITaskKind,
  {
    kind: AITaskKind;
    resourceType: 'environment' | 'release';
    buildTitle: (question: string) => string;
  }
>;

export function getAITaskDefinition(kind: AITaskKind) {
  return aiTaskCatalog[kind];
}
