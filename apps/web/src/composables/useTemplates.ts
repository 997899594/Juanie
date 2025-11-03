import { ref } from 'vue'
import { trpc } from '@/lib/trpc'
import { useToast } from './useToast'

export function useTemplates() {
  const toast = useToast()

  const generatedTemplate = ref('')
  const templateType = ref<'dockerfile' | 'cicd'>('dockerfile')

  const generateDockerfileMutation = trpc.templates.generateDockerfile.useMutation({
    onSuccess: (data) => {
      generatedTemplate.value = data.dockerfile
      templateType.value = 'dockerfile'
      toast.success('Dockerfile 生成成功')
    },
    onError: (error) => {
      toast.error('生成失败', error.message)
    },
  })

  const generateCICDMutation = trpc.templates.generateCICD.useMutation({
    onSuccess: (data) => {
      generatedTemplate.value = data.cicd
      templateType.value = 'cicd'
      toast.success('CI/CD 配置生成成功')
    },
    onError: (error) => {
      toast.error('生成失败', error.message)
    },
  })

  const getPresetQuery = trpc.templates.getPreset.useQuery

  const copyToClipboard = () => {
    if (!generatedTemplate.value) {
      toast.error('没有可复制的内容')
      return
    }
    navigator.clipboard.writeText(generatedTemplate.value)
    toast.success('已复制到剪贴板')
  }

  const downloadTemplate = (filename?: string) => {
    if (!generatedTemplate.value) {
      toast.error('没有可下载的内容')
      return
    }

    const defaultFilename = templateType.value === 'dockerfile' ? 'Dockerfile' : '.gitlab-ci.yml'
    const blob = new Blob([generatedTemplate.value], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename || defaultFilename
    a.click()
    URL.revokeObjectURL(url)
    toast.success('下载成功')
  }

  return {
    generatedTemplate,
    templateType,
    generateDockerfile: generateDockerfileMutation.mutate,
    generateCICD: generateCICDMutation.mutate,
    getPreset: getPresetQuery,
    copyToClipboard,
    downloadTemplate,
    isGenerating: generateDockerfileMutation.isLoading || generateCICDMutation.isLoading,
  }
}
