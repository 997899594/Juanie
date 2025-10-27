<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">资源使用</h1>
        <p class="text-muted-foreground">
          实时资源使用监控和分析
        </p>
      </div>
      <Button>
        <Activity class="mr-2 h-4 w-4" />
        实时监控
      </Button>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>功能开发中</CardTitle>
        <CardDescription>资源使用监控功能正在开发中，敬请期待</CardDescription>
      </CardHeader>
      <CardContent>
        <div class="flex items-center justify-center h-64 text-muted-foreground">
          <div class="text-center">
            <Server class="h-16 w-16 mx-auto mb-4" />
            <p>资源使用监控功能即将上线</p>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { Button } from '@juanie/ui'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@juanie/ui'
import { Server, Activity } from 'lucide-vue-next'
</script>