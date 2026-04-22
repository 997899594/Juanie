'use client';

import { CopilotPanel } from '@/components/projects/CopilotPanel';

export function ReleaseCopilotPanel(input: {
  projectId: string;
  releaseId: string;
  releaseTitle: string;
}) {
  return (
    <CopilotPanel
      title="发布 AI"
      description={`围绕 ${input.releaseTitle} 回答风险、阻塞和下一步，不重复制造执行入口。`}
      endpoint={`/api/projects/${input.projectId}/releases/${input.releaseId}/copilot`}
      initialPrompts={['这次发布现在安全吗？', '最关键的阻塞点是什么？', '我下一步该先做什么？']}
      introMessage="已接入当前发布上下文。可以直接问风险、阻塞和下一步。"
    />
  );
}
