// 成本预测占位模块
// 关键类型：指标条目、预测结果、通知负载

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
  return {
    horizonHours: 24,
    trend,
    suggestedThresholds: {
      cpu: last?.cpu ? Math.ceil((last.cpu ?? 0) * 1.2) : undefined,
      memory: last?.memory ? Math.ceil((last.memory ?? 0) * 1.2) : undefined,
      storage: last?.storage ? Math.ceil((last.storage ?? 0) * 1.2) : undefined,
    },
    message: '趋势外推（占位）— 请结合 Prometheus 指标与实际场景调整',
  }
}
