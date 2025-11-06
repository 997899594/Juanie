<template>
  <PageContainer title="Pipeline 管理" description="管理和监控 CI/CD Pipeline">
    <template #actions>
      <div class="flex items-center gap-3">
        <div class="w-56">
          <Select v-model="selectedProjectId">
            <SelectTrigger>
              <SelectValue :placeholder="projectSelectPlaceholder" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="p in projects"
                :key="p.id"
                :value="p.id"
              >
                {{ p.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button :disabled="!selectedProjectId" @click="showCreateDialog = true">
          <Plus class="mr-2 h-4 w-4" />
          创建 Pipeline
        </Button>
      </div>
    </template>

    <!-- 错误状态 -->
    <ErrorState
      v-if="error && !loading && selectedProjectId"
      title="加载失败"
      :message="error"
      @retry="() => selectedProjectId && fetchPipelines(selectedProjectId)"
    />

    <!-- 加载状态 -->
    <LoadingState v-else-if="loading" message="加载 Pipeline 中..." />

    <!-- 未选择项目提示 -->
    <Card v-else-if="!selectedProjectId">
      <CardContent class="flex items-center justify-between py-4">
        <div>
          <h3 class="font-semibold">请选择项目</h3>
          <p class="text-sm text-muted-foreground">先选择一个项目以查看和管理其 Pipeline</p>
        </div>
      </CardContent>
    </Card>

    <!-- 空状态 -->
    <EmptyState
      v-else-if="pipelines.length === 0 && !error"
      :icon="GitBranch"
      title="暂无 Pipeline"
      description="创建第一个 Pipeline 以开始 CI/CD"
      action-label="创建 Pipeline"
      :action-icon="Plus"
      @action="showCreateDialog = true"
    />

    <Card v-else>
      <CardHeader>
        <CardTitle>Pipeline 列表</CardTitle>
      </CardHeader>
      <CardContent>
        <div class="space-y-4">
          <div
            v-for="pipeline in pipelines"
            :key="pipeline.id"
            class="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
          >
            <div class="flex items-center space-x-4 flex-1">
              <GitBranch class="h-5 w-5 text-muted-foreground" />
              <div class="flex-1">
                <h3 class="font-semibold">{{ pipeline.name }}</h3>
                <p class="text-sm text-muted-foreground">
                  最后运行: {{ formatDate(pipeline.updatedAt) }}
                </p>
              </div>
              <Badge :variant="pipeline.isActive ? 'default' : 'secondary'">
                {{ pipeline.isActive ? '启用' : '禁用' }}
              </Badge>
            </div>
            <div class="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                :disabled="loading"
                @click="handleTrigger(pipeline.id)"
              >
                <Play class="h-4 w-4 mr-1" />
                运行
              </Button>
              <Button variant="ghost" size="sm" @click="openEditDialog(pipeline)">
                <Settings class="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

    <Dialog v-model:open="showCreateDialog">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ isEditing ? '编辑 Pipeline' : '创建 Pipeline' }}</DialogTitle>
        </DialogHeader>
        <form @submit.prevent="handleSubmit" class="space-y-4">
          <div class="space-y-2">
            <Label for="project">所属项目</Label>
            <Select id="project" v-model="form.projectId">
              <SelectTrigger>
                <SelectValue placeholder="选择项目" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="p in projects"
                  :key="p.id"
                  :value="p.id"
                >
                  {{ p.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="space-y-2">
            <Label for="name">Pipeline 名称</Label>
            <Input id="name" v-model="form.name" required />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" @click="showCreateDialog = false">
              取消
            </Button>
            <Button type="submit" :disabled="loading || !form.projectId">
              <Loader2 v-if="loading" class="mr-2 h-4 w-4 animate-spin" />
              {{ isEditing ? '更新' : '创建' }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </PageContainer>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { usePipelines } from '@/composables/usePipelines'
import { useProjects } from '@/composables/useProjects'
import { useAppStore } from '@/stores/app'
import { useToast } from '@/composables/useToast'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@juanie/ui'
import { Plus, GitBranch, Play, Settings, Loader2 } from 'lucide-vue-next'
import PageContainer from '@/components/PageContainer.vue'
import LoadingState from '@/components/LoadingState.vue'
import EmptyState from '@/components/EmptyState.vue'
import ErrorState from '@/components/ErrorState.vue'

const route = useRoute()
const toast = useToast()
const appStore = useAppStore()
const { projects, fetchProjects } = useProjects()
const currentOrganizationId = computed(() => appStore.currentOrganizationId)
const initialProjectId = (route.query.projectId as string | undefined) ?? null
const selectedProjectId = ref<string | null>(initialProjectId)

const projectSelectPlaceholder = computed(() =>
  currentOrganizationId.value ? '选择项目' : '请先选择组织',
)

const {
  pipelines,
  loading,
  error,
  fetchPipelines,
  createPipeline,
  updatePipeline,
  triggerPipeline,
} = usePipelines()

const showCreateDialog = ref(false)
const isEditing = ref(false)
const editingPipeline = ref<any>(null)

const form = ref({
  name: '',
  projectId: selectedProjectId.value || '',
})

onMounted(async () => {
  if (currentOrganizationId.value) {
    await fetchProjects(currentOrganizationId.value)
  }
  if (selectedProjectId.value) {
    await fetchPipelines(selectedProjectId.value)
  }
})

watch(currentOrganizationId, async (orgId) => {
  if (orgId) {
    await fetchProjects(orgId)
    // 重置选择，避免跨组织误选
    selectedProjectId.value = null
    form.value.projectId = ''
  }
})

watch(selectedProjectId, async (pid) => {
  form.value.projectId = pid || ''
  if (pid) {
    await fetchPipelines(pid)
  }
})

const openEditDialog = (pipeline: any) => {
  isEditing.value = true
  editingPipeline.value = pipeline
  form.value = {
    name: pipeline.name,
    projectId: selectedProjectId.value || '',
  }
  showCreateDialog.value = true
}

const handleSubmit = async () => {
  if (!form.value.projectId) {
    toast.error('创建失败', '请先选择项目')
    return
  }
  if (isEditing.value && editingPipeline.value) {
    await updatePipeline(editingPipeline.value.id, { name: form.value.name })
  } else {
    await createPipeline(form.value)
  }
  showCreateDialog.value = false
  if (selectedProjectId.value) {
    await fetchPipelines(selectedProjectId.value)
  }
}

const handleTrigger = async (pipelineId: string) => {
  await triggerPipeline(pipelineId)
  if (selectedProjectId.value) {
    await fetchPipelines(selectedProjectId.value)
  }
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleString('zh-CN')
}
</script>
