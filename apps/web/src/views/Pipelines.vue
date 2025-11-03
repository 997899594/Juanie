<template>
  <PageContainer title="Pipeline 管理" description="管理和监控 CI/CD Pipeline">
    <template #actions>
      <Button @click="showCreateDialog = true">
        <Plus class="mr-2 h-4 w-4" />
        创建 Pipeline
      </Button>
    </template>

    <!-- 错误状态 -->
    <ErrorState
      v-if="error && !loading"
      title="加载失败"
      :message="error"
      @retry="() => projectId && fetchPipelines(projectId)"
    />

    <!-- 加载状态 -->
    <LoadingState v-else-if="loading" message="加载 Pipeline 中..." />

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
            <Label for="name">Pipeline 名称</Label>
            <Input id="name" v-model="form.name" required />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" @click="showCreateDialog = false">
              取消
            </Button>
            <Button type="submit" :disabled="loading">
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
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { usePipelines } from '@/composables/usePipelines'
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
} from '@juanie/ui'
import { Plus, GitBranch, Play, Settings } from 'lucide-vue-next'
import PageContainer from '@/components/PageContainer.vue'
import LoadingState from '@/components/LoadingState.vue'
import EmptyState from '@/components/EmptyState.vue'
import ErrorState from '@/components/ErrorState.vue'

const route = useRoute()
const projectId = route.params.projectId as string

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
  projectId: projectId,
})

onMounted(async () => {
  if (projectId) {
    await fetchPipelines(projectId)
  }
})

const openEditDialog = (pipeline: any) => {
  isEditing.value = true
  editingPipeline.value = pipeline
  form.value = {
    name: pipeline.name,
    projectId: projectId,
  }
  showCreateDialog.value = true
}

const handleSubmit = async () => {
  if (isEditing.value && editingPipeline.value) {
    await updatePipeline(editingPipeline.value.id, { name: form.value.name })
  } else {
    await createPipeline(form.value)
  }
  showCreateDialog.value = false
  await fetchPipelines(projectId)
}

const handleTrigger = async (pipelineId: string) => {
  await triggerPipeline(pipelineId)
  await fetchPipelines(projectId)
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleString('zh-CN')
}
</script>
