<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div class="mb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold text-foreground mb-2">部署记录</h1>
        <p class="text-muted-foreground">选择项目以查看其部署历史与统计</p>
      </div>
      <div class="flex items-center gap-3">
        <Select v-model="selectedProjectIdString">
          <SelectTrigger class="w-64">
            <SelectValue placeholder="选择项目" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem 
              v-for="p in projects"
              :key="p.id"
              :value="String(p.id)"
            >
              {{ p.displayName || p.name }}
            </SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" @click="reloadProjects">刷新项目</Button>
      </div>
    </div>

    <div v-if="projects.length === 0" class="text-center py-20">
      <p class="text-muted-foreground">暂未找到项目，请先创建项目。</p>
    </div>

    <div v-else-if="!selectedProjectId" class="text-center py-20">
      <p class="text-muted-foreground">请选择一个项目以查看部署记录。</p>
    </div>

    <div v-else>
      <ProjectDeployments :project-id="selectedProjectId" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { trpc } from '@/lib/trpc'
import ProjectDeployments from '@/components/ProjectDeployments.vue'
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Button
} from '@juanie/ui'

type ProjectListResult = Awaited<ReturnType<typeof trpc.projects.getOrganizationProjects.query>>
const projects = ref<ProjectListResult['projects']>([])
const selectedProjectIdString = ref<string | undefined>(undefined)
const selectedProjectId = computed(() => selectedProjectIdString.value || undefined)

const reloadProjects = async () => {
  const result = await trpc.projects.getOrganizationProjects.query({ 
    organizationId: 'temp-org-id', // 临时使用，需要从认证状态获取
    limit: 50,
    offset: 0
  })
  projects.value = result.projects
  // 默认选择第一个项目（增加安全判断以通过类型检查）
  const first = result.projects && result.projects.length > 0 ? result.projects[0] : undefined
  if (!selectedProjectIdString.value && first) {
    selectedProjectIdString.value = String(first.id)
  }
}

onMounted(() => {
  reloadProjects()
})

watch(selectedProjectIdString, () => {
  // 响应式监听选择变化，这里无需额外逻辑，ProjectDeployments 会根据 props 拉取数据
})
</script>