<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div class="mb-6">
      <h1 class="text-3xl font-bold text-foreground mb-2">监控与分析</h1>
      <p class="text-muted-foreground">性能监控与智能告警模块正在建设中。</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>即将支持</CardTitle>
        </CardHeader>
        <CardContent class="space-y-3">
          <ul class="list-disc list-inside text-sm text-muted-foreground space-y-1">
            <li>实时性能指标与趋势分析</li>
            <li>AI 异常检测与噪声抑制</li>
            <li>根因分析与自动化响应建议</li>
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>状态</CardTitle>
        </CardHeader>
        <CardContent>
          <p class="text-muted-foreground">前端占位完成，后续将接入后端监控数据源。</p>
        </CardContent>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Card, CardHeader, CardTitle, CardContent } from '@juanie/ui'
</script>