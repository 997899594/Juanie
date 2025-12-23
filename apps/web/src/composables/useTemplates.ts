import { log } from '@juanie/ui'
import { ref } from 'vue'
import { useToast } from '@/composables/useToast'
import { isTRPCClientError, trpc } from '@/lib/trpc'

/**
 * AI 模板生成工具组合式函数
 *
 * 注意：这是独立的 AI 辅助生成工具，用于生成单个配置文件
 * 不是项目初始化模板系统（那个在 templates/nextjs-15-app/）
 */
export function useTemplates() {
  const toast = useToast()

  // AI 生成功能状态
  const generatedTemplate = ref<string>('')
  const templateType = ref<'dockerfile' | 'cicd' | ''>('')
  const isGenerating = ref(false)

  // ==================== AI 生成功能 ====================

  const generateDockerfile = async (config: any) => {
    isGenerating.value = true
    templateType.value = 'dockerfile'
    try {
      const result = await trpc.templates.generateDockerfile.mutate(config)
      generatedTemplate.value = result.dockerfile
      toast.success('Dockerfile 生成成功')
    } catch (err) {
      log.error('Failed to generate Dockerfile:', err)
      if (isTRPCClientError(err)) {
        toast.error('生成 Dockerfile 失败', err.message)
      }
    } finally {
      isGenerating.value = false
    }
  }

  const generateCICD = async (config: any) => {
    isGenerating.value = true
    templateType.value = 'cicd'
    try {
      const result = await trpc.templates.generateCICD.mutate(config)
      generatedTemplate.value = result.config
      toast.success('CI/CD 配置生成成功')
    } catch (err) {
      log.error('Failed to generate CI/CD config:', err)
      if (isTRPCClientError(err)) {
        toast.error('生成 CI/CD 配置失败', err.message)
      }
    } finally {
      isGenerating.value = false
    }
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generatedTemplate.value)
      toast.success('已复制到剪贴板')
    } catch (_err) {
      toast.error('复制失败')
    }
  }

  const downloadTemplate = (filename: string) => {
    const blob = new Blob([generatedTemplate.value], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    toast.success('下载成功')
  }

  return {
    // AI 生成功能
    generatedTemplate,
    templateType,
    isGenerating,
    generateDockerfile,
    generateCICD,
    copyToClipboard,
    downloadTemplate,
  }
}
