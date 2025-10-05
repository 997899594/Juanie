export type LocaleKey = 'en' | 'zhCN'

export interface LocaleMessage {
  pipeline: {
    stage: string
    step: string
    running: string
    success: string
    failure: string
    cancelled: string
  }
  metrics: {
    title: string
    refresh: string
  }
  pageHeader: {
    back: string
    shortcuts: string
  }
}

export const locale: Record<LocaleKey, LocaleMessage> = {
  en: {
    pipeline: {
      stage: 'Stage',
      step: 'Step',
      running: 'Running',
      success: 'Success',
      failure: 'Failure',
      cancelled: 'Cancelled',
    },
    metrics: {
      title: 'Metrics',
      refresh: 'Refresh',
    },
    pageHeader: {
      back: 'Back',
      shortcuts: 'Shortcuts',
    },
  },
  zhCN: {
    pipeline: {
      stage: '阶段',
      step: '步骤',
      running: '运行中',
      success: '成功',
      failure: '失败',
      cancelled: '已取消',
    },
    metrics: {
      title: '监控指标',
      refresh: '刷新',
    },
    pageHeader: {
      back: '返回',
      shortcuts: '快捷键',
    },
  },
}

export function getLocale(lang: LocaleKey): LocaleMessage {
  return locale[lang]
}
