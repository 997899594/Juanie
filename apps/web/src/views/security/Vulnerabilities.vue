<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">漏洞扫描</h1>
        <p class="text-muted-foreground">
          自动化安全漏洞检测和风险评估
        </p>
      </div>
      <Button>
        <Scan class="mr-2 h-4 w-4" />
        开始扫描
      </Button>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>功能开发中</CardTitle>
        <CardDescription>漏洞扫描功能正在开发中，敬请期待</CardDescription>
      </CardHeader>
      <CardContent>
        <div class="flex items-center justify-center h-64 text-muted-foreground">
          <div class="text-center">
            <AlertTriangle class="h-16 w-16 mx-auto mb-4" />
            <p>漏洞扫描功能即将上线</p>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { Button } from '@juanie/ui'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@juanie/ui'
import { AlertTriangle, Scan } from 'lucide-vue-next'
</script>