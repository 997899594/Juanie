<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div class="mb-6">
      <h1 class="text-3xl font-bold text-foreground mb-2">流水线</h1>
      <p class="text-muted-foreground">智能 CI/CD 流水线即将上线，敬请期待。</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>功能预览</CardTitle>
        </CardHeader>
        <CardContent class="space-y-3">
          <p class="text-muted-foreground">计划提供以下前沿能力：</p>
          <ul class="list-disc list-inside text-sm text-muted-foreground space-y-1">
            <li>自适应部署策略与智能回滚</li>
            <li>并行化优化与资源动态分配</li>
            <li>AI 驱动的质量守护与最佳实践建议</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>当前状态</CardTitle>
        </CardHeader>
        <CardContent>
          <p class="text-muted-foreground">开发中：正在设计与后端 `pipelines` 路由对接方案。</p>
        </CardContent>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Card, CardHeader, CardTitle, CardContent } from '@juanie/ui'
</script>