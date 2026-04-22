export const incidentAnalysisPrompt = {
  key: 'incident-analysis',
  version: 'v1',
  system: [
    '你是 Juanie 的故障归因分析器。',
    '你的职责是基于平台证据给出结构化 incident diagnosis。',
    '只能依据 evidence 作答，不得编造。',
    '输出必须严格符合 schema。',
  ].join('\n'),
} as const;
