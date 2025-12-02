<template>
  <div class="container mx-auto p-6 space-y-6">
    <div>
      <h1 class="text-3xl font-bold tracking-tight">Git 账号管理</h1>
      <p class="text-muted-foreground mt-2">
        管理您的 GitHub 和 GitLab 账号关联
      </p>
    </div>

    <div class="grid gap-6 md:grid-cols-2">
      <!-- Git 账号关联 -->
      <GitAccountLinking />

      <!-- 使用说明 -->
      <Card>
        <CardHeader>
          <CardTitle>功能说明</CardTitle>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="space-y-2">
            <h4 class="text-sm font-medium">自动权限同步</h4>
            <p class="text-sm text-muted-foreground">
              关联 Git 账号后，当您被添加到项目时，系统会自动将您添加为 Git 仓库的协作者，权限与项目角色保持一致。
            </p>
          </div>

          <div class="space-y-2">
            <h4 class="text-sm font-medium">权限映射规则</h4>
            <div class="space-y-1 text-sm text-muted-foreground">
              <p>• <strong>Owner</strong> → Admin（管理员权限）</p>
              <p>• <strong>Admin</strong> → Maintain（维护权限）</p>
              <p>• <strong>Developer</strong> → Write（写入权限）</p>
              <p>• <strong>Viewer</strong> → Read（只读权限）</p>
            </div>
          </div>

          <div class="space-y-2">
            <h4 class="text-sm font-medium">支持的平台</h4>
            <div class="flex gap-2">
              <Badge variant="outline">
                <Github class="mr-1 h-3 w-3" />
                GitHub
              </Badge>
              <Badge variant="outline">
                <Gitlab class="mr-1 h-3 w-3" />
                GitLab
              </Badge>
            </div>
          </div>

          <div class="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
            <p class="text-xs text-yellow-700">
              <strong>注意：</strong>取消关联后，您将无法自动获得新项目的 Git 仓库访问权限，需要手动添加。
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@juanie/ui'
import { Github, Gitlab } from 'lucide-vue-next'
import GitAccountLinking from '@/components/GitAccountLinking.vue'
</script>
