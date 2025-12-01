/**
 * 初始化步骤定义
 *
 * 每个步骤包含：
 * - 名称和描述
 * - 进度范围（开始和结束百分比）
 * - 预估时间
 */

export interface InitializationStep {
  name: string
  label: string
  description: string
  progressStart: number
  progressEnd: number
  estimatedDuration: number // 秒
}

/**
 * 标准初始化步骤
 */
export const INITIALIZATION_STEPS: InitializationStep[] = [
  {
    name: 'create_repository',
    label: '创建 Git 仓库',
    description: '在 GitHub/GitLab 上创建代码仓库',
    progressStart: 0,
    progressEnd: 20,
    estimatedDuration: 5,
  },
  {
    name: 'push_template',
    label: '推送模板代码',
    description: '将项目模板推送到仓库',
    progressStart: 20,
    progressEnd: 50,
    estimatedDuration: 10,
  },
  {
    name: 'create_database_records',
    label: '创建数据库记录',
    description: '保存项目和仓库信息',
    progressStart: 50,
    progressEnd: 60,
    estimatedDuration: 2,
  },
  {
    name: 'setup_gitops',
    label: '配置 GitOps',
    description: '创建 Flux 资源和 Kubernetes 配置',
    progressStart: 60,
    progressEnd: 90,
    estimatedDuration: 15,
  },
  {
    name: 'finalize',
    label: '完成初始化',
    description: '更新项目状态',
    progressStart: 90,
    progressEnd: 100,
    estimatedDuration: 2,
  },
]

/**
 * 获取步骤的进度范围
 */
export function getStepProgressRange(stepName: string): { start: number; end: number } {
  const step = INITIALIZATION_STEPS.find((s) => s.name === stepName)
  if (!step) {
    throw new Error(`Unknown step: ${stepName}`)
  }
  return { start: step.progressStart, end: step.progressEnd }
}

/**
 * 计算步骤内的进度
 * @param stepName 步骤名称
 * @param stepProgress 步骤内的进度（0-100）
 * @returns 总体进度（0-100）
 */
export function calculateStepProgress(stepName: string, stepProgress: number): number {
  const range = getStepProgressRange(stepName)
  const progress = range.start + ((range.end - range.start) * stepProgress) / 100
  return Math.round(progress)
}

/**
 * 根据总体进度获取当前步骤
 */
export function getCurrentStep(progress: number): InitializationStep | null {
  return (
    INITIALIZATION_STEPS.find(
      (step) => progress >= step.progressStart && progress < step.progressEnd,
    ) || null
  )
}
