<template>
  <div class="space-y-4">
    <!-- 拓扑视图说明 -->
    <div class="rounded-lg border border-blue-200 bg-blue-50 p-4">
      <div class="flex gap-3">
        <Network class="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div class="space-y-1">
          <p class="text-sm font-medium text-blue-900">资源拓扑关系</p>
          <p class="text-sm text-blue-700">
            展示项目的完整资源层级：环境 → GitOps 资源 → K8s 资源
          </p>
        </div>
      </div>
    </div>

    <!-- 资源拓扑树 -->
    <div v-if="projectStatus" class="space-y-4">
      <!-- 项目根节点 -->
      <Card>
        <CardHeader class="pb-3">
          <div class="flex items-center gap-3">
            <div class="p-2 rounded-lg bg-primary/10">
              <Folder class="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle class="text-lg">{{ projectStatus.project.name }}</CardTitle>
              <CardDescription>项目 ID: {{ projectStatus.project.id }}</CardDescription>
            </div>
            <Badge :variant="getStatusVariant(projectStatus.project.status)" class="ml-auto">
              {{ getStatusLabel(projectStatus.project.status) }}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div class="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span class="text-muted-foreground">环境数量</span>
              <p class="font-semibold">{{ projectStatus.environments.length }}</p>
            </div>
            <div>
              <span class="text-muted-foreground">GitOps 资源</span>
              <p class="font-semibold">{{ projectStatus.gitopsResources.length }}</p>
            </div>
            <div>
              <span class="text-muted-foreground">仓库数量</span>
              <p class="font-semibold">{{ projectStatus.repositories.length }}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- 环境层级 -->
      <div class="space-y-4">
        <div v-for="(env, envIndex) in projectStatus.environments" :key="env.id" class="ml-8">
          <Card>
            <CardHeader class="pb-3">
              <div class="flex items-center gap-3">
                <!-- 连接线 -->
                <div class="absolute -left-8 top-6 w-8 h-px bg-border" />
                <div 
                  v-if="envIndex < projectStatus.environments.length - 1"
                  class="absolute -left-8 top-6 w-px bg-border"
                  :style="{ height: `calc(100% + 1rem)` }"
                />
                
                <div class="p-2 rounded-lg" :class="getEnvironmentBgClass(env.type)">
                  <Server class="h-5 w-5" :class="getEnvironmentIconClass(env.type)" />
                </div>
                <div class="flex-1">
                  <div class="flex items-center gap-2">
                    <CardTitle class="text-base">{{ env.name }}</CardTitle>
                    <Badge :variant="getEnvironmentTypeVariant(env.type)" class="text-xs">
                      {{ getEnvironmentTypeLabel(env.type) }}
                    </Badge>
                  </div>
                  <CardDescription v-if="env.namespace">
                    命名空间: {{ env.namespace }}
                  </CardDescription>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  @click="toggleEnvironment(env.id)"
                >
                  <ChevronDown 
                    class="h-4 w-4 transition-transform"
                    :class="{ 'rotate-180': !expandedEnvironments.has(env.id) }"
                  />
                </Button>
              </div>
            </CardHeader>

            <!-- GitOps 资源层级 -->
            <CardContent v-if="expandedEnvironments.has(env.id)" class="pt-0">
              <div class="space-y-3 ml-4 pl-4 border-l-2 border-border">
                <div 
                  v-for="resource in getGitOpsResourcesByEnvironment(env.id)" 
                  :key="resource.id"
                  class="relative"
                >
                  <Card class="border-l-4" :class="getResourceBorderClass(resource.status)">
                    <CardContent class="p-4">
                      <div class="flex items-start gap-3">
                        <div class="p-2 rounded-lg bg-secondary">
                          <GitBranch class="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div class="flex-1 min-w-0">
                          <div class="flex items-center gap-2 mb-1">
                            <span class="font-medium text-sm">{{ resource.name }}</span>
                            <Badge variant="outline" class="text-xs">{{ resource.kind }}</Badge>
                            <Badge 
                              :variant="getGitOpsResourceStatusVariant(resource.status)"
                              class="text-xs"
                            >
                              {{ resource.status }}
                            </Badge>
                          </div>
                          <div class="space-y-1 text-xs text-muted-foreground">
                            <p v-if="resource.namespace">命名空间: {{ resource.namespace }}</p>
                            <p v-if="resource.sourceRef">
                              源: {{ resource.sourceRef.kind }}/{{ resource.sourceRef.name }}
                            </p>
                            <p v-if="resource.path">路径: {{ resource.path }}</p>
                          </div>
                          
                          <!-- K8s 资源信息 -->
                          <div v-if="resource.conditions && resource.conditions.length" class="mt-3 pt-3 border-t">
                            <p class="text-xs font-medium mb-2">K8s 资源状态</p>
                            <div class="space-y-1">
                              <div 
                                v-for="(condition, idx) in resource.conditions.slice(0, 3)" 
                                :key="idx"
                                class="flex items-center gap-2 text-xs"
                              >
                                <div 
                                  class="w-2 h-2 rounded-full"
                                  :class="{
                                    'bg-green-500': condition.status === 'True',
                                    'bg-red-500': condition.status === 'False',
                                    'bg-yellow-500': condition.status === 'Unknown'
                                  }"
                                />
                                <span class="font-medium">{{ condition.type }}:</span>
                                <span class="text-muted-foreground">{{ condition.message || condition.reason }}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          @click="showResourceDetails(resource)"
                        >
                          <Info class="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <!-- 无 GitOps 资源提示 -->
                <div 
                  v-if="getGitOpsResourcesByEnvironment(env.id).length === 0"
                  class="text-center py-6 text-sm text-muted-foreground"
                >
                  <GitBranch class="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>此环境暂无 GitOps 资源</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <!-- 仓库信息 -->
      <Card v-if="projectStatus.repositories.length > 0" class="ml-8">
        <CardHeader class="pb-3">
          <div class="flex items-center gap-3">
            <div class="absolute -left-8 top-6 w-8 h-px bg-border" />
            <div class="p-2 rounded-lg bg-purple-100">
              <GitBranch class="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <CardTitle class="text-base">关联仓库</CardTitle>
              <CardDescription>{{ projectStatus.repositories.length }} 个仓库</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div class="space-y-2">
            <div 
              v-for="repo in projectStatus.repositories" 
              :key="repo.id"
              class="flex items-center gap-2 p-2 rounded-lg hover:bg-accent transition-colors"
            >
              <Badge variant="outline" class="text-xs">{{ repo.provider }}</Badge>
              <span class="text-sm font-medium">{{ repo.fullName }}</span>
              <span v-if="repo.defaultBranch" class="text-xs text-muted-foreground">
                ({{ repo.defaultBranch }})
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- 加载状态 -->
    <div v-else class="flex items-center justify-center py-12">
      <Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
    </div>

    <!-- 资源详情对话框 -->
    <Dialog :open="!!selectedResource" @update:open="selectedResource = null">
      <DialogContent class="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{{ selectedResource?.name }}</DialogTitle>
          <DialogDescription>
            {{ selectedResource?.kind }} 资源详情
          </DialogDescription>
        </DialogHeader>
        <div v-if="selectedResource" class="space-y-4">
          <div class="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span class="text-muted-foreground">命名空间</span>
              <p class="font-medium">{{ selectedResource.namespace }}</p>
            </div>
            <div>
              <span class="text-muted-foreground">状态</span>
              <Badge :variant="getGitOpsResourceStatusVariant(selectedResource.status)">
                {{ selectedResource.status }}
              </Badge>
            </div>
            <div v-if="selectedResource.sourceRef">
              <span class="text-muted-foreground">源引用</span>
              <p class="font-medium">
                {{ selectedResource.sourceRef.kind }}/{{ selectedResource.sourceRef.name }}
              </p>
            </div>
            <div v-if="selectedResource.path">
              <span class="text-muted-foreground">路径</span>
              <p class="font-medium">{{ selectedResource.path }}</p>
            </div>
          </div>

          <div v-if="selectedResource.conditions && selectedResource.conditions.length">
            <h4 class="text-sm font-semibold mb-2">条件</h4>
            <div class="space-y-2">
              <div 
                v-for="(condition, idx) in selectedResource.conditions" 
                :key="idx"
                class="p-3 rounded-lg border"
              >
                <div class="flex items-center gap-2 mb-1">
                  <Badge :variant="condition.status === 'True' ? 'default' : 'destructive'">
                    {{ condition.type }}
                  </Badge>
                  <span class="text-xs text-muted-foreground">
                    {{ condition.status }}
                  </span>
                </div>
                <p v-if="condition.message" class="text-sm text-muted-foreground">
                  {{ condition.message }}
                </p>
                <p v-if="condition.reason" class="text-xs text-muted-foreground mt-1">
                  原因: {{ condition.reason }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@juanie/ui'
import {
  Network,
  Folder,
  Server,
  GitBranch,
  ChevronDown,
  Info,
  Loader2,
} from 'lucide-vue-next'

interface Props {
  projectStatus: any
}

const props = defineProps<Props>()

// 状态
const expandedEnvironments = ref(new Set<string>())
const selectedResource = ref<any>(null)

// 默认展开所有环境
if (props.projectStatus?.environments) {
  props.projectStatus.environments.forEach((env: any) => {
    expandedEnvironments.value.add(env.id)
  })
}

// 方法
function toggleEnvironment(envId: string) {
  if (expandedEnvironments.value.has(envId)) {
    expandedEnvironments.value.delete(envId)
  } else {
    expandedEnvironments.value.add(envId)
  }
}

function getGitOpsResourcesByEnvironment(envId: string) {
  if (!props.projectStatus?.gitopsResources) return []
  return props.projectStatus.gitopsResources.filter((r: any) => r.environmentId === envId)
}

function showResourceDetails(resource: any) {
  selectedResource.value = resource
}

function getStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'active':
      return 'default'
    case 'initializing':
      return 'secondary'
    case 'failed':
      return 'destructive'
    case 'archived':
      return 'outline'
    default:
      return 'outline'
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'active':
      return '活跃'
    case 'initializing':
      return '初始化中'
    case 'failed':
      return '失败'
    case 'archived':
      return '已归档'
    default:
      return status
  }
}

function getEnvironmentTypeVariant(type: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (type) {
    case 'production':
      return 'destructive'
    case 'staging':
      return 'secondary'
    case 'development':
      return 'default'
    default:
      return 'outline'
  }
}

function getEnvironmentTypeLabel(type: string): string {
  switch (type) {
    case 'production':
      return '生产'
    case 'staging':
      return '测试'
    case 'development':
      return '开发'
    default:
      return type
  }
}

function getEnvironmentBgClass(type: string): string {
  switch (type) {
    case 'production':
      return 'bg-red-100'
    case 'staging':
      return 'bg-yellow-100'
    case 'development':
      return 'bg-green-100'
    default:
      return 'bg-gray-100'
  }
}

function getEnvironmentIconClass(type: string): string {
  switch (type) {
    case 'production':
      return 'text-red-600'
    case 'staging':
      return 'text-yellow-600'
    case 'development':
      return 'text-green-600'
    default:
      return 'text-gray-600'
  }
}

function getGitOpsResourceStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'ready':
    case 'reconciling':
      return 'default'
    case 'failed':
      return 'destructive'
    default:
      return 'outline'
  }
}

function getResourceBorderClass(status: string): string {
  switch (status) {
    case 'ready':
      return 'border-l-green-500'
    case 'reconciling':
      return 'border-l-blue-500'
    case 'failed':
      return 'border-l-red-500'
    default:
      return 'border-l-gray-300'
  }
}
</script>
