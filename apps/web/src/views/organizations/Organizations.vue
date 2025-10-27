<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">组织管理</h1>
        <p class="text-muted-foreground">
          多租户组织架构和权限管理
        </p>
      </div>
      <Button>
        <Plus class="mr-2 h-4 w-4" />
        创建组织
      </Button>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>功能开发中</CardTitle>
        <CardDescription>组织管理功能正在开发中，敬请期待</CardDescription>
      </CardHeader>
      <CardContent>
        <div class="flex items-center justify-center h-64 text-muted-foreground">
          <div class="text-center">
            <Building class="h-16 w-16 mx-auto mb-4" />
            <p>组织管理功能即将上线</p>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { Button } from '@juanie/ui'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@juanie/ui'
import { Building, Plus } from 'lucide-vue-next'
</script>