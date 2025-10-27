<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">审计日志</h1>
        <p class="text-muted-foreground">
          系统操作审计和安全事件追踪
        </p>
      </div>
      <Button>
        <Download class="mr-2 h-4 w-4" />
        导出日志
      </Button>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>功能开发中</CardTitle>
        <CardDescription>审计日志功能正在开发中，敬请期待</CardDescription>
      </CardHeader>
      <CardContent>
        <div class="flex items-center justify-center h-64 text-muted-foreground">
          <div class="text-center">
            <FileSearch class="h-16 w-16 mx-auto mb-4" />
            <p>审计日志功能即将上线</p>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { Button } from '@juanie/ui'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@juanie/ui'
import { FileSearch, Download } from 'lucide-vue-next'
</script>