'use client';

import { CopilotPanel } from '@/components/projects/CopilotPanel';

export function EnvironmentCopilotPanel(input: {
  projectId: string;
  environmentId: string;
  environmentName: string;
}) {
  return (
    <CopilotPanel
      title="Environment Copilot"
      description={`围绕 ${input.environmentName} 回答当前状态、风险、阻塞和下一步，不额外发散到项目外层。`}
      endpoint={`/api/projects/${input.projectId}/environments/${input.environmentId}/copilot`}
      initialPrompts={[
        '当前环境最该先看什么？',
        '这个环境为什么是现在这个状态？',
        '变量和数据库里最需要关注哪一项？',
      ]}
      introMessage={`我已经接入当前环境上下文。你可以直接问我这个环境现在最重要的状态、风险、阻塞和下一步。`}
    />
  );
}
