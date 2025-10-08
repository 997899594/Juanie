// 成本预测占位模块

// 指标数据点
export type MetricPoint = {
  timestamp: number // 时间戳
  cpu?: number // CPU 使用率或核数
  memory?: number // 内存使用量（MB）
  storage?: number // 存储使用量（GB）
}

export type PredictionResult = {
  horizonHours: number // 外推时长（例如 24 小时）
  trend: 'up' | 'down' | 'flat' // 趋势判断
  suggestedThresholds: { cpu?: number; memory?: number; storage?: number } // 建议阈值
  message: string // 结果摘要
}

export interface CostPredictOptions {
  model: 'llama3-gradient' | 'cpu' // 推理模型/模式
}

// 基于指标序列进行趋势外推（占位实现）
export function predictCost(series: MetricPoint[], _options: CostPredictOptions): PredictionResult {
  const last = series[series.length - 1]
  const trend: 'up' | 'down' | 'flat' = 'flat'

  // 构建建议阈值，只有当值存在时才设置属性
  const suggestedThresholds: { cpu?: number; memory?: number; storage?: number } = {}

  if (last?.cpu !== undefined) {
    suggestedThresholds.cpu = Math.ceil(last.cpu * 1.2)
  }
  if (last?.memory !== undefined) {
    suggestedThresholds.memory = Math.ceil(last.memory * 1.2)
  }
  if (last?.storage !== undefined) {
    suggestedThresholds.storage = Math.ceil(last.storage * 1.2)
  }

  return {
    horizonHours: 24,
    trend,
    suggestedThresholds,
    message: '趋势外推（占位）— 请结合 Prometheus 指标与实际场景调整',
  }
}
