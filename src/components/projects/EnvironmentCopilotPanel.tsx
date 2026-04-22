'use client';

import { CopilotPanel } from '@/components/projects/CopilotPanel';

export function EnvironmentCopilotPanel(input: {
  projectId: string;
  environmentId: string;
  environmentName: string;
}) {
  return (
    <CopilotPanel
      title="环境 AI"
      description={`围绕 ${input.environmentName} 回答状态、风险和下一步，不发散到外层。`}
      endpoint={`/api/projects/${input.projectId}/environments/${input.environmentId}/copilot`}
      initialPrompts={[
        '当前环境最该先看什么？',
        '这个环境为什么是现在这个状态？',
        '变量和数据库里最需要关注哪一项？',
      ]}
      introMessage="已接入当前环境上下文。可以直接问状态、风险和下一步。"
    />
  );
}
