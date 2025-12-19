<template>
  <div class="container max-w-4xl py-8">
    <div class="space-y-6">
      <div>
        <h1 class="text-3xl font-bold">Git 认证配置</h1>
        <p class="text-muted-foreground mt-2">
          配置项目的 Git 仓库访问认证
        </p>
      </div>

      <!-- 当前状态 -->
      <GitAuthStatus 
        :project-id="projectId" 
        @configure="showConfig = true"
      />

      <!-- 配置界面 -->
      <GitAuthSelector
        v-if="showConfig"
        :project-id="projectId"
        :provider="provider"
        :is-organization="isOrganization"
        @success="handleSuccess"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import GitAuthStatus from '@/components/GitAuthStatus.vue'
import GitAuthSelector from '@/components/GitAuthSelector.vue'
import { useToast } from '@/composables/useToast'

const route = useRoute()
const toast = useToast()

const projectId = route.params.id as string
const provider = ref<'github' | 'gitlab'>('github') // 从项目信息获取
const isOrganization = ref(false) // 从项目信息获取
const showConfig = ref(false)

function handleSuccess() {
  showConfig.value = false
  
  toast.success('配置成功', 'Git 认证已更新')

  // 可选：跳转回项目详情
  // router.push(`/projects/${projectId}`)
}
</script>
