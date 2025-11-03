<template>
  <PageContainer title="监控与分析" description="性能监控与智能告警模块正在建设中。">

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
  </PageContainer>
</template>

<script setup lang="ts">
import PageContainer from '@/components/PageContainer.vue'
import { Card, CardHeader, CardTitle, CardContent } from '@juanie/ui'
</script>