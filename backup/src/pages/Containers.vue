<template>
  <div class="containers-page">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-content">
        <div class="title-section">
          <h1 class="page-title">容器编排管理</h1>
          <p class="page-subtitle">管理Docker容器和Kubernetes集群资源</p>
        </div>
        <div class="header-actions">
          <n-button @click="refreshData" :loading="loading" circle>
            <template #icon>
              <RefreshCw :size="16" />
            </template>
          </n-button>
          <n-button @click="showClusterModal = true">
            <template #icon>
              <Settings :size="16" />
            </template>
            集群配置
          </n-button>
          <n-button type="primary" @click="showDeployModal = true">
            <template #icon>
              <Plus :size="16" />
            </template>
            部署应用
          </n-button>
        </div>
      </div>
    </div>

    <!-- 集群概览 -->
    <div class="clusters-overview">
      <div class="overview-header">
        <h3 class="overview-title">集群概览</h3>
        <div class="cluster-selector">
          <n-select
            v-model:value="selectedClusterId"
            :options="clusterOptions"
            placeholder="选择集群"
            @update:value="switchCluster"
          />
        </div>
      </div>
      
      <div class="cluster-stats">
        <div class="stat-card">
          <div class="stat-icon nodes">
            <Server :size="24" />
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ currentCluster?.nodes?.length || 0 }}</div>
            <div class="stat-label">节点数量</div>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon pods">
            <Box :size="24" />
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ totalPods }}</div>
            <div class="stat-label">Pod总数</div>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon services">
            <Network :size="24" />
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ totalServices }}</div>
            <div class="stat-label">服务数量</div>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon cpu">
            <Cpu :size="24" />
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ cpuUsage }}%</div>
            <div class="stat-label">CPU使用率</div>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon memory">
            <HardDrive :size="24" />
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ memoryUsage }}%</div>
            <div class="stat-label">内存使用率</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 主要内容区域 -->
    <div class="main-content">
      <!-- 左侧：资源列表 -->
      <div class="resources-section">
        <div class="section-tabs">
          <n-tabs v-model:value="activeTab" type="line" animated>
            <n-tab-pane name="pods" tab="Pods">
              <div class="resources-header">
                <div class="resources-filters">
                  <n-input
                    v-model:value="podSearchQuery"
                    placeholder="搜索Pod..."
                    clearable
                    size="small"
                    style="width: 200px"
                  >
                    <template #prefix>
                      <Search :size="16" />
                    </template>
                  </n-input>
                  <n-select
                    v-model:value="namespaceFilter"
                    :options="namespaceOptions"
                    placeholder="命名空间"
                    clearable
                    size="small"
                    style="width: 150px"
                  />
                  <n-select
                    v-model:value="podStatusFilter"
                    :options="podStatusOptions"
                    placeholder="状态"
                    clearable
                    size="small"
                    style="width: 120px"
                  />
                </div>
              </div>
              
              <div class="pods-list">
                <div
                  v-for="pod in filteredPods"
                  :key="pod.id"
                  class="pod-card"
                  :class="{ active: selectedResource?.id === pod.id }"
                  @click="selectResource(pod, 'pod')"
                >
                  <div class="pod-header">
                    <div class="pod-info">
                      <h4 class="pod-name">{{ pod.name }}</h4>
                      <p class="pod-namespace">{{ pod.namespace }}</p>
                    </div>
                    <div class="pod-status">
                      <n-tag
                        :type="getPodStatusType(pod.status)"
                        :bordered="false"
                        size="small"
                      >
                        {{ pod.status }}
                      </n-tag>
                    </div>
                  </div>
                  
                  <div class="pod-meta">
                    <div class="meta-item">
                      <Server :size="14" />
                      <span>{{ pod.node }}</span>
                    </div>
                    <div class="meta-item">
                      <Clock :size="14" />
                      <span>{{ formatTime(pod.createdAt) }}</span>
                    </div>
                    <div class="meta-item">
                      <Activity :size="14" />
                      <span>{{ pod.restarts }}次重启</span>
                    </div>
                  </div>
                  
                  <div class="pod-resources">
                    <div class="resource-item">
                      <span class="resource-label">CPU:</span>
                      <span class="resource-value">{{ pod.resources.cpu }}</span>
                    </div>
                    <div class="resource-item">
                      <span class="resource-label">内存:</span>
                      <span class="resource-value">{{ pod.resources.memory }}</span>
                    </div>
                  </div>
                  
                  <div class="pod-actions">
                    <n-dropdown
                      :options="getPodActions(pod)"
                      @select="handlePodAction"
                    >
                      <n-button size="small" circle>
                        <template #icon>
                          <MoreVertical :size="14" />
                        </template>
                      </n-button>
                    </n-dropdown>
                  </div>
                </div>
              </div>
            </n-tab-pane>
            
            <n-tab-pane name="services" tab="Services">
              <div class="services-list">
                <div
                  v-for="service in filteredServices"
                  :key="service.id"
                  class="service-card"
                  :class="{ active: selectedResource?.id === service.id }"
                  @click="selectResource(service, 'service')"
                >
                  <div class="service-header">
                    <div class="service-info">
                      <h4 class="service-name">{{ service.name }}</h4>
                      <p class="service-namespace">{{ service.namespace }}</p>
                    </div>
                    <div class="service-type">
                      <n-tag size="small" :bordered="false">
                        {{ service.type }}
                      </n-tag>
                    </div>
                  </div>
                  
                  <div class="service-endpoints">
                    <div class="endpoint-item">
                      <span class="endpoint-label">集群IP:</span>
                      <span class="endpoint-value">{{ service.clusterIP }}</span>
                    </div>
                    <div v-if="service.externalIP" class="endpoint-item">
                      <span class="endpoint-label">外部IP:</span>
                      <span class="endpoint-value">{{ service.externalIP }}</span>
                    </div>
                    <div class="endpoint-item">
                      <span class="endpoint-label">端口:</span>
                      <span class="endpoint-value">{{ service.ports.join(', ') }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </n-tab-pane>
            
            <n-tab-pane name="deployments" tab="Deployments">
              <div class="deployments-list">
                <div
                  v-for="deployment in filteredDeployments"
                  :key="deployment.id"
                  class="deployment-card"
                  :class="{ active: selectedResource?.id === deployment.id }"
                  @click="selectResource(deployment, 'deployment')"
                >
                  <div class="deployment-header">
                    <div class="deployment-info">
                      <h4 class="deployment-name">{{ deployment.name }}</h4>
                      <p class="deployment-namespace">{{ deployment.namespace }}</p>
                    </div>
                    <div class="deployment-status">
                      <n-tag
                        :type="getDeploymentStatusType(deployment.status)"
                        size="small"
                        :bordered="false"
                      >
                        {{ deployment.status }}
                      </n-tag>
                    </div>
                  </div>
                  
                  <div class="deployment-replicas">
                    <div class="replicas-info">
                      <span class="replicas-current">{{ deployment.readyReplicas }}</span>
                      <span class="replicas-separator">/</span>
                      <span class="replicas-desired">{{ deployment.replicas }}</span>
                      <span class="replicas-label">副本</span>
                    </div>
                    <div class="replicas-progress">
                      <n-progress
                        :percentage="(deployment.readyReplicas / deployment.replicas) * 100"
                        :show-indicator="false"
                        size="small"
                      />
                    </div>
                  </div>
                  
                  <div class="deployment-image">
                    <span class="image-label">镜像:</span>
                    <span class="image-value">{{ deployment.image }}</span>
                  </div>
                </div>
              </div>
            </n-tab-pane>
            
            <n-tab-pane name="nodes" tab="Nodes">
              <div class="nodes-list">
                <div
                  v-for="node in currentCluster?.nodes || []"
                  :key="node.id"
                  class="node-card"
                  :class="{ active: selectedResource?.id === node.id }"
                  @click="selectResource(node, 'node')"
                >
                  <div class="node-header">
                    <div class="node-info">
                      <h4 class="node-name">{{ node.name }}</h4>
                      <p class="node-role">{{ node.role }}</p>
                    </div>
                    <div class="node-status">
                      <n-tag
                        :type="getNodeStatusType(node.status)"
                        size="small"
                        :bordered="false"
                      >
                        {{ node.status }}
                      </n-tag>
                    </div>
                  </div>
                  
                  <div class="node-specs">
                    <div class="spec-item">
                      <span class="spec-label">CPU:</span>
                      <span class="spec-value">{{ node.capacity.cpu }}</span>
                    </div>
                    <div class="spec-item">
                      <span class="spec-label">内存:</span>
                      <span class="spec-value">{{ node.capacity.memory }}</span>
                    </div>
                    <div class="spec-item">
                      <span class="spec-label">存储:</span>
                      <span class="spec-value">{{ node.capacity.storage }}</span>
                    </div>
                  </div>
                  
                  <div class="node-usage">
                    <div class="usage-item">
                      <span class="usage-label">CPU使用率</span>
                      <div class="usage-bar">
                        <n-progress
                          :percentage="node.usage.cpu"
                          :show-indicator="false"
                          size="small"
                        />
                        <span class="usage-text">{{ node.usage.cpu }}%</span>
                      </div>
                    </div>
                    <div class="usage-item">
                      <span class="usage-label">内存使用率</span>
                      <div class="usage-bar">
                        <n-progress
                          :percentage="node.usage.memory"
                          :show-indicator="false"
                          size="small"
                        />
                        <span class="usage-text">{{ node.usage.memory }}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </n-tab-pane>
          </n-tabs>
        </div>
      </div>

      <!-- 右侧：资源详情 -->
      <div class="resource-detail">
        <div v-if="selectedResource" class="detail-content">
          <!-- Pod详情 -->
          <div v-if="selectedResourceType === 'pod'" class="pod-detail">
            <div class="detail-header">
              <h4 class="detail-title">Pod详情</h4>
              <div class="detail-actions">
                <n-button size="small" @click="viewLogs(selectedResource)">
                  <template #icon>
                    <FileText :size="14" />
                  </template>
                  查看日志
                </n-button>
                <n-button size="small" @click="execInto(selectedResource)">
                  <template #icon>
                    <Terminal :size="14" />
                  </template>
                  进入容器
                </n-button>
              </div>
            </div>
            
            <div class="detail-sections">
              <div class="detail-section">
                <h5 class="section-title">基本信息</h5>
                <div class="info-grid">
                  <div class="info-item">
                    <span class="info-label">名称:</span>
                    <span class="info-value">{{ selectedResource.name }}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">命名空间:</span>
                    <span class="info-value">{{ selectedResource.namespace }}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">状态:</span>
                    <n-tag :type="getPodStatusType(selectedResource.status)" size="small">
                      {{ selectedResource.status }}
                    </n-tag>
                  </div>
                  <div class="info-item">
                    <span class="info-label">节点:</span>
                    <span class="info-value">{{ selectedResource.node }}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">IP地址:</span>
                    <span class="info-value">{{ selectedResource.ip }}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">创建时间:</span>
                    <span class="info-value">{{ formatDateTime(selectedResource.createdAt) }}</span>
                  </div>
                </div>
              </div>
              
              <div class="detail-section">
                <h5 class="section-title">容器信息</h5>
                <div class="containers-info">
                  <div
                    v-for="container in selectedResource.containers"
                    :key="container.name"
                    class="container-item"
                  >
                    <div class="container-header">
                      <h6 class="container-name">{{ container.name }}</h6>
                      <n-tag
                        :type="getContainerStatusType(container.status)"
                        size="small"
                        :bordered="false"
                      >
                        {{ container.status }}
                      </n-tag>
                    </div>
                    <div class="container-details">
                      <div class="detail-item">
                        <span class="detail-label">镜像:</span>
                        <span class="detail-value">{{ container.image }}</span>
                      </div>
                      <div class="detail-item">
                        <span class="detail-label">重启次数:</span>
                        <span class="detail-value">{{ container.restartCount }}</span>
                      </div>
                      <div class="detail-item">
                        <span class="detail-label">资源限制:</span>
                        <span class="detail-value">
                          CPU: {{ container.resources.limits.cpu }}, 
                          内存: {{ container.resources.limits.memory }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div class="detail-section">
                <h5 class="section-title">事件日志</h5>
                <div class="events-list">
                  <div
                    v-for="event in selectedResource.events"
                    :key="event.id"
                    class="event-item"
                    :class="getEventClass(event.type)"
                  >
                    <div class="event-time">{{ formatTime(event.timestamp) }}</div>
                    <div class="event-content">
                      <div class="event-type">{{ event.type }}</div>
                      <div class="event-message">{{ event.message }}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Service详情 -->
          <div v-else-if="selectedResourceType === 'service'" class="service-detail">
            <div class="detail-header">
              <h4 class="detail-title">Service详情</h4>
            </div>
            
            <div class="detail-sections">
              <div class="detail-section">
                <h5 class="section-title">基本信息</h5>
                <div class="info-grid">
                  <div class="info-item">
                    <span class="info-label">名称:</span>
                    <span class="info-value">{{ selectedResource.name }}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">命名空间:</span>
                    <span class="info-value">{{ selectedResource.namespace }}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">类型:</span>
                    <span class="info-value">{{ selectedResource.type }}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">集群IP:</span>
                    <span class="info-value">{{ selectedResource.clusterIP }}</span>
                  </div>
                  <div v-if="selectedResource.externalIP" class="info-item">
                    <span class="info-label">外部IP:</span>
                    <span class="info-value">{{ selectedResource.externalIP }}</span>
                  </div>
                </div>
              </div>
              
              <div class="detail-section">
                <h5 class="section-title">端口配置</h5>
                <div class="ports-list">
                  <div
                    v-for="port in selectedResource.portConfigs"
                    :key="port.name"
                    class="port-item"
                  >
                    <div class="port-name">{{ port.name }}</div>
                    <div class="port-details">
                      <span>{{ port.port }}:{{ port.targetPort }}/{{ port.protocol }}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div class="detail-section">
                <h5 class="section-title">关联Pod</h5>
                <div class="related-pods">
                  <div
                    v-for="pod in selectedResource.relatedPods"
                    :key="pod.name"
                    class="related-pod-item"
                  >
                    <span class="pod-name">{{ pod.name }}</span>
                    <n-tag :type="getPodStatusType(pod.status)" size="small">
                      {{ pod.status }}
                    </n-tag>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Deployment详情 -->
          <div v-else-if="selectedResourceType === 'deployment'" class="deployment-detail">
            <div class="detail-header">
              <h4 class="detail-title">Deployment详情</h4>
              <div class="detail-actions">
                <n-button size="small" @click="scaleDeployment(selectedResource)">
                  <template #icon>
                    <Maximize :size="14" />
                  </template>
                  扩缩容
                </n-button>
                <n-button size="small" @click="updateDeployment(selectedResource)">
                  <template #icon>
                    <Upload :size="14" />
                  </template>
                  更新
                </n-button>
              </div>
            </div>
            
            <div class="detail-sections">
              <div class="detail-section">
                <h5 class="section-title">基本信息</h5>
                <div class="info-grid">
                  <div class="info-item">
                    <span class="info-label">名称:</span>
                    <span class="info-value">{{ selectedResource.name }}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">命名空间:</span>
                    <span class="info-value">{{ selectedResource.namespace }}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">副本数:</span>
                    <span class="info-value">{{ selectedResource.readyReplicas }}/{{ selectedResource.replicas }}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">镜像:</span>
                    <span class="info-value">{{ selectedResource.image }}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">更新策略:</span>
                    <span class="info-value">{{ selectedResource.strategy }}</span>
                  </div>
                </div>
              </div>
              
              <div class="detail-section">
                <h5 class="section-title">副本状态</h5>
                <div class="replicas-status">
                  <div class="status-chart">
                    <n-progress
                      type="circle"
                      :percentage="(selectedResource.readyReplicas / selectedResource.replicas) * 100"
                      :stroke-width="8"
                    >
                      {{ selectedResource.readyReplicas }}/{{ selectedResource.replicas }}
                    </n-progress>
                  </div>
                  <div class="status-details">
                    <div class="status-item">
                      <span class="status-label">就绪:</span>
                      <span class="status-value">{{ selectedResource.readyReplicas }}</span>
                    </div>
                    <div class="status-item">
                      <span class="status-label">期望:</span>
                      <span class="status-value">{{ selectedResource.replicas }}</span>
                    </div>
                    <div class="status-item">
                      <span class="status-label">更新中:</span>
                      <span class="status-value">{{ selectedResource.updatedReplicas || 0 }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Node详情 -->
          <div v-else-if="selectedResourceType === 'node'" class="node-detail">
            <div class="detail-header">
              <h4 class="detail-title">Node详情</h4>
            </div>
            
            <div class="detail-sections">
              <div class="detail-section">
                <h5 class="section-title">基本信息</h5>
                <div class="info-grid">
                  <div class="info-item">
                    <span class="info-label">名称:</span>
                    <span class="info-value">{{ selectedResource.name }}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">角色:</span>
                    <span class="info-value">{{ selectedResource.role }}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">状态:</span>
                    <n-tag :type="getNodeStatusType(selectedResource.status)" size="small">
                      {{ selectedResource.status }}
                    </n-tag>
                  </div>
                  <div class="info-item">
                    <span class="info-label">内部IP:</span>
                    <span class="info-value">{{ selectedResource.internalIP }}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">操作系统:</span>
                    <span class="info-value">{{ selectedResource.osImage }}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">容器运行时:</span>
                    <span class="info-value">{{ selectedResource.containerRuntime }}</span>
                  </div>
                </div>
              </div>
              
              <div class="detail-section">
                <h5 class="section-title">资源使用情况</h5>
                <div class="resource-usage">
                  <div class="usage-chart">
                    <div class="chart-item">
                      <div class="chart-header">
                        <span class="chart-title">CPU</span>
                        <span class="chart-value">{{ selectedResource.usage.cpu }}%</span>
                      </div>
                      <n-progress
                        :percentage="selectedResource.usage.cpu"
                        :show-indicator="false"
                      />
                    </div>
                    <div class="chart-item">
                      <div class="chart-header">
                        <span class="chart-title">内存</span>
                        <span class="chart-value">{{ selectedResource.usage.memory }}%</span>
                      </div>
                      <n-progress
                        :percentage="selectedResource.usage.memory"
                        :show-indicator="false"
                      />
                    </div>
                    <div class="chart-item">
                      <div class="chart-header">
                        <span class="chart-title">存储</span>
                        <span class="chart-value">{{ selectedResource.usage.storage }}%</span>
                      </div>
                      <n-progress
                        :percentage="selectedResource.usage.storage"
                        :show-indicator="false"
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              <div class="detail-section">
                <h5 class="section-title">运行的Pod</h5>
                <div class="node-pods">
                  <div
                    v-for="pod in selectedResource.runningPods"
                    :key="pod.name"
                    class="node-pod-item"
                  >
                    <div class="pod-info">
                      <span class="pod-name">{{ pod.name }}</span>
                      <span class="pod-namespace">{{ pod.namespace }}</span>
                    </div>
                    <div class="pod-resources">
                      <span class="resource-text">CPU: {{ pod.cpuUsage }}</span>
                      <span class="resource-text">内存: {{ pod.memoryUsage }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 空状态 -->
        <div v-else class="empty-detail">
          <div class="empty-icon">
            <Box :size="48" />
          </div>
          <h3>选择资源</h3>
          <p>请从左侧列表中选择一个资源查看详细信息</p>
        </div>
      </div>
    </div>

    <!-- 部署应用模态框 -->
    <n-modal v-model:show="showDeployModal" preset="card" title="部署应用" class="deploy-modal">
      <div class="deploy-form">
        <n-form :model="deployForm" label-placement="top">
          <div class="form-section">
            <h4 class="form-section-title">基本配置</h4>
            <div class="form-row">
              <n-form-item label="应用名称" class="form-item">
                <n-input v-model:value="deployForm.name" placeholder="输入应用名称" />
              </n-form-item>
              <n-form-item label="命名空间" class="form-item">
                <n-select
                  v-model:value="deployForm.namespace"
                  :options="namespaceOptions"
                  placeholder="选择命名空间"
                />
              </n-form-item>
            </div>
            <n-form-item label="容器镜像">
              <n-input v-model:value="deployForm.image" placeholder="输入镜像地址" />
            </n-form-item>
            <div class="form-row">
              <n-form-item label="副本数" class="form-item">
                <n-input-number
                  v-model:value="deployForm.replicas"
                  :min="1"
                  placeholder="副本数"
                />
              </n-form-item>
              <n-form-item label="更新策略" class="form-item">
                <n-select
                  v-model:value="deployForm.strategy"
                  :options="updateStrategyOptions"
                  placeholder="选择策略"
                />
              </n-form-item>
            </div>
          </div>

          <div class="form-section">
            <h4 class="form-section-title">资源配置</h4>
            <div class="form-row">
              <n-form-item label="CPU请求" class="form-item">
                <n-input v-model:value="deployForm.resources.requests.cpu" placeholder="100m" />
              </n-form-item>
              <n-form-item label="CPU限制" class="form-item">
                <n-input v-model:value="deployForm.resources.limits.cpu" placeholder="500m" />
              </n-form-item>
            </div>
            <div class="form-row">
              <n-form-item label="内存请求" class="form-item">
                <n-input v-model:value="deployForm.resources.requests.memory" placeholder="128Mi" />
              </n-form-item>
              <n-form-item label="内存限制" class="form-item">
                <n-input v-model:value="deployForm.resources.limits.memory" placeholder="512Mi" />
              </n-form-item>
            </div>
          </div>

          <div class="form-section">
            <h4 class="form-section-title">环境变量</h4>
            <n-dynamic-input
              v-model:value="deployForm.environmentVariables"
              :on-create="createEnvironmentVariable"
            >
              <template #default="{ value }">
                <div class="env-var-input">
                  <n-input
                    v-model:value="value.key"
                    placeholder="变量名"
                    style="width: 40%"
                  />
                  <n-input
                    v-model:value="value.value"
                    placeholder="变量值"
                    style="width: 60%"
                  />
                </div>
              </template>
            </n-dynamic-input>
          </div>

          <div class="form-section">
            <h4 class="form-section-title">端口配置</h4>
            <n-dynamic-input
              v-model:value="deployForm.ports"
              :on-create="createPort"
            >
              <template #default="{ value }">
                <div class="port-input">
                  <n-input
                    v-model:value="value.name"
                    placeholder="端口名称"
                    style="width: 30%"
                  />
                  <n-input-number
                    v-model:value="value.port"
                    placeholder="端口号"
                    style="width: 35%"
                  />
                  <n-select
                    v-model:value="value.protocol"
                    :options="protocolOptions"
                    placeholder="协议"
                    style="width: 35%"
                  />
                </div>
              </template>
            </n-dynamic-input>
          </div>
        </n-form>
        
        <div class="modal-actions">
          <n-button @click="showDeployModal = false">取消</n-button>
          <n-button type="primary" @click="deployApplication">部署</n-button>
        </div>
      </div>
    </n-modal>

    <!-- 集群配置模态框 -->
    <n-modal v-model:show="showClusterModal" preset="card" title="集群配置" class="cluster-modal">
      <div class="cluster-form">
        <n-tabs type="line" animated>
          <n-tab-pane name="clusters" tab="集群管理">
            <div class="clusters-management">
              <div class="management-header">
                <n-button type="primary" @click="addCluster">
                  <template #icon>
                    <Plus :size="16" />
                  </template>
                  添加集群
                </n-button>
              </div>
              <div class="clusters-table">
                <n-data-table
                  :columns="clusterColumns"
                  :data="clusters"
                  :pagination="false"
                />
              </div>
            </div>
          </n-tab-pane>
          <n-tab-pane name="namespaces" tab="命名空间">
            <div class="namespaces-management">
              <div class="management-header">
                <n-button type="primary" @click="createNamespace">
                  <template #icon>
                    <Plus :size="16" />
                  </template>
                  创建命名空间
                </n-button>
              </div>
              <div class="namespaces-list">
                <div
                  v-for="namespace in namespaces"
                  :key="namespace.name"
                  class="namespace-item"
                >
                  <div class="namespace-info">
                    <h5 class="namespace-name">{{ namespace.name }}</h5>
                    <p class="namespace-status">{{ namespace.status }}</p>
                  </div>
                  <div class="namespace-stats">
                    <span class="stat">{{ namespace.podCount }} Pods</span>
                    <span class="stat">{{ namespace.serviceCount }} Services</span>
                  </div>
                  <div class="namespace-actions">
                    <n-button size="small" @click="deleteNamespace(namespace)">
                      删除
                    </n-button>
                  </div>
                </div>
              </div>
            </div>
          </n-tab-pane>
        </n-tabs>
        
        <div class="modal-actions">
          <n-button @click="showClusterModal = false">关闭</n-button>
        </div>
      </div>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useMessage } from 'naive-ui'
import {
  RefreshCw, Settings, Plus, Server, Box, Network, Cpu, HardDrive,
  Search, MoreVertical, Clock, Activity, FileText, Terminal, Maximize,
  Upload
} from 'lucide-vue-next'

const message = useMessage()

// 响应式数据
const loading = ref(false)
const selectedClusterId = ref('1')
const activeTab = ref('pods')
const selectedResource = ref(null)
const selectedResourceType = ref('')
const showDeployModal = ref(false)
const showClusterModal = ref(false)

// 搜索和筛选
const podSearchQuery = ref('')
const namespaceFilter = ref(null)
const podStatusFilter = ref(null)

// 集群数据
const clusters = ref([
  {
    id: '1',
    name: '生产集群',
    status: 'healthy',
    version: 'v1.28.2',
    nodes: [
      {
        id: 'node-1',
        name: 'master-node-1',
        role: 'master',
        status: 'Ready',
        internalIP: '10.0.1.10',
        osImage: 'Ubuntu 20.04.6 LTS',
        containerRuntime: 'containerd://1.6.24',
        capacity: {
          cpu: '4 cores',
          memory: '16Gi',
          storage: '100Gi'
        },
        usage: {
          cpu: 45,
          memory: 62,
          storage: 38
        },
        runningPods: [
          { name: 'kube-apiserver', namespace: 'kube-system', cpuUsage: '200m', memoryUsage: '512Mi' },
          { name: 'etcd', namespace: 'kube-system', cpuUsage: '100m', memoryUsage: '256Mi' }
        ]
      },
      {
        id: 'node-2',
        name: 'worker-node-1',
        role: 'worker',
        status: 'Ready',
        internalIP: '10.0.1.11',
        osImage: 'Ubuntu 20.04.6 LTS',
        containerRuntime: 'containerd://1.6.24',
        capacity: {
          cpu: '8 cores',
          memory: '32Gi',
          storage: '200Gi'
        },
        usage: {
          cpu: 68,
          memory: 75,
          storage: 45
        },
        runningPods: [
          { name: 'web-app-7d4b8c9f8-abc12', namespace: 'default', cpuUsage: '500m', memoryUsage: '1Gi' },
          { name: 'api-service-6b5a7c8d9-def34', namespace: 'default', cpuUsage: '300m', memoryUsage: '512Mi' }
        ]
      }
    ]
  },
  {
    id: '2',
    name: '测试集群',
    status: 'healthy',
    version: 'v1.27.8',
    nodes: [
      {
        id: 'node-3',
        name: 'test-node-1',
        role: 'master',
        status: 'Ready',
        internalIP: '10.0.2.10',
        osImage: 'Ubuntu 20.04.6 LTS',
        containerRuntime: 'containerd://1.6.20',
        capacity: {
          cpu: '2 cores',
          memory: '8Gi',
          storage: '50Gi'
        },
        usage: {
          cpu: 25,
          memory: 40,
          storage: 30
        },
        runningPods: []
      }
    ]
  }
])

// Pod数据
const pods = ref([
  {
    id: 'pod-1',
    name: 'web-app-7d4b8c9f8-abc12',
    namespace: 'default',
    status: 'Running',
    node: 'worker-node-1',
    ip: '10.244.1.10',
    createdAt: new Date('2024-01-20T10:30:00'),
    restarts: 0,
    resources: {
      cpu: '500m',
      memory: '1Gi'
    },
    containers: [
      {
        name: 'web-app',
        image: 'nginx:1.21',
        status: 'Running',
        restartCount: 0,
        resources: {
          limits: {
            cpu: '500m',
            memory: '1Gi'
          }
        }
      }
    ],
    events: [
      {
        id: 'event-1',
        type: 'Normal',
        message: 'Successfully pulled image "nginx:1.21"',
        timestamp: new Date('2024-01-20T10:30:00')
      },
      {
        id: 'event-2',
        type: 'Normal',
        message: 'Created container web-app',
        timestamp: new Date('2024-01-20T10:30:05')
      }
    ]
  },
  {
    id: 'pod-2',
    name: 'api-service-6b5a7c8d9-def34',
    namespace: 'default',
    status: 'Running',
    node: 'worker-node-1',
    ip: '10.244.1.11',
    createdAt: new Date('2024-01-20T09:15:00'),
    restarts: 1,
    resources: {
      cpu: '300m',
      memory: '512Mi'
    },
    containers: [
      {
        name: 'api-service',
        image: 'node:18-alpine',
        status: 'Running',
        restartCount: 1,
        resources: {
          limits: {
            cpu: '300m',
            memory: '512Mi'
          }
        }
      }
    ],
    events: [
      {
        id: 'event-3',
        type: 'Warning',
        message: 'Container restarted due to health check failure',
        timestamp: new Date('2024-01-20T09:20:00')
      }
    ]
  },
  {
    id: 'pod-3',
    name: 'database-5f8c9d7e6-ghi56',
    namespace: 'database',
    status: 'Pending',
    node: '',
    ip: '',
    createdAt: new Date('2024-01-20T11:00:00'),
    restarts: 0,
    resources: {
      cpu: '1000m',
      memory: '2Gi'
    },
    containers: [
      {
        name: 'postgres',
        image: 'postgres:15',
        status: 'Waiting',
        restartCount: 0,
        resources: {
          limits: {
            cpu: '1000m',
            memory: '2Gi'
          }
        }
      }
    ],
    events: [
      {
        id: 'event-4',
        type: 'Warning',
        message: 'Failed to schedule pod: insufficient resources',
        timestamp: new Date('2024-01-20T11:00:00')
      }
    ]
  }
])

// Service数据
const services = ref([
  {
    id: 'service-1',
    name: 'web-app-service',
    namespace: 'default',
    type: 'ClusterIP',
    clusterIP: '10.96.1.100',
    externalIP: null,
    ports: ['80:8080'],
    portConfigs: [
      {
        name: 'http',
        port: 80,
        targetPort: 8080,
        protocol: 'TCP'
      }
    ],
    relatedPods: [
      { name: 'web-app-7d4b8c9f8-abc12', status: 'Running' }
    ]
  },
  {
    id: 'service-2',
    name: 'api-service',
    namespace: 'default',
    type: 'LoadBalancer',
    clusterIP: '10.96.1.101',
    externalIP: '203.0.113.10',
    ports: ['3000:3000'],
    portConfigs: [
      {
        name: 'api',
        port: 3000,
        targetPort: 3000,
        protocol: 'TCP'
      }
    ],
    relatedPods: [
      { name: 'api-service-6b5a7c8d9-def34', status: 'Running' }
    ]
  }
])

// Deployment数据
const deployments = ref([
  {
    id: 'deployment-1',
    name: 'web-app',
    namespace: 'default',
    status: 'Available',
    replicas: 3,
    readyReplicas: 3,
    updatedReplicas: 3,
    image: 'nginx:1.21',
    strategy: 'RollingUpdate'
  },
  {
    id: 'deployment-2',
    name: 'api-service',
    namespace: 'default',
    status: 'Available',
    replicas: 2,
    readyReplicas: 2,
    updatedReplicas: 2,
    image: 'node:18-alpine',
    strategy: 'RollingUpdate'
  },
  {
    id: 'deployment-3',
    name: 'worker',
    namespace: 'default',
    status: 'Progressing',
    replicas: 1,
    readyReplicas: 0,
    updatedReplicas: 1,
    image: 'python:3.9',
    strategy: 'RollingUpdate'
  }
])

// 命名空间数据
const namespaces = ref([
  { name: 'default', status: 'Active', podCount: 5, serviceCount: 3 },
  { name: 'kube-system', status: 'Active', podCount: 12, serviceCount: 8 },
  { name: 'database', status: 'Active', podCount: 2, serviceCount: 1 },
  { name: 'monitoring', status: 'Active', podCount: 8, serviceCount: 4 }
])

// 表单数据
const deployForm = ref({
  name: '',
  namespace: 'default',
  image: '',
  replicas: 1,
  strategy: 'RollingUpdate',
  resources: {
    requests: {
      cpu: '100m',
      memory: '128Mi'
    },
    limits: {
      cpu: '500m',
      memory: '512Mi'
    }
  },
  environmentVariables: [{ key: '', value: '' }],
  ports: [{ name: 'http', port: 80, protocol: 'TCP' }]
})

// 选项数据
const clusterOptions = computed(() =>
  clusters.value.map(cluster => ({ label: cluster.name, value: cluster.id }))
)

const namespaceOptions = computed(() =>
  namespaces.value.map(ns => ({ label: ns.name, value: ns.name }))
)

const podStatusOptions = [
  { label: '全部状态', value: null },
  { label: 'Running', value: 'Running' },
  { label: 'Pending', value: 'Pending' },
  { label: 'Failed', value: 'Failed' },
  { label: 'Succeeded', value: 'Succeeded' }
]

const updateStrategyOptions = [
  { label: '滚动更新', value: 'RollingUpdate' },
  { label: '重新创建', value: 'Recreate' }
]

const protocolOptions = [
  { label: 'TCP', value: 'TCP' },
  { label: 'UDP', value: 'UDP' }
]

const clusterColumns = [
  { title: '集群名称', key: 'name' },
  { title: '状态', key: 'status' },
  { title: '版本', key: 'version' },
  { title: '节点数', key: 'nodes', render: (row) => row.nodes.length },
  { title: '操作', key: 'actions', render: () => '编辑 | 删除' }
]

// 计算属性
const currentCluster = computed(() =>
  clusters.value.find(cluster => cluster.id === selectedClusterId.value)
)

const totalPods = computed(() => pods.value.length)
const totalServices = computed(() => services.value.length)
const cpuUsage = computed(() => {
  if (!currentCluster.value?.nodes.length) return 0
  const totalUsage = currentCluster.value.nodes.reduce((sum, node) => sum + node.usage.cpu, 0)
  return Math.round(totalUsage / currentCluster.value.nodes.length)
})
const memoryUsage = computed(() => {
  if (!currentCluster.value?.nodes.length) return 0
  const totalUsage = currentCluster.value.nodes.reduce((sum, node) => sum + node.usage.memory, 0)
  return Math.round(totalUsage / currentCluster.value.nodes.length)
})

const filteredPods = computed(() => {
  let filtered = pods.value

  if (podSearchQuery.value) {
    const query = podSearchQuery.value.toLowerCase()
    filtered = filtered.filter(pod =>
      pod.name.toLowerCase().includes(query) ||
      pod.namespace.toLowerCase().includes(query)
    )
  }

  if (namespaceFilter.value) {
    filtered = filtered.filter(pod => pod.namespace === namespaceFilter.value)
  }

  if (podStatusFilter.value) {
    filtered = filtered.filter(pod => pod.status === podStatusFilter.value)
  }

  return filtered
})

const filteredServices = computed(() => services.value)
const filteredDeployments = computed(() => deployments.value)

// 方法
const refreshData = async () => {
  loading.value = true
  try {
    await new Promise(resolve => setTimeout(resolve, 1000))
    message.success('数据已刷新')
  } catch (error) {
    message.error('刷新失败')
  } finally {
    loading.value = false
  }
}

const switchCluster = (clusterId: string) => {
  selectedClusterId.value = clusterId
  selectedResource.value = null
  message.info(`已切换到${currentCluster.value?.name}`)
}

const selectResource = (resource: any, type: string) => {
  selectedResource.value = resource
  selectedResourceType.value = type
}

const getPodStatusType = (status: string) => {
  const types = {
    Running: 'success',
    Pending: 'warning',
    Failed: 'error',
    Succeeded: 'info'
  }
  return types[status] || 'default'
}

const getContainerStatusType = (status: string) => {
  const types = {
    Running: 'success',
    Waiting: 'warning',
    Terminated: 'error'
  }
  return types[status] || 'default'
}

const getDeploymentStatusType = (status: string) => {
  const types = {
    Available: 'success',
    Progressing: 'info',
    ReplicaFailure: 'error'
  }
  return types[status] || 'default'
}

const getNodeStatusType = (status: string) => {
  const types = {
    Ready: 'success',
    NotReady: 'error',
    Unknown: 'warning'
  }
  return types[status] || 'default'
}

const getEventClass = (type: string) => {
  return {
    normal: type === 'Normal',
    warning: type === 'Warning',
    error: type === 'Error'
  }
}

const formatTime = (date: Date) => {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / (1000 * 60))
  
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  
  const days = Math.floor(hours / 24)
  return `${days}天前`
}

const formatDateTime = (date: Date) => {
  return date.toLocaleString('zh-CN')
}

const getPodActions = (pod: any) => {
  return [
    { label: '查看日志', key: 'logs', props: { pod } },
    { label: '进入容器', key: 'exec', props: { pod } },
    { label: '描述', key: 'describe', props: { pod } },
    { label: '删除', key: 'delete', props: { pod } }
  ]
}

const handlePodAction = (key: string, option: any) => {
  const pod = option.props.pod
  switch (key) {
    case 'logs':
      viewLogs(pod)
      break
    case 'exec':
      execInto(pod)
      break
    case 'describe':
      message.info(`描述 Pod: ${pod.name}`)
      break
    case 'delete':
      deletePod(pod)
      break
  }
}

const viewLogs = (resource: any) => {
  message.info(`查看 ${resource.name} 的日志`)
}

const execInto = (resource: any) => {
  message.info(`进入容器: ${resource.name}`)
}

const deletePod = (pod: any) => {
  const index = pods.value.findIndex(p => p.id === pod.id)
  if (index > -1) {
    pods.value.splice(index, 1)
    if (selectedResource.value?.id === pod.id) {
      selectedResource.value = null
    }
    message.success(`已删除 Pod: ${pod.name}`)
  }
}

const scaleDeployment = (deployment: any) => {
  message.info(`扩缩容 Deployment: ${deployment.name}`)
}

const updateDeployment = (deployment: any) => {
  message.info(`更新 Deployment: ${deployment.name}`)
}

const createEnvironmentVariable = () => {
  return { key: '', value: '' }
}

const createPort = () => {
  return { name: '', port: 80, protocol: 'TCP' }
}

const deployApplication = () => {
  if (!deployForm.value.name || !deployForm.value.image) {
    message.error('请填写必填字段')
    return
  }

  // 模拟部署应用
  const newDeployment = {
    id: Date.now().toString(),
    name: deployForm.value.name,
    namespace: deployForm.value.namespace,
    status: 'Progressing',
    replicas: deployForm.value.replicas,
    readyReplicas: 0,
    updatedReplicas: 0,
    image: deployForm.value.image,
    strategy: deployForm.value.strategy
  }

  deployments.value.push(newDeployment)
  message.success(`应用 ${deployForm.value.name} 部署已开始`)
  showDeployModal.value = false

  // 重置表单
  deployForm.value = {
    name: '',
    namespace: 'default',
    image: '',
    replicas: 1,
    strategy: 'RollingUpdate',
    resources: {
      requests: {
        cpu: '100m',
        memory: '128Mi'
      },
      limits: {
        cpu: '500m',
        memory: '512Mi'
      }
    },
    environmentVariables: [{ key: '', value: '' }],
    ports: [{ name: 'http', port: 80, protocol: 'TCP' }]
  }
}

const addCluster = () => {
  message.info('添加新集群')
}

const createNamespace = () => {
  message.info('创建新命名空间')
}

const deleteNamespace = (namespace: any) => {
  const index = namespaces.value.findIndex(ns => ns.name === namespace.name)
  if (index > -1) {
    namespaces.value.splice(index, 1)
    message.success(`已删除命名空间: ${namespace.name}`)
  }
}

onMounted(() => {
  // 默认选择第一个Pod
  if (pods.value.length > 0) {
    selectedResource.value = pods.value[0]
    selectedResourceType.value = 'pod'
  }
})
</script>

<style scoped>
.containers-page {
  @apply p-6 space-y-6;
}

.page-header {
  @apply bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50;
}

.header-content {
  @apply flex items-center justify-between;
}

.title-section h1 {
  @apply text-2xl font-bold text-white mb-1;
}

.title-section p {
  @apply text-slate-400;
}

.header-actions {
  @apply flex items-center gap-3;
}

.clusters-overview {
  @apply bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50;
}

.overview-header {
  @apply flex items-center justify-between mb-6;
}

.overview-title {
  @apply text-lg font-semibold text-white;
}

.cluster-selector {
  @apply w-48;
}

.cluster-stats {
  @apply grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4;
}

.stat-card {
  @apply bg-slate-700/30 rounded-lg p-4 flex items-center gap-4;
}

.stat-icon {
  @apply w-12 h-12 rounded-lg flex items-center justify-center;
}

.stat-icon.nodes {
  @apply bg-blue-500/20 text-blue-400;
}

.stat-icon.pods {
  @apply bg-green-500/20 text-green-400;
}

.stat-icon.services {
  @apply bg-purple-500/20 text-purple-400;
}

.stat-icon.cpu {
  @apply bg-orange-500/20 text-orange-400;
}

.stat-icon.memory {
  @apply bg-red-500/20 text-red-400;
}

.stat-value {
  @apply text-2xl font-bold text-white;
}

.stat-label {
  @apply text-sm text-slate-400;
}

.main-content {
  @apply grid grid-cols-1 lg:grid-cols-3 gap-6;
}

.resources-section {
  @apply lg:col-span-2 bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50;
}

.resources-header {
  @apply mb-4;
}

.resources-filters {
  @apply flex items-center gap-3;
}

.pods-list,
.services-list,
.deployments-list,
.nodes-list {
  @apply space-y-3 max-h-96 overflow-y-auto;
}

.pod-card,
.service-card,
.deployment-card,
.node-card {
  @apply bg-slate-700/30 rounded-lg p-4 cursor-pointer transition-all duration-200 hover:bg-slate-700/50;
}

.pod-card.active,
.service-card.active,
.deployment-card.active,
.node-card.active {
  @apply bg-blue-600/30 border border-blue-500/50;
}

.pod-header,
.service-header,
.deployment-header,
.node-header {
  @apply flex items-center justify-between mb-3;
}

.pod-info h4,
.service-info h4,
.deployment-info h4,
.node-info h4 {
  @apply text-white font-medium;
}

.pod-info p,
.service-info p,
.deployment-info p,
.node-info p {
  @apply text-slate-400 text-sm;
}

.pod-meta,
.service-endpoints,
.deployment-replicas,
.node-specs {
  @apply flex items-center gap-4 mb-3 text-sm text-slate-400;
}

.meta-item,
.endpoint-item,
.spec-item {
  @apply flex items-center gap-1;
}

.pod-resources {
  @apply flex items-center gap-4 mb-3 text-sm;
}

.resource-item {
  @apply flex items-center gap-1;
}

.resource-label {
  @apply text-slate-400;
}

.resource-value {
  @apply text-white;
}

.pod-actions {
  @apply flex justify-end;
}

.deployment-replicas {
  @apply flex items-center justify-between mb-3;
}

.replicas-info {
  @apply flex items-center gap-1 text-sm;
}

.replicas-current {
  @apply text-green-400 font-medium;
}

.replicas-separator {
  @apply text-slate-400;
}

.replicas-desired {
  @apply text-white font-medium;
}

.replicas-label {
  @apply text-slate-400 ml-1;
}

.replicas-progress {
  @apply flex-1 ml-4;
}

.deployment-image {
  @apply text-sm;
}

.image-label {
  @apply text-slate-400;
}

.image-value {
  @apply text-white ml-1;
}

.node-usage {
  @apply space-y-2;
}

.usage-item {
  @apply space-y-1;
}

.usage-label {
  @apply text-xs text-slate-400;
}

.usage-bar {
  @apply flex items-center gap-2;
}

.usage-text {
  @apply text-xs text-slate-300 min-w-[3rem];
}

.resource-detail {
  @apply bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50;
}

.detail-content {
  @apply h-full;
}

.detail-header {
  @apply flex items-center justify-between mb-6 pb-4 border-b border-slate-700/50;
}

.detail-title {
  @apply text-lg font-semibold text-white;
}

.detail-actions {
  @apply flex items-center gap-2;
}

.detail-sections {
  @apply space-y-6;
}

.detail-section {
  @apply space-y-4;
}

.section-title {
  @apply text-white font-medium;
}

.info-grid {
  @apply grid grid-cols-1 md:grid-cols-2 gap-4;
}

.info-item {
  @apply flex items-center gap-2;
}

.info-label {
  @apply text-slate-400 min-w-[5rem];
}

.info-value {
  @apply text-white;
}

.containers-info {
  @apply space-y-4;
}

.container-item {
  @apply bg-slate-700/30 rounded-lg p-4;
}

.container-header {
  @apply flex items-center justify-between mb-3;
}

.container-name {
  @apply text-white font-medium;
}

.container-details {
  @apply space-y-2;
}

.detail-item {
  @apply flex items-center gap-2 text-sm;
}

.detail-label {
  @apply text-slate-400 min-w-[4rem];
}

.detail-value {
  @apply text-white;
}

.events-list {
  @apply space-y-3 max-h-64 overflow-y-auto;
}

.event-item {
  @apply flex items-start gap-3 p-3 rounded-lg;
}

.event-item.normal {
  @apply bg-green-500/10 border border-green-500/20;
}

.event-item.warning {
  @apply bg-yellow-500/10 border border-yellow-500/20;
}

.event-item.error {
  @apply bg-red-500/10 border border-red-500/20;
}

.event-time {
  @apply text-xs text-slate-400 min-w-[4rem];
}

.event-content {
  @apply flex-1;
}

.event-type {
  @apply text-sm font-medium text-white;
}

.event-message {
  @apply text-sm text-slate-300;
}

.ports-list {
  @apply space-y-2;
}

.port-item {
  @apply flex items-center justify-between p-3 bg-slate-700/30 rounded-lg;
}

.port-name {
  @apply text-white font-medium;
}

.port-details {
  @apply text-slate-400;
}

.related-pods {
  @apply space-y-2;
}

.related-pod-item {
  @apply flex items-center justify-between p-3 bg-slate-700/30 rounded-lg;
}

.pod-name {
  @apply text-white;
}

.replicas-status {
  @apply flex items-center gap-6;
}

.status-chart {
  @apply flex-shrink-0;
}

.status-details {
  @apply space-y-2;
}

.status-item {
  @apply flex items-center gap-2;
}

.status-label {
  @apply text-slate-400 min-w-[3rem];
}

.status-value {
  @apply text-white font-medium;
}

.resource-usage {
  @apply space-y-4;
}

.usage-chart {
  @apply space-y-4;
}

.chart-item {
  @apply space-y-2;
}

.chart-header {
  @apply flex items-center justify-between;
}

.chart-title {
  @apply text-white font-medium;
}

.chart-value {
  @apply text-slate-300;
}

.node-pods {
  @apply space-y-3 max-h-64 overflow-y-auto;
}

.node-pod-item {
  @apply flex items-center justify-between p-3 bg-slate-700/30 rounded-lg;
}

.pod-info {
  @apply space-y-1;
}

.pod-name {
  @apply text-white font-medium;
}

.pod-namespace {
  @apply text-slate-400 text-sm;
}

.pod-resources {
  @apply flex items-center gap-4 text-sm text-slate-300;
}

.resource-text {
  @apply text-slate-300;
}

.empty-detail {
  @apply flex flex-col items-center justify-center h-full text-center;
}

.empty-icon {
  @apply text-slate-500 mb-4;
}

.empty-detail h3 {
  @apply text-white font-medium mb-2;
}

.empty-detail p {
  @apply text-slate-400;
}

.deploy-modal,
.cluster-modal {
  @apply w-full max-w-4xl;
}

.deploy-form,
.cluster-form {
  @apply space-y-6;
}

.form-section {
  @apply space-y-4;
}

.form-section-title {
  @apply text-white font-medium pb-2 border-b border-slate-700/50;
}

.form-row {
  @apply grid grid-cols-1 md:grid-cols-2 gap-4;
}

.form-item {
  @apply flex-1;
}

.env-var-input,
.port-input {
  @apply flex items-center gap-2;
}

.modal-actions {
  @apply flex justify-end gap-3 pt-4 border-t border-slate-700/50;
}

.clusters-management,
.namespaces-management {
  @apply space-y-4;
}

.management-header {
  @apply flex justify-end;
}

.clusters-table {
  @apply bg-slate-700/30 rounded-lg;
}

.namespaces-list {
  @apply space-y-3;
}

.namespace-item {
  @apply flex items-center justify-between p-4 bg-slate-700/30 rounded-lg;
}

.namespace-info h5 {
  @apply text-white font-medium;
}

.namespace-info p {
  @apply text-slate-400 text-sm;
}

.namespace-stats {
  @apply flex items-center gap-4 text-sm text-slate-300;
}

.stat {
  @apply text-slate-300;
}

.namespace-actions {
  @apply flex items-center gap-2;
}
</style>