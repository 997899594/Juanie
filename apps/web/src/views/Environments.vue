<template>
  <PageContainer title="环境管理" description="管理项目的部署环境">
    <template #actions>
      <Button @click="openCreateDialog">
        <Plus class="mr-2 h-4 w-4" />
        创建环境
      </Button>
    </template>

    <!-- Loading State -->
    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
    </div>

    <!-- Empty State -->
    <Card v-else-if="environments.length === 0">
      <CardContent class="flex flex-col items-center justify-center py-12">
        <Server class="h-12 w-12 text-muted-foreground mb-4" />
        <h3 class="text-lg font-semibold mb-2">暂无环境</h3>
        <p class="text-sm text-muted-foreground mb-4">
          创建第一个部署环境以开始使用
        </p>
        <Button @click="openCreateDialog">
          <Plus class="mr-2 h-4 w-4" />
          创建环境
        </Button>
      </CardContent>
    </Card>

    <!-- Environment Grid -->
    <div v-else class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <EnvironmentCard
        v-for="env in environments"
        :key="env.id"
        :environment="env"
        @edit="openEditDialog"
        @delete="confirmDelete"
      />
    </div>

    <!-- Create/Edit Environment Dialog -->
    <Dialog v-model:open="showDialog">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ isEditing ? '编辑环境' : '创建环境' }}</DialogTitle>
          <DialogDescription>
            {{ isEditing ? '更新环境配置' : '创建新的部署环境' }}
          </DialogDescription>
        </DialogHeader>
        <form @submit.prevent="handleSubmit" class="space-y-4">
          <div class="space-y-2">
            <Label for="name">环境名称</Label>
            <Input
              id="name"
              v-model="form.name"
              placeholder="例如：生产环境"
              required
            />
          </div>

          <div class="space-y-2">
            <Label for="type">环境类型</Label>
            <Select v-model="form.type">
              <SelectTrigger id="type">
                <SelectValue placeholder="选择环境类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="development">开发环境</SelectItem>
                <SelectItem value="staging">测试环境</SelectItem>
                <SelectItem value="production">生产环境</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="space-y-2">
            <Label for="description">描述（可选）</Label>
            <Textarea
              id="description"
              v-model="form.description"
              placeholder="环境描述"
              rows="3"
            />
          </div>

          <div class="space-y-2">
            <Label for="url">URL（可选）</Label>
            <Input
              id="url"
              v-model="form.url"
              type="url"
              placeholder="https://example.com"
            />
          </div>

          <!-- GitOps 配置 -->
          <div class="space-y-4 pt-4 border-t">
            <div class="flex items-center justify-between">
              <div>
                <Label class="text-base">GitOps 配置</Label>
                <p class="text-sm text-muted-foreground">
                  启用 GitOps 自动部署
                </p>
              </div>
              <Switch 
                v-model="form.gitopsEnabled"
              />
            </div>

            <div v-if="form.gitopsEnabled" class="space-y-4 pl-4 border-l-2">
              <div class="space-y-2">
                <Label for="gitBranch">Git 分支</Label>
                <Input
                  id="gitBranch"
                  v-model="form.gitBranch"
                  placeholder="main"
                />
                <p class="text-xs text-muted-foreground">
                  此环境对应的 Git 分支
                </p>
              </div>

              <div class="space-y-2">
                <Label for="gitPath">配置路径</Label>
                <Input
                  id="gitPath"
                  v-model="form.gitPath"
                  placeholder="./k8s/overlays/production"
                />
                <p class="text-xs text-muted-foreground">
                  K8s 配置文件在仓库中的路径
                </p>
              </div>

              <div class="space-y-2">
                <Label for="syncInterval">同步间隔</Label>
                <Select v-model="form.syncInterval">
                  <SelectTrigger id="syncInterval">
                    <SelectValue placeholder="选择同步间隔" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1m">1 分钟</SelectItem>
                    <SelectItem value="5m">5 分钟</SelectItem>
                    <SelectItem value="10m">10 分钟</SelectItem>
                    <SelectItem value="30m">30 分钟</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div class="flex items-center space-x-2">
                <Switch 
                  v-model="form.autoSync"
                  id="autoSync"
                />
                <Label for="autoSync" class="cursor-pointer">
                  自动同步
                </Label>
                <p class="text-xs text-muted-foreground">
                  （检测到 Git 变更时自动部署）
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" @click="showDialog = false">
              取消
            </Button>
            <Button type="submit" :disabled="isCreating || isUpdating">
              <Loader2 v-if="isCreating || isUpdating" class="mr-2 h-4 w-4 animate-spin" />
              {{ isEditing ? '更新' : '创建' }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <!-- Delete Confirmation Dialog -->
    <Dialog v-model:open="showDeleteDialog">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>确认删除环境？</DialogTitle>
          <DialogDescription>
            此操作将永久删除环境 "{{ deletingEnvironment?.name }}"。此操作无法撤销。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="showDeleteDialog = false">取消</Button>
          <Button variant="destructive" :disabled="isDeleting" @click="handleDelete">
            <Loader2 v-if="isDeleting" class="mr-2 h-4 w-4 animate-spin" />
            删除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </PageContainer>
</template>

<script setup lang="ts">
import PageContainer from '@/components/PageContainer.vue'
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useEnvironments } from '@/composables/useEnvironments'
import EnvironmentCard from '@/components/EnvironmentCard.vue'
import {
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
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
  Textarea,
} from '@juanie/ui'
import { Plus, Server, Loader2 } from 'lucide-vue-next'
import { Switch } from '@juanie/ui'

const route = useRoute()
const projectId = computed(() => route.params.projectId as string)

const {
  environments,
  isLoading,
  create,
  update,
  delete: deleteEnvironment,
  isCreating,
  isUpdating,
  isDeleting,
} = useEnvironments(projectId)

const showDialog = ref(false)
const showDeleteDialog = ref(false)
const isEditing = ref(false)
const editingEnvironment = ref<any>(null)
const deletingEnvironment = ref<any>(null)

const form = ref({
  name: '',
  type: 'development' as 'development' | 'staging' | 'production',
  description: '',
  url: '',
  gitopsEnabled: false,
  gitBranch: 'main',
  gitPath: './k8s',
  syncInterval: '5m',
  autoSync: true,
})

const openCreateDialog = () => {
  isEditing.value = false
  editingEnvironment.value = null
  form.value = {
    name: '',
    type: 'development',
    description: '',
    url: '',
    gitopsEnabled: false,
    gitBranch: 'main',
    gitPath: './k8s',
    syncInterval: '5m',
    autoSync: true,
  }
  showDialog.value = true
}

const openEditDialog = (environment: any) => {
  isEditing.value = true
  editingEnvironment.value = environment
  const gitopsConfig = environment.config?.gitops || {}
  form.value = {
    name: environment.name,
    type: environment.type,
    description: environment.description || '',
    url: environment.url || '',
    gitopsEnabled: gitopsConfig.enabled || false,
    gitBranch: gitopsConfig.gitBranch || 'main',
    gitPath: gitopsConfig.gitPath || './k8s',
    syncInterval: gitopsConfig.syncInterval || '5m',
    autoSync: gitopsConfig.autoSync !== false,
  }
  showDialog.value = true
}

const confirmDelete = (id: string) => {
  deletingEnvironment.value = environments.value.find((env: any) => env.id === id)
  showDeleteDialog.value = true
}

const handleSubmit = () => {
  const { gitopsEnabled, gitBranch, gitPath, syncInterval, autoSync, ...baseForm } = form.value
  
  const payload = {
    ...baseForm,
    config: {
      gitops: gitopsEnabled ? {
        enabled: true,
        gitBranch,
        gitPath,
        syncInterval,
        autoSync,
      } : undefined,
    },
  }
  
  if (isEditing.value && editingEnvironment.value) {
    update({
      environmentId: editingEnvironment.value.id,
      ...payload,
    })
  } else {
    create({
      projectId: projectId.value,
      ...payload,
    })
  }
  showDialog.value = false
}

const handleDelete = () => {
  if (deletingEnvironment.value) {
    deleteEnvironment({ environmentId: deletingEnvironment.value.id })
    showDeleteDialog.value = false
    deletingEnvironment.value = null
  }
}
</script>
