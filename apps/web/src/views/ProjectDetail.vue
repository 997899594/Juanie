<template>
  <div
    v-motion
    :initial="{ opacity: 0, y: 20 }"
    :enter="{ opacity: 1, y: 0, transition: { duration: 300, ease: 'easeOut' } }"
    class="container mx-auto p-6 space-y-6"
  >
    <!-- 加载状态 -->
    <div v-if="loading && !currentProject" class="flex items-center justify-center h-64">
      <Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
    </div>

    <!-- 项目详情 -->
    <template v-else-if="currentProject">
      <!-- 页面头部 -->
      <div
        v-motion
        :initial="{ opacity: 0, x: -20 }"
        :enter="{ opacity: 1, x: 0, transition: { duration: 300, delay: 100 } }"
        class="flex items-center justify-between"
      >
        <div class="flex items-center space-x-4">
          <Button variant="ghost" size="sm" @click="router.back()">
            <ArrowLeft class="h-4 w-4" />
          </Button>
          <div>
            <h1 class="text-3xl font-bold tracking-tight">{{ currentProject.name }}</h1>
            <p class="text-muted-foreground">@{{ currentProject.slug }}</p>
          </div>
        </div>
        <Button variant="outline" @click="openEditModal">
          <Settings class="mr-2 h-4 w-4" />
          设置
        </Button>
      </div>

      <!-- 标签页 -->
      <Tabs :default-value="activeTab" @update:model-value="(value) => activeTab = String(value)">
        <TabsList class="grid w-full grid-cols-8">
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="topology">资源拓扑</TabsTrigger>
          <TabsTrigger value="environments">环境</TabsTrigger>
          <TabsTrigger value="gitops">GitOps</TabsTrigger>
          <TabsTrigger value="pipelines">Pipeline</TabsTrigger>
          <TabsTrigger value="deployments">部署</TabsTrigger>
          <TabsTrigger value="members">成员</TabsTrigger>
          <TabsTrigger value="settings">设置</TabsTrigger>
        </TabsList>

        <!-- 概览标签 -->
        <TabsContent value="overview" class="space-y-4">
          <!-- 项目初始化进度 -->
          <Card v-if="projectStatus?.project.status === 'initializing' || projectStatus?.project.status === 'failed'">
            <CardHeader>
              <CardTitle>项目初始化</CardTitle>
              <CardDescription>
                正在为您配置项目资源和环境
              </CardDescription>
            </CardHeader>
            <CardContent>
              <InitializationProgress 
                :project-id="projectId"
                @complete="handleInitializationComplete"
                @error="handleInitializationError"
              />
            </CardContent>
          </Card>

          <!-- 健康度概览 -->
          <Card v-if="projectStatus?.health && projectStatus.project.status === 'active'">
            <CardHeader class="pb-3">
              <div class="flex items-center justify-between">
                <CardTitle class="text-base">项目健康度</CardTitle>
                <Badge 
                  :variant="getHealthVariant(projectStatus.health.status)"
                  class="text-xs"
                >
                  {{ getHealthLabel(projectStatus.health.status) }}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div class="flex items-baseline gap-2 mb-2">
                <span class="text-3xl font-bold">{{ projectStatus.health.score }}</span>
                <span class="text-sm text-muted-foreground">/100</span>
              </div>
              <div class="w-full bg-secondary rounded-full h-2">
                <div 
                  class="h-2 rounded-full transition-all"
                  :class="getHealthBarColor(projectStatus.health.status)"
                  :style="{ width: `${projectStatus.health.score}%` }"
                />
              </div>
              
              <!-- 健康度因素 -->
              <div v-if="projectStatus.health.factors" class="mt-4 pt-4 border-t">
                <p class="text-sm font-medium mb-3">健康度指标</p>
                <div class="grid grid-cols-2 gap-3">
                  <div class="space-y-1">
                    <div class="flex items-center justify-between text-xs">
                      <span class="text-muted-foreground">部署成功率</span>
                      <span class="font-medium">{{ Math.round(projectStatus.health.factors.deploymentSuccessRate) }}%</span>
                    </div>
                    <div class="w-full bg-secondary rounded-full h-1.5">
                      <div 
                        class="h-1.5 rounded-full bg-blue-500 transition-all"
                        :style="{ width: `${projectStatus.health.factors.deploymentSuccessRate}%` }"
                      />
                    </div>
                  </div>
                  <div class="space-y-1">
                    <div class="flex items-center justify-between text-xs">
                      <span class="text-muted-foreground">GitOps 状态</span>
                      <Badge 
                        :variant="getGitOpsStatusVariant(projectStatus.health.factors.gitopsSyncStatus)"
                        class="text-xs h-5"
                      >
                        {{ getGitOpsStatusLabel(projectStatus.health.factors.gitopsSyncStatus) }}
                      </Badge>
                    </div>
                  </div>
                  <div class="space-y-1">
                    <div class="flex items-center justify-between text-xs">
                      <span class="text-muted-foreground">Pod 健康</span>
                      <Badge 
                        :variant="getPodStatusVariant(projectStatus.health.factors.podHealthStatus)"
                        class="text-xs h-5"
                      >
                        {{ getPodStatusLabel(projectStatus.health.factors.podHealthStatus) }}
                      </Badge>
                    </div>
                  </div>
                  <div class="space-y-1">
                    <div class="flex items-center justify-between text-xs">
                      <span class="text-muted-foreground">最后部署</span>
                      <span class="font-medium">{{ projectStatus.health.factors.lastDeploymentAge }} 天前</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- 关键问题提示 -->
              <div v-if="projectStatus.health.issues && projectStatus.health.issues.length > 0" class="mt-4 pt-4 border-t">
                <p class="text-sm font-medium mb-2">发现 {{ projectStatus.health.issues.length }} 个问题</p>
                <div class="space-y-2">
                  <div 
                    v-for="issue in projectStatus.health.issues.slice(0, 2)" 
                    :key="issue.message"
                    class="flex items-start gap-2 text-sm"
                  >
                    <AlertCircle 
                      class="h-4 w-4 mt-0.5 flex-shrink-0"
                      :class="{
                        'text-red-500': issue.severity === 'critical',
                        'text-yellow-500': issue.severity === 'warning',
                        'text-blue-500': issue.severity === 'info'
                      }"
                    />
                    <span class="text-muted-foreground">{{ issue.message }}</span>
                  </div>
                  <Button 
                    v-if="projectStatus.health.issues.length > 2"
                    variant="ghost" 
                    size="sm" 
                    class="w-full mt-2"
                    @click="activeTab = 'health'"
                  >
                    查看全部 {{ projectStatus.health.issues.length }} 个问题
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <!-- 统计卡片 -->
          <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader class="pb-2">
                <CardDescription>环境数量</CardDescription>
                <CardTitle class="text-3xl">
                  {{ projectStatus?.environments.length || 0 }}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader class="pb-2">
                <CardDescription>部署次数</CardDescription>
                <CardTitle class="text-3xl">
                  {{ projectStatus?.stats.totalDeployments || 0 }}
                </CardTitle>
              </CardHeader>
              <CardContent v-if="projectStatus?.stats.totalDeployments" class="pb-2">
                <p class="text-xs text-muted-foreground">
                  成功率: {{ calculateSuccessRate(projectStatus.stats) }}%
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader class="pb-2">
                <CardDescription>GitOps 资源</CardDescription>
                <CardTitle class="text-3xl">
                  {{ projectStatus?.gitopsResources.length || 0 }}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader class="pb-2">
                <CardDescription>资源使用</CardDescription>
                <CardTitle class="text-3xl">
                  {{ projectStatus?.resourceUsage?.pods || 0 }}
                </CardTitle>
              </CardHeader>
              <CardContent class="pb-2">
                <p class="text-xs text-muted-foreground">Pods 运行中</p>
                <div v-if="projectStatus?.resourceUsage" class="mt-2 space-y-1">
                  <div class="flex justify-between text-xs">
                    <span class="text-muted-foreground">CPU</span>
                    <span class="font-medium">{{ projectStatus.resourceUsage.cpu || '-' }}</span>
                  </div>
                  <div class="flex justify-between text-xs">
                    <span class="text-muted-foreground">内存</span>
                    <span class="font-medium">{{ projectStatus.resourceUsage.memory || '-' }}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <!-- 项目信息 -->
          <Card>
            <CardHeader>
              <CardTitle>项目信息</CardTitle>
            </CardHeader>
            <CardContent class="space-y-2">
              <div class="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span class="text-muted-foreground">项目名称</span>
                  <p class="font-medium">{{ currentProject.name }}</p>
                </div>
                <div>
                  <span class="text-muted-foreground">项目标识</span>
                  <p class="font-medium">{{ currentProject.slug }}</p>
                </div>
                <div>
                  <span class="text-muted-foreground">描述</span>
                  <p class="font-medium">{{ currentProject.description || '-' }}</p>
                </div>
                <div>
                  <span class="text-muted-foreground">状态</span>
                  <Badge :variant="getStatusVariant(currentProject.status)">
                    {{ getStatusLabel(currentProject.status) }}
                  </Badge>
                </div>
                <div v-if="projectStatus?.project.templateId">
                  <span class="text-muted-foreground">使用模板</span>
                  <p class="font-medium">{{ projectStatus.project.templateId }}</p>
                </div>
                <div>
                  <span class="text-muted-foreground">创建时间</span>
                  <p class="font-medium">{{ formatDate(currentProject.createdAt) }}</p>
                </div>
                <div v-if="projectStatus?.stats?.lastDeploymentAt">
                  <span class="text-muted-foreground">最后部署</span>
                  <p class="font-medium">{{ formatDate(projectStatus.stats.lastDeploymentAt) }}</p>
                </div>
                <div>
                  <span class="text-muted-foreground">成员数量</span>
                  <p class="font-medium">{{ members.length }}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <!-- 关联资源概览 -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Git 仓库 -->
            <Card>
              <CardHeader>
                <CardTitle class="text-base">Git 仓库</CardTitle>
              </CardHeader>
              <CardContent>
                <div v-if="projectStatus?.repository" class="space-y-3">
                  <div class="flex items-start gap-3">
                    <div class="rounded-full bg-primary/10 p-2">
                      <GitBranch class="h-4 w-4 text-primary" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 mb-1">
                        <span class="font-medium truncate">{{ projectStatus.repository.fullName }}</span>
                        <Badge variant="outline" class="text-xs">{{ projectStatus.repository.provider }}</Badge>
                      </div>
                      <p v-if="projectStatus.repository.defaultBranch" class="text-xs text-muted-foreground">
                        默认分支: {{ projectStatus.repository.defaultBranch }}
                      </p>
                      <a 
                        v-if="projectStatus.repository.cloneUrl"
                        :href="projectStatus.repository.cloneUrl" 
                        target="_blank"
                        class="text-xs text-primary hover:underline mt-1 inline-block"
                      >
                        查看仓库 →
                      </a>
                    </div>
                  </div>
                </div>
                <div v-else class="text-center py-6">
                  <GitBranch class="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p class="text-sm text-muted-foreground">暂无关联仓库</p>
                </div>
              </CardContent>
            </Card>

            <!-- 环境列表 -->
            <Card>
              <CardHeader>
                <div class="flex items-center justify-between">
                  <CardTitle class="text-base">环境</CardTitle>
                  <Button variant="ghost" size="sm" @click="activeTab = 'environments'">
                    查看全部
                    <ChevronRight class="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div v-if="projectStatus?.environments && projectStatus.environments.length" class="space-y-3">
                  <div 
                    v-for="env in projectStatus.environments.slice(0, 3)" 
                    :key="env.id"
                    class="flex items-start gap-2 text-sm p-2 rounded-lg hover:bg-accent transition-colors"
                  >
                    <Server class="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2">
                        <span class="font-medium">{{ env.name }}</span>
                        <Badge 
                          :variant="getEnvironmentTypeVariant(env.type)" 
                          class="text-xs"
                        >
                          {{ getEnvironmentTypeLabel(env.type) }}
                        </Badge>
                      </div>
                      <p v-if="env.namespace" class="text-xs text-muted-foreground mt-0.5">
                        命名空间: {{ env.namespace }}
                      </p>
                    </div>
                  </div>
                  <Button 
                    v-if="projectStatus.environments.length > 3"
                    variant="ghost" 
                    size="sm" 
                    class="w-full"
                    @click="activeTab = 'environments'"
                  >
                    查看全部 {{ projectStatus.environments.length }} 个环境
                  </Button>
                </div>
                <div v-else class="text-center py-4">
                  <Server class="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p class="text-sm text-muted-foreground">暂无环境配置</p>
                  <Button variant="outline" size="sm" class="mt-2" @click="activeTab = 'environments'">
                    创建环境
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <!-- GitOps 资源概览 -->
          <Card v-if="projectStatus?.gitopsResources && projectStatus.gitopsResources.length">
            <CardHeader>
              <div class="flex items-center justify-between">
                <CardTitle class="text-base">GitOps 资源</CardTitle>
                <Button variant="ghost" size="sm" @click="activeTab = 'gitops'">
                  查看全部
                  <ChevronRight class="ml-1 h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div class="space-y-3">
                <div 
                  v-for="resource in projectStatus.gitopsResources.slice(0, 3)" 
                  :key="resource.id"
                  class="flex items-start gap-2 text-sm p-2 rounded-lg hover:bg-accent transition-colors"
                >
                  <GitBranch class="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="font-medium">{{ resource.name }}</span>
                      <Badge variant="outline" class="text-xs">{{ resource.kind }}</Badge>
                      <Badge 
                        :variant="getGitOpsResourceStatusVariant(resource.status)"
                        class="text-xs"
                      >
                        {{ resource.status }}
                      </Badge>
                    </div>
                    <p v-if="resource.namespace" class="text-xs text-muted-foreground mt-0.5">
                      {{ resource.namespace }}
                    </p>
                  </div>
                </div>
                <Button 
                  v-if="projectStatus.gitopsResources.length > 3"
                  variant="ghost" 
                  size="sm" 
                  class="w-full"
                  @click="activeTab = 'gitops'"
                >
                  查看全部 {{ projectStatus.gitopsResources.length }} 个资源
                </Button>
              </div>
            </CardContent>
          </Card>

          <!-- 待审批部署 -->
          <Card v-if="pendingApprovals && pendingApprovals.length > 0">
            <CardHeader>
              <div class="flex items-center justify-between">
                <div>
                  <CardTitle class="text-base">待审批部署</CardTitle>
                  <CardDescription>需要您审批的生产环境部署</CardDescription>
                </div>
                <Button variant="ghost" size="sm" @click="activeTab = 'deployments'">
                  查看全部
                  <ChevronRight class="ml-1 h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div class="space-y-3">
                <div 
                  v-for="approval in pendingApprovals.slice(0, 2)" 
                  :key="approval.id"
                  class="p-3 rounded-lg border bg-card"
                >
                  <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center gap-2">
                      <Badge variant="secondary" class="text-xs">待审批</Badge>
                      <span class="text-sm font-medium">
                        {{ approval.deployment?.name || '部署请求' }}
                      </span>
                    </div>
                    <div class="flex gap-1">
                      <Button size="sm" variant="ghost" @click="handleApproveQuick(approval.id)">
                        <Check class="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" @click="handleRejectQuick(approval.id)">
                        <X class="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div class="text-xs text-muted-foreground">
                    <p>环境: {{ approval.deployment?.environment || '-' }}</p>
                    <p>申请时间: {{ formatDate(approval.createdAt) }}</p>
                  </div>
                </div>
                <Button 
                  v-if="pendingApprovals.length > 2"
                  variant="ghost" 
                  size="sm" 
                  class="w-full"
                  @click="activeTab = 'deployments'"
                >
                  查看全部 {{ pendingApprovals.length }} 个待审批
                </Button>
              </div>
            </CardContent>
          </Card>

          <!-- 项目配置 -->
          <Card v-if="currentProject.config">
            <CardHeader>
              <CardTitle>项目配置</CardTitle>
            </CardHeader>
            <CardContent class="space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-sm">默认分支</span>
                <Badge>{{ currentProject.config.defaultBranch || 'main' }}</Badge>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-sm">CI/CD</span>
                <Badge :variant="currentProject.config.enableCiCd ? 'default' : 'outline'">
                  {{ currentProject.config.enableCiCd ? '已启用' : '未启用' }}
                </Badge>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-sm">AI 辅助</span>
                <Badge :variant="currentProject.config.enableAi ? 'default' : 'outline'">
                  {{ currentProject.config.enableAi ? '已启用' : '未启用' }}
                </Badge>
              </div>
              <div v-if="projectStatus?.project.config.quota" class="pt-2 border-t">
                <p class="text-sm font-medium mb-2">资源配额</p>
                <div class="grid grid-cols-2 gap-2 text-xs">
                  <div class="flex justify-between">
                    <span class="text-muted-foreground">最大环境数</span>
                    <span>{{ projectStatus.project.config.quota.maxEnvironments }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-muted-foreground">最大 Pod 数</span>
                    <span>{{ projectStatus.project.config.quota.maxPods }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-muted-foreground">CPU 限制</span>
                    <span>{{ projectStatus.project.config.quota.maxCpu }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-muted-foreground">内存限制</span>
                    <span>{{ projectStatus.project.config.quota.maxMemory }}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <!-- 资源拓扑标签 -->
        <TabsContent value="topology">
          <ResourceTopology :project-status="projectStatus" />
        </TabsContent>





        <!-- 环境标签 -->
        <TabsContent value="environments">
          <EnvironmentsTab :project-id="projectId" />
        </TabsContent>

        <!-- GitOps 标签 -->
        <TabsContent value="gitops">
          <Card>
            <CardHeader>
              <div class="flex items-center justify-between">
                <div>
                  <CardTitle>GitOps 资源</CardTitle>
                  <CardDescription>
                    管理项目的 GitOps 资源和自动化部署配置
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" @click="router.push(`/gitops/resources?project=${projectId}`)">
                  <ExternalLink class="mr-2 h-4 w-4" />
                  详细视图
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div v-if="projectStatus?.gitopsResources && projectStatus.gitopsResources.length > 0" class="space-y-4">
                <!-- 说明提示 -->
                <div class="rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <p class="text-xs text-blue-700">
                    GitOps 资源用于自动化部署。每个环境包含 2 个资源：
                    <span class="font-medium">git-repository</span>（Git 仓库连接）和 
                    <span class="font-medium">kustomization</span>（部署配置）
                  </p>
                </div>

                <!-- 按环境分组显示 -->
                <div v-for="env in getUniqueEnvironments(projectStatus.gitopsResources)" :key="env" class="space-y-2">
                  <div class="flex items-center gap-2 mb-2">
                    <Server class="h-4 w-4 text-muted-foreground" />
                    <span class="text-sm font-medium">{{ getEnvironmentLabel(env) }}</span>
                  </div>
                  <div class="ml-6 space-y-2">
                    <div
                      v-for="resource in getResourcesByEnvironment(projectStatus.gitopsResources, env)"
                      :key="resource.id"
                      class="flex items-center justify-between rounded-lg border p-3 text-sm"
                    >
                      <div class="flex items-center gap-2">
                        <GitBranch class="h-3.5 w-3.5 text-muted-foreground" />
                        <div>
                          <span class="font-medium">{{ getResourceTypeLabel(resource.type) }}</span>
                          <span class="text-xs text-muted-foreground ml-2">{{ resource.namespace }}</span>
                        </div>
                      </div>
                      <Badge :variant="getResourceStatusVariant(resource.status)" class="text-xs">
                        {{ resource.status || 'pending' }}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
              <div v-else class="text-center py-8">
                <GitBranch class="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p class="text-sm text-muted-foreground mb-4">
                  暂无 GitOps 资源
                </p>
                <p class="text-xs text-muted-foreground">
                  GitOps 资源会在项目初始化完成后自动创建
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <!-- Pipeline 标签 -->
        <TabsContent value="pipelines">
          <PipelinesTab :project-id="projectId" />
        </TabsContent>

        <!-- 部署标签 -->
        <TabsContent value="deployments">
          <DeploymentsTab :project-id="projectId" />
        </TabsContent>

        <!-- 成员标签 -->
        <TabsContent value="members" class="space-y-6">
          <ProjectMemberTable
            :members="members"
            :loading="loading"
            @add="openAddMemberModal"
            @update-role="handleUpdateMemberRole"
            @remove="confirmRemoveMember"
          />
          
          <!-- Git 同步状态 -->
          <GitSyncStatus :project-id="projectId" />
        </TabsContent>

        <!-- 设置标签 -->
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>项目设置</CardTitle>
              <CardDescription>管理项目的基本信息和配置</CardDescription>
            </CardHeader>
            <CardContent class="space-y-4">
              <Button variant="outline" @click="openEditModal">
                <Edit class="mr-2 h-4 w-4" />
                编辑项目信息
              </Button>
              <div class="pt-4 border-t">
                <h4 class="text-sm font-semibold text-destructive mb-2">危险操作</h4>
                <Button variant="destructive" @click="confirmDelete">
                  <Trash2 class="mr-2 h-4 w-4" />
                  删除项目
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </template>

    <!-- 编辑项目对话框 -->
    <EditProjectModal
      v-if="isEditModalOpen && currentProject"
      :project="currentProject"
      @close="isEditModalOpen = false"
      @updated="handleProjectUpdated"
    />

    <!-- 删除确认对话框 -->
    <Dialog :open="isDeleteDialogOpen" @update:open="isDeleteDialogOpen = $event">
      <DialogContent class="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>确认删除项目？</DialogTitle>
          <DialogDescription>
            此操作将永久删除项目 "{{ currentProject?.name }}" 及其所有数据。此操作无法撤销。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="isDeleteDialogOpen = false">取消</Button>
          <Button variant="destructive" @click="handleDelete">删除</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Badge,
} from '@juanie/ui'
import {
  ArrowLeft,
  Settings,
  GitBranch,
  Server,
  Edit,
  Trash2,
  Loader2,
  AlertCircle,
  ChevronRight,
  Activity,
  Check,
  X,
  ExternalLink,
} from 'lucide-vue-next'
import { format } from 'date-fns'
import { useProjectCRUD, useProjectMembers, useProjectTeams } from '@/composables/useProjects'
import { trpc } from '@/lib/trpc'
import EditProjectModal from '@/components/EditProjectModal.vue'
import ProjectMemberTable from '@/components/ProjectMemberTable.vue'
import EnvironmentsTab from '@/components/EnvironmentsTab.vue'
import PipelinesTab from '@/components/PipelinesTab.vue'
import DeploymentsTab from '@/components/DeploymentsTab.vue'
import ResourceTopology from '@/components/ResourceTopology.vue'
import InitializationProgress from '@/components/InitializationProgress.vue'
import GitSyncStatus from '@/components/GitSyncStatus.vue'

const route = useRoute()
const router = useRouter()
const projectId = String(route.params.id)

// 使用 TanStack Query - 自动获取数据
const { useProjectQuery, updateProject, deleteProject } = useProjectCRUD()
const { useMembersQuery, updateMemberRole, removeMember } = useProjectMembers()
const { useTeamsQuery } = useProjectTeams()

// 查询项目详情
const { data: currentProject, isLoading: loadingProject } = useProjectQuery(projectId)

// 查询项目成员
const { data: members, isLoading: loadingMembers } = useMembersQuery(projectId)

// 查询项目团队
const { data: teams, isLoading: loadingTeams } = useTeamsQuery(projectId)

// 综合加载状态
const loading = computed(() => loadingProject.value || loadingMembers.value || loadingTeams.value)

// 项目状态数据
const projectStatus = ref<any>(null)
const loadingStatus = ref(false)

// 审批数据
const pendingApprovals = ref<any[]>([])
const loadingApprovals = ref(false)

// 状态
const activeTab = ref('overview')
const isEditModalOpen = ref(false)
const isDeleteDialogOpen = ref(false)
const removingMemberId = ref<string | null>(null)



// 初始化 - TanStack Query 会自动获取数据
onMounted(async () => {
  await loadProjectStatus()
  await loadPendingApprovals()
})

// 监听路由变化
watch(
  () => route.params.id,
  async (newId) => {
    if (newId) {
      // TanStack Query 会自动重新获取数据
      await loadProjectStatus()
      await loadPendingApprovals()
    }
  }
)

async function loadProjectStatus() {
  loadingStatus.value = true
  try {
    projectStatus.value = await trpc.projects.getStatus.query({ projectId })
  } catch (error) {
    log.error('Failed to load project status:', error)
  } finally {
    loadingStatus.value = false
  }
}

function openEditModal() {
  isEditModalOpen.value = true
}

function confirmDelete() {
  isDeleteDialogOpen.value = true
}

function openAddMemberModal() {
  // TODO: 实现添加成员对话框
}

function confirmRemoveMember(memberId: string) {
  removingMemberId.value = memberId
  // TODO: 实现移除成员确认对话框
}

async function handleUpdate(data: any) {
  try {
    await updateProject(projectId, data)
    isEditModalOpen.value = false
  } catch (error) {
    log.error('Failed to update project:', error)
  }
}

async function handleProjectUpdated() {
  isEditModalOpen.value = false
  // TanStack Query 会自动刷新数据（通过 mutation 的 invalidateQueries）
  await loadProjectStatus()
  await loadPendingApprovals()
}

async function handleUpdateMemberRole(memberId: string, role: string) {
  try {
    await updateMemberRole(projectId, memberId, role as 'admin' | 'developer' | 'viewer')
  } catch (error) {
    log.error('Failed to update member role:', error)
  }
}

async function handleDelete() {
  try {
    await deleteProject(projectId)
    isDeleteDialogOpen.value = false
    router.push('/projects')
  } catch (error) {
    log.error('Failed to delete project:', error)
  }
}

function formatDate(dateString: string | Date): string {
  return format(new Date(dateString), 'yyyy-MM-dd HH:mm')
}

function handleInitializationComplete() {
  // 初始化完成，重新加载项目状态
  loadProjectStatus()
  loadPendingApprovals()
}

function handleInitializationError(error: string) {
  log.error('Initialization error:', error)
  // 可以显示错误提示
}

function calculateSuccessRate(stats: any): number {
  if (!stats.totalDeployments) return 0
  return Math.round((stats.successfulDeployments / stats.totalDeployments) * 100)
}

function getHealthVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'healthy':
      return 'default'
    case 'warning':
      return 'secondary'
    case 'critical':
      return 'destructive'
    default:
      return 'outline'
  }
}

function getHealthLabel(status: string): string {
  switch (status) {
    case 'healthy':
      return '健康'
    case 'warning':
      return '警告'
    case 'critical':
      return '严重'
    default:
      return '未知'
  }
}

function getHealthBarColor(status: string): string {
  switch (status) {
    case 'healthy':
      return 'bg-green-500'
    case 'warning':
      return 'bg-yellow-500'
    case 'critical':
      return 'bg-red-500'
    default:
      return 'bg-gray-500'
  }
}

function getStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'active':
      return 'default'
    case 'initializing':
      return 'secondary'
    case 'failed':
      return 'destructive'
    case 'archived':
      return 'outline'
    default:
      return 'outline'
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'active':
      return '活跃'
    case 'initializing':
      return '初始化中'
    case 'failed':
      return '失败'
    case 'archived':
      return '已归档'
    case 'inactive':
      return '未激活'
    case 'partial':
      return '部分成功'
    default:
      return status
  }
}

function getGitOpsStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'healthy':
      return 'default'
    case 'degraded':
      return 'secondary'
    case 'failed':
      return 'destructive'
    default:
      return 'outline'
  }
}

function getResourceStatusVariant(status: string | null): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (!status) return 'outline'
  const lowerStatus = status.toLowerCase()
  if (lowerStatus.includes('ready') || lowerStatus.includes('success')) return 'default'
  if (lowerStatus.includes('pending') || lowerStatus.includes('progressing')) return 'secondary'
  if (lowerStatus.includes('failed') || lowerStatus.includes('error')) return 'destructive'
  return 'outline'
}

function getGitOpsStatusLabel(status: string): string {
  switch (status) {
    case 'healthy':
      return '正常'
    case 'degraded':
      return '降级'
    case 'failed':
      return '失败'
    default:
      return '未知'
  }
}

function getPodStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'healthy':
      return 'default'
    case 'degraded':
      return 'secondary'
    case 'failed':
      return 'destructive'
    default:
      return 'outline'
  }
}

function getPodStatusLabel(status: string): string {
  switch (status) {
    case 'healthy':
      return '健康'
    case 'degraded':
      return '部分异常'
    case 'failed':
      return '异常'
    default:
      return '未知'
  }
}

function getUniqueEnvironments(resources: any[]): string[] {
  const envs = new Set<string>()
  resources.forEach(r => {
    // 从 namespace 中提取环境名称，格式如: project-xxx-development
    const match = r.namespace?.match(/-(\w+)$/)
    if (match) envs.add(match[1])
  })
  return Array.from(envs).sort()
}

function getResourcesByEnvironment(resources: any[], env: string): any[] {
  return resources.filter(r => r.namespace?.endsWith(`-${env}`))
}

function getEnvironmentLabel(env: string): string {
  const labels: Record<string, string> = {
    development: '开发环境',
    staging: '预发布环境',
    production: '生产环境',
    testing: '测试环境'
  }
  return labels[env] || env
}

function getResourceTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    'git-repository': 'Git 仓库连接',
    'kustomization': '部署配置',
    'helm': 'Helm 发布'
  }
  return labels[type] || type
}

function getEnvironmentTypeVariant(type: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (type) {
    case 'production':
      return 'destructive'
    case 'staging':
      return 'secondary'
    case 'development':
      return 'default'
    default:
      return 'outline'
  }
}

function getEnvironmentTypeLabel(type: string): string {
  switch (type) {
    case 'production':
      return '生产'
    case 'staging':
      return '测试'
    case 'development':
      return '开发'
    default:
      return type
  }
}

function getGitOpsResourceStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'ready':
    case 'reconciling':
      return 'default'
    case 'failed':
      return 'destructive'
    default:
      return 'outline'
  }
}

async function loadPendingApprovals() {
  loadingApprovals.value = true
  try {
    // TODO: 实现获取待审批列表的 API 调用
    // pendingApprovals.value = await trpc.approvals.listPending.query({ projectId })
    
    // 临时模拟数据
    pendingApprovals.value = []
  } catch (error) {
    log.error('Failed to load pending approvals:', error)
  } finally {
    loadingApprovals.value = false
  }
}

function handleApproveQuick(approvalId: string) {
  // TODO: 实现快速批准逻辑
  log.info('Quick approve:', approvalId)
  // 可以打开一个简单的确认对话框或直接批准
}

function handleRejectQuick(approvalId: string) {
  // TODO: 实现快速拒绝逻辑
  log.info('Quick reject:', approvalId)
  // 应该打开一个对话框要求输入拒绝原因
}
</script>
