<template>
  <PageContainer title="GitOps 设置" description="管理 Flux v2 安装和配置">
    <!-- 错误状态 -->
    <ErrorState
      v-if="error && !loading"
      title="加载失败"
      :message="error"
      @retry="loadFluxStatus"
    />

    <!-- 加载状态 -->
    <LoadingState v-else-if="loading" message="加载 Flux 状态中..." />

    <!-- 主要内容 -->
    <div v-else class="space-y-6">
      <!-- Flux 安装状态卡片 -->
      <Card>
        <CardHeader>
          <div class="flex items-center justify-between">
            <div>
              <CardTitle>Flux 安装状态</CardTitle>
              <CardDescription>查看 Flux v2 的安装和运行状态</CardDescription>
            </div>
            <Badge
              :variant="fluxStatus?.installed ? 'default' : 'secondary'"
              class="text-sm"
            >
              {{ fluxStatus?.installed ? '已安装' : '未安装' }}
            </Badge>
          </div>
        </CardHeader>
        <CardContent class="space-y-4">
          <!-- 安装信息 -->
          <div v-if="fluxStatus?.installed" class="space-y-3">
            <div class="flex items-center justify-between py-2 border-b">
              <span class="text-sm font-medium">版本</span>
              <span class="text-sm text-muted-foreground">
                {{ fluxStatus.version || 'N/A' }}
              </span>
            </div>
            <div class="flex items-center justify-between py-2 border-b">
              <span class="text-sm font-medium">命名空间</span>
              <span class="text-sm text-muted-foreground">
                {{ fluxStatus.namespace || 'flux-system' }}
              </span>
            </div>
            <div class="flex items-center justify-between py-2">
              <span class="text-sm font-medium">安装时间</span>
              <span class="text-sm text-muted-foreground">
                {{ fluxStatus.installedAt ? formatDate(fluxStatus.installedAt) : 'N/A' }}
              </span>
            </div>
          </div>

          <!-- 未安装提示 -->
          <div v-else class="py-6">
            <EmptyState
              :icon="GitBranch"
              title="Flux 未安装"
              description="安装 Flux v2 以启用 GitOps 功能"
            />
          </div>

          <!-- 操作按钮 -->
          <div class="flex gap-3 pt-4">
            <Button
              v-if="!fluxStatus?.installed"
              @click="handleInstallFlux"
              :disabled="installing"
            >
              <Download v-if="!installing" class="mr-2 h-4 w-4" />
              <Loader2 v-else class="mr-2 h-4 w-4 animate-spin" />
              {{ installing ? '安装中...' : '安装 Flux' }}
            </Button>
            <Button
              v-else
              variant="outline"
              @click="loadFluxStatus"
              :disabled="loading"
            >
              <RefreshCw class="mr-2 h-4 w-4" :class="{ 'animate-spin': loading }" />
              刷新状态
            </Button>
            <Button
              v-if="fluxStatus?.installed"
              variant="destructive"
              @click="handleUninstallFlux"
              :disabled="uninstalling"
            >
              <Trash2 v-if="!uninstalling" class="mr-2 h-4 w-4" />
              <Loader2 v-else class="mr-2 h-4 w-4 animate-spin" />
              {{ uninstalling ? '卸载中...' : '卸载 Flux' }}
            </Button>
          </div>
        </CardContent>
      </Card>

      <!-- Flux 组件健康状态 -->
      <Card v-if="fluxStatus?.installed">
        <CardHeader>
          <CardTitle>组件健康状态</CardTitle>
          <CardDescription>Flux 核心组件的运行状态</CardDescription>
        </CardHeader>
        <CardContent>
          <div v-if="fluxStatus.components && fluxStatus.components.length > 0" class="space-y-3">
            <div
              v-for="component in fluxStatus.components"
              :key="component.name"
              class="flex items-center justify-between p-3 border rounded-lg"
            >
              <div class="flex items-center space-x-3">
                <div
                  :class="[
                    'h-2 w-2 rounded-full',
                    component.ready ? 'bg-green-500' : 'bg-red-500'
                  ]"
                />
                <div>
                  <p class="font-medium text-sm">{{ component.name }}</p>
                  <p class="text-xs text-muted-foreground">
                    {{ component.ready ? '运行正常' : '异常' }}
                  </p>
                </div>
              </div>
              <div class="text-right">
                <p class="text-sm text-muted-foreground">
                  {{ component.replicas || 0 }}/{{ component.desiredReplicas || 0 }} 副本
                </p>
              </div>
            </div>
          </div>
          <EmptyState
            v-else
            :icon="Server"
            title="无组件信息"
            description="无法获取 Flux 组件状态"
          />
        </CardContent>
      </Card>

      <!-- 配置信息 -->
      <Card v-if="fluxStatus?.installed">
        <CardHeader>
          <CardTitle>配置信息</CardTitle>
          <CardDescription>Flux 的配置和设置</CardDescription>
        </CardHeader>
        <CardContent>
          <div class="space-y-3">
            <div class="flex items-center justify-between py-2 border-b">
              <span class="text-sm font-medium">集群名称</span>
              <span class="text-sm text-muted-foreground">
                {{ fluxStatus.clusterName || 'default' }}
              </span>
            </div>
            <div class="flex items-center justify-between py-2 border-b">
              <span class="text-sm font-medium">同步间隔</span>
              <span class="text-sm text-muted-foreground">
                {{ fluxStatus.syncInterval || '1m' }}
              </span>
            </div>
            <div class="flex items-center justify-between py-2">
              <span class="text-sm font-medium">自动同步</span>
              <Badge :variant="fluxStatus.autoSync ? 'default' : 'secondary'">
                {{ fluxStatus.autoSync ? '启用' : '禁用' }}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  </PageContainer>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useGitOps } from '@/composables/useGitOps'
import PageContainer from '@/components/PageContainer.vue'
import LoadingState from '@/components/LoadingState.vue'
import EmptyState from '@/components/EmptyState.vue'
import ErrorState from '@/components/ErrorState.vue'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@juanie/ui'
import {
  Download,
  GitBranch,
  Loader2,
  RefreshCw,
  Server,
  Trash2,
} from 'lucide-vue-next'

const { loading, fluxHealth, installFlux, checkFluxHealth, uninstallFlux } = useGitOps()

// 状态
const installing = ref(false)
const uninstalling = ref(false)
const error = ref<string | null>(null)
const fluxStatus = ref<any>(null)

// 加载 Flux 状态
async function loadFluxStatus() {
  error.value = null
  try {
    const result = await checkFluxHealth()
    fluxStatus.value = result
  } catch (err: any) {
    error.value = err.message || '加载 Flux 状态失败'
    console.error('Failed to load Flux status:', err)
  }
}

// 安装 Flux
async function handleInstallFlux() {
  installing.value = true
  try {
    await installFlux({ namespace: 'flux-system' })
    await loadFluxStatus()
  } catch (err: any) {
    console.error('Failed to install Flux:', err)
  } finally {
    installing.value = false
  }
}

// 卸载 Flux
async function handleUninstallFlux() {
  if (!confirm('确定要卸载 Flux 吗？这将删除所有 GitOps 资源。')) {
    return
  }

  uninstalling.value = true
  try {
    await uninstallFlux()
    await loadFluxStatus()
  } catch (err: any) {
    console.error('Failed to uninstall Flux:', err)
  } finally {
    uninstalling.value = false
  }
}

// 格式化日期
function formatDate(date: string) {
  return new Date(date).toLocaleString('zh-CN')
}

// 初始化
onMounted(() => {
  loadFluxStatus()
})
</script>
