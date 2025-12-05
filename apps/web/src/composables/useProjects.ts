import { useProjectAssets } from './projects/useProjectAssets'
import { useProjectCRUD } from './projects/useProjectCRUD'
import { useProjectMembers } from './projects/useProjectMembers'
import { useProjectStatus } from './projects/useProjectStatus'
import { useProjectTeams } from './projects/useProjectTeams'

/**
 * 项目管理组合式函数（聚合版本）
 * 使用 TanStack Query 提供自动缓存、失效和重新获取功能
 *
 * 注意：这是一个便捷的聚合函数，如果只需要特定功能，
 * 可以直接导入对应的子 composable 以减少包大小
 */
export function useProjects() {
  const crud = useProjectCRUD()
  const members = useProjectMembers()
  const teams = useProjectTeams()
  const assets = useProjectAssets()
  const status = useProjectStatus()

  return {
    // CRUD 操作
    ...crud,

    // 成员管理
    ...members,

    // 团队管理
    ...teams,

    // 资源管理
    ...assets,

    // 状态和健康度
    ...status,
  }
}

// 重新导出子 composables 供直接使用
export { useProjectAssets } from './projects/useProjectAssets'
export { useProjectCRUD } from './projects/useProjectCRUD'
export { useProjectMembers } from './projects/useProjectMembers'
export { useProjectStatus } from './projects/useProjectStatus'
export { useProjectTeams } from './projects/useProjectTeams'
