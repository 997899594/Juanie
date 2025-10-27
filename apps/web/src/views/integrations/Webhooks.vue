<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">Webhook 管理</h1>
        <p class="text-muted-foreground">
          外部系统集成和事件通知配置
        </p>
      </div>
      <Button>
        <Plus class="mr-2 h-4 w-4" />
        创建 Webhook
      </Button>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>功能开发中</CardTitle>
        <CardDescription>Webhook 管理功能正在开发中，敬请期待</CardDescription>
      </CardHeader>
      <CardContent>
        <div class="flex items-center justify-center h-64 text-muted-foreground">
          <div class="text-center">
            <Webhook class="h-16 w-16 mx-auto mb-4" />
            <p>Webhook 管理功能即将上线</p>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { Button } from '@juanie/ui'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@juanie/ui'
import { Webhook, Plus } from 'lucide-vue-next'
</script>