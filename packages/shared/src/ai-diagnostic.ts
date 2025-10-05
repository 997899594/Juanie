// AI 构建失败诊断占位模块
// 关键类型：诊断输入/输出、通道类型

export type CiLogFragment = {
  stage: string // 阶段名称
  message: string // 日志片段
  timestamp?: number // 可选时间戳
}

export type BuildFailureSummary = {
  stage: string // 失败阶段
  headline: string // 摘要标题
  reasons: string[] // 可能原因（≤3条）
  suggestions: string[] // 修复建议（≤3条）
}

export interface AiDiagnosticOptions {
  model: 'codellama-7b' | 'cpu' | 'gpu' // 推理模型/模式
  maxTokens?: number // 限制生成长度
}

// 生成构建失败摘要（占位实现）
export function generateFailureSummary(
  logs: CiLogFragment[],
  _options: AiDiagnosticOptions,
): BuildFailureSummary {
  // TODO: 后续接入本地推理，当前返回占位结果
  const top = logs[0] ?? { stage: 'unknown', message: '' }
  return {
    stage: top.stage,
    headline: '构建失败摘要（占位）',
    reasons: ['可能原因示例 A', '可能原因示例 B'],
    suggestions: ['建议修复 A', '建议修复 B'],
  }
}
