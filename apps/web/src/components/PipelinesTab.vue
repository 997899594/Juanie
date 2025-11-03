<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h3 class="text-lg font-semibold">CI/CD Pipeline</h3>
        <p class="text-sm text-muted-foreground">管理项目的持续集成和部署流程</p>
      </div>
      <Button @click="showCreateDialog = true" size="sm">
        <Plus class="mr-2 h-4 w-4" />
        创建 Pipeline
      </Button>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-12">
      <Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
    </div>

    <Card v-else-if="pipelines.length === 0">
      <CardContent class="flex flex-col items-center justify-center py-12">
        <GitBranch class="h-12 w-12 text-muted-foreground mb-4" />
        <h3 class="text-lg font-semibold mb-2">暂无 Pipeline</h3>
        <p class="text-sm text-muted-foreground mb-4">创建第一个 Pipeline 以开始 CI/CD</p>
        <Button @click="showCreateDialog = true" size="sm">
          <Plus class="mr-2 h-4 w-4" />
          创建 Pipeline
        </Button>
      </CardContent>
    </Card>

    <div v-else class="space-y-3">
      <div
        v-for="pipeline in pipelines"
        :key="pipeline.id"
        class="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
      >
        <div class="flex items-center space-x-4 flex-1">
          <GitBranch class="h-5 w-5 text-muted-foreground" />
          <div class="flex-1">
            <h3 class="font-semibold text-sm">{{ pipeline.name }}</h3>
            <p class="text-xs text-muted-foreground">
              最后运行: {{ formatDate(pipeline.updatedAt) }}
            </p>
          </div>
          <Badge :variant="pipeline.isActive ? 'default' : 'secondary'" class="text-xs">
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
            <Play class="h-3 w-3 mr-1" />
            运行
          </Button>
        </div>
      </div>
    </div>

    <Dialog v-model:open="showCreateDialog">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>创建 Pipeline</DialogTitle>
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
              创建
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { usePipelines } from '@/composables/usePipelines'
import {
  Button,
  Card,
  CardContent,
  Badge,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@juanie/ui'
import { Plus, GitBranch, Play, Loader2 } from 'lucide-vue-next'

const props = defineProps<{
  projectId: string
}>()

const {
  pipelines,
  loading,
  fetchPipelines,
  createPipeline,
  triggerPipeline,
} = usePipelines()

const showCreateDialog = ref(false)

const form = ref({
  name: '',
  projectId: props.projectId,
})

onMounted(async () => {
  await fetchPipelines(props.projectId)
})

const handleSubmit = async () => {
  await createPipeline({ ...form.value, projectId: props.projectId })
  showCreateDialog.value = false
  await fetchPipelines(props.projectId)
}

const handleTrigger = async (pipelineId: string) => {
  await triggerPipeline(pipelineId)
  await fetchPipelines(props.projectId)
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleString('zh-CN')
}
</script>
