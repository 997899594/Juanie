'use client';

import { CopilotPanel } from '@/components/projects/CopilotPanel';

export function ReleaseCopilotPanel(input: {
  projectId: string;
  releaseId: string;
  releaseTitle: string;
}) {
  return (
    <CopilotPanel
      title="Release Copilot"
      description={`围绕 ${input.releaseTitle} 回答当前发布是否安全、卡在哪、先做什么，不重复制造执行入口。`}
      endpoint={`/api/projects/${input.projectId}/releases/${input.releaseId}/copilot`}
      initialPrompts={['这次发布现在安全吗？', '最关键的阻塞点是什么？', '我下一步该先做什么？']}
      introMessage="我已经接入当前发布上下文。你可以直接问我风险、阻塞、故障归因和下一步建议。"
    />
  );
}
