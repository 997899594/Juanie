<template>
  <div class="gateway-page">
    <!-- 页面头部 -->
    <div class="page-header">
      <h1 class="page-title">API网关管理</h1>
      <div class="header-actions">
        <n-button type="primary" @click="refreshData" :loading="loading">
          <template #icon>
            <n-icon><RefreshIcon /></n-icon>
          </template>
          刷新数据
        </n-button>
        <n-button type="info" @click="syncRoutes">
          <template #icon>
            <n-icon><SyncIcon /></n-icon>
          </template>
          同步路由
        </n-button>
      </div>
    </div>

    <!-- 概览卡片 -->
    <div class="overview-cards">
      <div class="overview-card">
        <div class="card-header">
          <span class="card-title">总路由数</span>
          <div class="card-icon">🛣️</div>
        </div>
        <div class="card-value">{{ routes.length }}</div>
        <div class="card-trend trend-up">
          <n-icon><TrendingUpIcon /></n-icon>
          <span>+12% 本周</span>
        </div>
      </div>

      <div class="overview-card">
        <div class="card-header">
          <span class="card-title">总请求量</span>
          <div class="card-icon">📊</div>
        </div>
        <div class="card-value">2.4M</div>
        <div class="card-trend trend-up">
          <n-icon><TrendingUpIcon /></n-icon>
          <span>+8% 今日</span>
        </div>
      </div>

      <div class="overview-card">
        <div class="card-header">
          <span class="card-title">平均延迟</span>
          <div class="card-icon">⚡</div>
        </div>
        <div class="card-value">45ms</div>
        <div class="card-trend trend-down">
          <n-icon><TrendingDownIcon /></n-icon>
          <span>-5% 优化</span>
        </div>
      </div>

      <div class="overview-card">
        <div class="card-header">
          <span class="card-title">错误率</span>
          <div class="card-icon">⚠️</div>
        </div>
        <div class="card-value">0.12%</div>
        <div class="card-trend trend-down">
          <n-icon><TrendingDownIcon /></n-icon>
          <span>-2% 改善</span>
        </div>
      </div>
    </div>

    <!-- 实时监控图表 -->
    <div class="charts-section">
      <div class="chart-card">
        <h3 class="chart-title">请求量趋势</h3>
        <div class="chart-placeholder">
          实时请求量图表
        </div>
      </div>
      <div class="chart-card">
        <h3 class="chart-title">响应时间分布</h3>
        <div class="chart-placeholder">
          响应时间分布图表
        </div>
      </div>
    </div>

    <!-- 主要内容区域 -->
    <div class="content-tabs">
      <n-tabs v-model:value="activeTab" type="line" animated>
        <!-- 路由管理 -->
        <n-tab-pane name="routes" tab="路由管理">
          <div class="tab-content">
            <div class="section-header">
              <h2 class="section-title">API路由列表</h2>
              <div class="section-actions">
                <n-button @click="exportRoutes">导出配置</n-button>
                <n-button @click="importRoutes">导入配置</n-button>
                <n-button type="primary" @click="showRouteModal = true">
                  <template #icon>
                    <n-icon><PlusIcon /></n-icon>
                  </template>
                  新建路由
                </n-button>
              </div>
            </div>

            <div class="filters">
              <n-input 
                v-model:value="routeSearchQuery" 
                placeholder="搜索路由..." 
                style="width: 300px;"
              >
                <template #prefix>
                  <n-icon><SearchIcon /></n-icon>
                </template>
              </n-input>
              <n-select 
                v-model:value="routeStatusFilter" 
                placeholder="状态筛选" 
                style="width: 150px;"
                :options="[
                  { label: '全部', value: '' },
                  { label: '活跃', value: 'active' },
                  { label: '停用', value: 'inactive' }
                ]"
              />
              <n-select 
                v-model:value="routeMethodFilter" 
                placeholder="方法筛选" 
                style="width: 150px;"
                :options="[
                  { label: '全部', value: '' },
                  { label: 'GET', value: 'GET' },
                  { label: 'POST', value: 'POST' },
                  { label: 'PUT', value: 'PUT' },
                  { label: 'DELETE', value: 'DELETE' }
                ]"
              />
            </div>

            <div class="routes-list">
              <div v-for="route in filteredRoutes" :key="route.id" class="route-card">
                <div class="route-header">
                  <div class="route-name">{{ route.name }}</div>
                  <div :class="['route-status', route.status]">
                    {{ route.status === 'active' ? '活跃' : '停用' }}
                  </div>
                </div>
                
                <div class="route-info">
                  <div class="route-info-item">
                    <span class="info-label">方法</span>
                    <n-tag :type="getMethodType(route.method)" size="small">
                      {{ route.method }}
                    </n-tag>
                  </div>
                  <div class="route-info-item">
                    <span class="info-label">路径</span>
                    <span class="info-value">{{ route.path }}</span>
                  </div>
                  <div class="route-info-item">
                    <span class="info-label">服务</span>
                    <span class="info-value">{{ route.service }}</span>
                  </div>
                  <div class="route-info-item">
                    <span class="info-label">上游</span>
                    <span class="info-value">{{ route.upstream }}</span>
                  </div>
                </div>

                <div class="route-metrics">
                  <div class="metric-item">
                    <div class="metric-value">{{ route.requests.toLocaleString() }}</div>
                    <div class="metric-label">请求数</div>
                  </div>
                  <div class="metric-item">
                    <div class="metric-value">{{ route.avgLatency }}ms</div>
                    <div class="metric-label">平均延迟</div>
                  </div>
                  <div class="metric-item">
                    <div class="metric-value">{{ route.errorRate }}%</div>
                    <div class="metric-label">错误率</div>
                  </div>
                </div>

                <div class="route-actions">
                  <n-button size="small" @click="testRoute(route)">测试</n-button>
                  <n-button size="small" @click="editRoute(route)">编辑</n-button>
                  <n-button size="small" type="error" @click="deleteRoute(route)">删除</n-button>
                </div>
              </div>
            </div>
          </div>
        </n-tab-pane>

        <!-- 限流策略 -->
        <n-tab-pane name="rate-limit" tab="限流策略">
          <div class="tab-content">
            <div class="section-header">
              <h2 class="section-title">限流策略管理</h2>
              <div class="section-actions">
                <n-button type="primary" @click="showRateLimitModal = true">
                  <template #icon>
                    <n-icon><PlusIcon /></n-icon>
                  </template>
                  新建策略
                </n-button>
              </div>
            </div>

            <div class="filters">
              <n-input 
                v-model:value="rateLimitSearchQuery" 
                placeholder="搜索限流策略..." 
                style="width: 300px;"
              >
                <template #prefix>
                  <n-icon><SearchIcon /></n-icon>
                </template>
              </n-input>
              <n-select 
                v-model:value="rateLimitTypeFilter" 
                placeholder="类型筛选" 
                style="width: 150px;"
                :options="[
                  { label: '全部', value: '' },
                  { label: 'IP限流', value: 'IP限流' },
                  { label: '用户限流', value: '用户限流' },
                  { label: '接口限流', value: '接口限流' }
                ]"
              />
            </div>

            <div class="policies-list">
              <div v-for="policy in filteredRateLimitPolicies" :key="policy.id" class="policy-card">
                <div class="policy-header">
                  <div class="policy-name">{{ policy.name }}</div>
                  <div class="policy-toggle">
                    <n-switch 
                      v-model:value="policy.enabled" 
                      @update:value="toggleRateLimit(policy)"
                    />
                    <span>{{ policy.enabled ? '启用' : '禁用' }}</span>
                  </div>
                </div>
                
                <div class="policy-info">
                  <div class="route-info-item">
                    <span class="info-label">类型</span>
                    <span class="info-value">{{ policy.type }}</span>
                  </div>
                  <div class="route-info-item">
                    <span class="info-label">限制</span>
                    <span class="info-value">{{ policy.limit }}/{{ policy.window }}</span>
                  </div>
                  <div class="route-info-item">
                    <span class="info-label">范围</span>
                    <span class="info-value">{{ policy.scope }}</span>
                  </div>
                  <div class="route-info-item">
                    <span class="info-label">触发次数</span>
                    <span class="info-value">{{ policy.triggerCount }}</span>
                  </div>
                </div>

                <div class="usage-bar">
                  <div 
                    class="usage-fill" 
                    :style="{ width: `${(policy.currentUsage / policy.limit) * 100}%` }"
                  ></div>
                </div>

                <div class="policy-actions">
                  <n-button size="small" @click="viewRateLimitStats(policy)">统计</n-button>
                  <n-button size="small" @click="testRateLimit(policy)">测试</n-button>
                  <n-button size="small" @click="editRateLimit(policy)">编辑</n-button>
                </div>
              </div>
            </div>
          </div>
        </n-tab-pane>

        <!-- 熔断器 -->
        <n-tab-pane name="circuit-breaker" tab="熔断器">
          <div class="tab-content">
            <div class="section-header">
              <h2 class="section-title">熔断器管理</h2>
              <div class="section-actions">
                <n-button @click="resetAllCircuitBreakers">重置全部</n-button>
                <n-button type="primary" @click="showCircuitBreakerModal = true">
                  <template #icon>
                    <n-icon><PlusIcon /></n-icon>
                  </template>
                  新建熔断器
                </n-button>
              </div>
            </div>

            <div class="filters">
              <n-input 
                v-model:value="circuitBreakerSearchQuery" 
                placeholder="搜索熔断器..." 
                style="width: 300px;"
              >
                <template #prefix>
                  <n-icon><SearchIcon /></n-icon>
                </template>
              </n-input>
              <n-select 
                v-model:value="circuitBreakerStateFilter" 
                placeholder="状态筛选" 
                style="width: 150px;"
                :options="[
                  { label: '全部', value: '' },
                  { label: '关闭', value: 'CLOSED' },
                  { label: '打开', value: 'OPEN' },
                  { label: '半开', value: 'HALF_OPEN' }
                ]"
              />
            </div>

            <div class="breakers-list">
              <div v-for="breaker in filteredCircuitBreakers" :key="breaker.id" class="breaker-card">
                <div class="breaker-header">
                  <div class="breaker-name">{{ breaker.name }}</div>
                  <n-tag 
                    :type="getCircuitBreakerStateType(breaker.state)" 
                    :class="getCircuitBreakerClass(breaker.state)"
                    class="breaker-state"
                  >
                    {{ breaker.state === 'CLOSED' ? '关闭' : breaker.state === 'OPEN' ? '打开' : '半开' }}
                  </n-tag>
                </div>
                
                <div class="breaker-metrics">
                  <div class="route-info-item">
                    <span class="info-label">服务</span>
                    <span class="info-value">{{ breaker.service }}</span>
                  </div>
                  <div class="route-info-item">
                    <span class="info-label">成功率</span>
                    <span class="info-value" :style="{ color: getSuccessRateColor(breaker.successRate) }">
                      {{ breaker.successRate }}%
                    </span>
                  </div>
                  <div class="route-info-item">
                    <span class="info-label">响应时间</span>
                    <span class="info-value">{{ breaker.avgResponseTime }}ms</span>
                  </div>
                  <div class="route-info-item">
                    <span class="info-label">请求数</span>
                    <span class="info-value">{{ breaker.requestCount }}</span>
                  </div>
                </div>

                <div class="breaker-actions">
                  <n-button size="small" @click="viewCircuitBreakerLogs(breaker)">日志</n-button>
                  <n-button size="small" @click="resetCircuitBreaker(breaker)">重置</n-button>
                  <n-button size="small" @click="editCircuitBreaker(breaker)">编辑</n-button>
                </div>
              </div>
            </div>
          </div>
        </n-tab-pane>

        <!-- API文档 -->
        <n-tab-pane name="docs" tab="API文档">
          <div class="tab-content">
            <div class="section-header">
              <h2 class="section-title">API文档管理</h2>
              <div class="section-actions">
                <n-button @click="generateDocs">生成文档</n-button>
                <n-button @click="exportDocs">导出文档</n-button>
                <n-button type="primary" @click="showApiModal = true">
                  <template #icon>
                    <n-icon><PlusIcon /></n-icon>
                  </template>
                  新建API
                </n-button>
              </div>
            </div>

            <div class="filters">
              <n-input 
                v-model:value="docsSearchQuery" 
                placeholder="搜索API..." 
                style="width: 300px;"
              >
                <template #prefix>
                  <n-icon><SearchIcon /></n-icon>
                </template>
              </n-input>
              <n-input 
                v-model:value="docsTagFilter" 
                placeholder="标签筛选..." 
                style="width: 200px;"
              />
            </div>

            <div class="docs-layout">
              <div class="docs-sidebar">
                <div v-for="group in apiGroups" :key="group.id" class="api-group">
                  <div class="group-title" @click="selectGroup(group.id)">
                    {{ group.name }}
                  </div>
                  <ul class="api-list">
                    <li 
                      v-for="api in group.apis" 
                      :key="api.id"
                      :class="['api-item', { selected: selectedApi === api.id }]"
                      @click="selectApi(api)"
                    >
                      <span :class="['api-method', api.method.toLowerCase()]">
                        {{ api.method }}
                      </span>
                      <span class="api-name">{{ api.name }}</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div class="docs-content">
                <div v-if="selectedApiDetails" class="api-detail">
                  <div class="api-title">
                    <span :class="['api-method', selectedApiDetails.method.toLowerCase()]">
                      {{ selectedApiDetails.method }}
                    </span>
                    {{ selectedApiDetails.name }}
                    <n-button size="small" @click="testApi(selectedApiDetails)">测试</n-button>
                    <n-button size="small" @click="copyApiUrl(selectedApiDetails)">复制</n-button>
                  </div>
                  
                  <div class="api-description">
                    {{ selectedApiDetails.description }}
                  </div>

                  <div class="api-section">
                    <h3 class="section-title">请求路径</h3>
                    <div class="code-block">{{ selectedApiDetails.path }}</div>
                  </div>

                  <div class="api-section" v-if="selectedApiDetails.parameters?.length">
                    <h3 class="section-title">请求参数</h3>
                    <table class="parameter-table">
                      <thead>
                        <tr>
                          <th>参数名</th>
                          <th>类型</th>
                          <th>位置</th>
                          <th>必填</th>
                          <th>说明</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="param in selectedApiDetails.parameters" :key="param.name">
                          <td>{{ param.name }}</td>
                          <td><span class="parameter-type">{{ param.type }}</span></td>
                          <td>{{ param.in }}</td>
                          <td>
                            <span v-if="param.required" class="parameter-required">是</span>
                            <span v-else>否</span>
                          </td>
                          <td>{{ param.description }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div class="api-section" v-if="selectedApiDetails.responses?.length">
                    <h3 class="section-title">响应示例</h3>
                    <div v-for="response in selectedApiDetails.responses" :key="response.code">
                      <h4>
                        <span class="response-code">{{ response.code }}</span>
                        {{ response.description }}
                      </h4>
                      <div class="code-block">{{ JSON.stringify(response.example, null, 2) }}</div>
                    </div>
                  </div>
                </div>

                <div v-else class="empty-state">
                  <div class="empty-icon">📄</div>
                  <div class="empty-title">选择API查看详情</div>
                  <div class="empty-description">从左侧列表中选择一个API来查看详细文档</div>
                </div>
              </div>
            </div>
          </div>
        </n-tab-pane>
      </n-tabs>
    </div>

    <!-- 新建路由模态框 -->
    <n-modal v-model:show="showRouteModal" preset="dialog" title="新建路由">
      <div class="modal-form">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">路由名称 *</label>
            <n-input v-model:value="routeForm.name" placeholder="输入路由名称" />
          </div>
          <div class="form-group">
            <label class="form-label">HTTP方法</label>
            <n-select 
              v-model:value="routeForm.method" 
              :options="[
                { label: 'GET', value: 'GET' },
                { label: 'POST', value: 'POST' },
                { label: 'PUT', value: 'PUT' },
                { label: 'DELETE', value: 'DELETE' },
                { label: 'PATCH', value: 'PATCH' }
              ]"
            />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">路径 *</label>
            <n-input v-model:value="routeForm.path" placeholder="/api/v1/example" />
          </div>
          <div class="form-group">
            <label class="form-label">服务名称</label>
            <n-input v-model:value="routeForm.service" placeholder="service-name" />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">上游地址</label>
            <n-input v-model:value="routeForm.upstream" placeholder="http://upstream-service:8080" />
          </div>
          <div class="form-group">
            <label class="form-label">负载均衡</label>
            <n-select 
              v-model:value="routeForm.loadBalancer" 
              :options="[
                { label: '轮询', value: 'round_robin' },
                { label: '最少连接', value: 'least_conn' },
                { label: 'IP哈希', value: 'ip_hash' }
              ]"
            />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">超时时间(ms)</label>
            <n-input-number v-model:value="routeForm.timeout" :min="1000" :max="60000" />
          </div>
          <div class="form-group">
            <label class="form-label">重试次数</label>
            <n-input-number v-model:value="routeForm.retries" :min="0" :max="10" />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">认证方式</label>
            <n-select 
              v-model:value="routeForm.auth" 
              :options="[
                { label: '无认证', value: 'none' },
                { label: 'API Key', value: 'api_key' },
                { label: 'JWT', value: 'jwt' },
                { label: 'OAuth2', value: 'oauth2' }
              ]"
            />
          </div>
          <div class="form-group">
            <label class="form-label">选项</label>
            <div style="display: flex; gap: 16px;">
              <n-checkbox v-model:checked="routeForm.cors">启用CORS</n-checkbox>
              <n-checkbox v-model:checked="routeForm.enabled">启用路由</n-checkbox>
              <n-checkbox v-model:checked="routeForm.logging">记录日志</n-checkbox>
            </div>
          </div>
        </div>
      </div>

      <template #action>
        <n-button @click="showRouteModal = false">取消</n-button>
        <n-button type="primary" @click="createRoute">创建</n-button>
      </template>
    </n-modal>

    <!-- 新建限流策略模态框 -->
    <n-modal v-model:show="showRateLimitModal" preset="dialog" title="新建限流策略">
      <div class="modal-form">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">策略名称 *</label>
            <n-input v-model:value="rateLimitForm.name" placeholder="输入策略名称" />
          </div>
          <div class="form-group">
            <label class="form-label">限流类型</label>
            <n-select 
              v-model:value="rateLimitForm.type" 
              :options="[
                { label: 'IP限流', value: 'IP限流' },
                { label: '用户限流', value: '用户限流' },
                { label: '接口限流', value: '接口限流' }
              ]"
            />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">描述</label>
          <n-input 
            v-model:value="rateLimitForm.description" 
            type="textarea" 
            placeholder="输入策略描述"
            :rows="3"
          />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">限制数量 *</label>
            <n-input-number v-model:value="rateLimitForm.limit" :min="1" :max="10000" />
          </div>
          <div class="form-group">
            <label class="form-label">时间窗口</label>
            <n-select 
              v-model:value="rateLimitForm.window" 
              :options="[
                { label: '1分钟', value: '1分钟' },
                { label: '5分钟', value: '5分钟' },
                { label: '1小时', value: '1小时' },
                { label: '1天', value: '1天' }
              ]"
            />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">应用范围</label>
            <n-select 
              v-model:value="rateLimitForm.scope" 
              :options="[
                { label: '全局', value: '全局' },
                { label: '单个路由', value: '单个路由' },
                { label: '路由组', value: '路由组' }
              ]"
            />
          </div>
          <div class="form-group">
            <label class="form-label">限流键</label>
            <n-input v-model:value="rateLimitForm.key" placeholder="ip, user_id, api_key" />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">状态码</label>
            <n-input-number v-model:value="rateLimitForm.statusCode" :min="400" :max="599" />
          </div>
          <div class="form-group">
            <label class="form-label">响应消息</label>
            <n-input v-model:value="rateLimitForm.message" placeholder="限流提示消息" />
          </div>
        </div>

        <div class="form-group">
          <div style="display: flex; gap: 16px;">
            <n-checkbox v-model:checked="rateLimitForm.enabled">启用策略</n-checkbox>
            <n-checkbox v-model:checked="rateLimitForm.alert">触发告警</n-checkbox>
          </div>
        </div>
      </div>

      <template #action>
        <n-button @click="showRateLimitModal = false">取消</n-button>
        <n-button type="primary" @click="createRateLimit">创建</n-button>
      </template>
    </n-modal>

    <!-- 新建熔断器模态框 -->
    <n-modal v-model:show="showCircuitBreakerModal" preset="dialog" title="新建熔断器">
      <div class="modal-form">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">熔断器名称 *</label>
            <n-input v-model:value="circuitBreakerForm.name" placeholder="输入熔断器名称" />
          </div>
          <div class="form-group">
            <label class="form-label">服务名称 *</label>
            <n-input v-model:value="circuitBreakerForm.service" placeholder="输入服务名称" />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">描述</label>
          <n-input 
            v-model:value="circuitBreakerForm.description" 
            type="textarea" 
            placeholder="输入熔断器描述"
            :rows="3"
          />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">失败阈值(%)</label>
            <n-input-number v-model:value="circuitBreakerForm.failureThreshold" :min="1" :max="100" />
          </div>
          <div class="form-group">
            <label class="form-label">最小请求数</label>
            <n-input-number v-model:value="circuitBreakerForm.minRequests" :min="1" :max="1000" />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">超时时间(ms)</label>
            <n-input-number v-model:value="circuitBreakerForm.timeout" :min="1000" :max="60000" />
          </div>
          <div class="form-group">
            <label class="form-label">恢复时间(s)</label>
            <n-input-number v-model:value="circuitBreakerForm.recoveryTime" :min="10" :max="300" />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">统计窗口(s)</label>
            <n-input-number v-model:value="circuitBreakerForm.statisticsWindow" :min="30" :max="600" />
          </div>
          <div class="form-group">
            <label class="form-label">半开请求数</label>
            <n-input-number v-model:value="circuitBreakerForm.halfOpenRequests" :min="1" :max="20" />
          </div>
        </div>

        <div class="form-group">
          <div style="display: flex; gap: 16px;">
            <n-checkbox v-model:checked="circuitBreakerForm.enabled">启用熔断器</n-checkbox>
            <n-checkbox v-model:checked="circuitBreakerForm.alert">触发告警</n-checkbox>
          </div>
        </div>
      </div>

      <template #action>
        <n-button @click="showCircuitBreakerModal = false">取消</n-button>
        <n-button type="primary" @click="createCircuitBreaker">创建</n-button>
      </template>
    </n-modal>

    <!-- 新建API模态框 -->
    <n-modal v-model:show="showApiModal" preset="dialog" title="新建API" style="width: 800px;">
      <div class="modal-form">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">API名称 *</label>
            <n-input v-model:value="apiForm.name" placeholder="输入API名称" />
          </div>
          <div class="form-group">
            <label class="form-label">HTTP方法</label>
            <n-select 
              v-model:value="apiForm.method" 
              :options="[
                { label: 'GET', value: 'GET' },
                { label: 'POST', value: 'POST' },
                { label: 'PUT', value: 'PUT' },
                { label: 'DELETE', value: 'DELETE' },
                { label: 'PATCH', value: 'PATCH' }
              ]"
            />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">API路径 *</label>
            <n-input v-model:value="apiForm.path" placeholder="/api/v1/example" />
          </div>
          <div class="form-group">
            <label class="form-label">分组</label>
            <n-input v-model:value="apiForm.group" placeholder="用户管理" />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">描述</label>
          <n-input 
            v-model:value="apiForm.description" 
            type="textarea" 
            placeholder="输入API描述"
            :rows="3"
          />
        </div>

        <div class="form-group">
          <label class="form-label">请求参数</label>
          <div v-for="(param, index) in apiForm.parameters" :key="index" class="parameter-form">
            <div class="parameter-header">
              <span class="parameter-title">参数 {{ index + 1 }}</span>
              <n-icon 
                class="remove-parameter" 
                @click="apiForm.parameters.splice(index, 1)"
                v-if="apiForm.parameters.length > 1"
              >
                <TrashIcon />
              </n-icon>
            </div>
            <div class="form-row">
              <div class="form-group">
                <n-input v-model:value="param.name" placeholder="参数名" />
              </div>
              <div class="form-group">
                <n-select 
                  v-model:value="param.type" 
                  :options="[
                    { label: 'string', value: 'string' },
                    { label: 'number', value: 'number' },
                    { label: 'boolean', value: 'boolean' },
                    { label: 'array', value: 'array' },
                    { label: 'object', value: 'object' }
                  ]"
                />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <n-select 
                  v-model:value="param.in" 
                  :options="[
                    { label: 'query', value: 'query' },
                    { label: 'path', value: 'path' },
                    { label: 'header', value: 'header' },
                    { label: 'body', value: 'body' }
                  ]"
                />
              </div>
              <div class="form-group">
                <n-checkbox v-model:checked="param.required">必填</n-checkbox>
              </div>
            </div>
            <div class="form-group">
              <n-input v-model:value="param.description" placeholder="参数描述" />
            </div>
          </div>
          <n-button 
            class="add-parameter" 
            dashed 
            @click="apiForm.parameters.push(createParameter())"
          >
            添加参数
          </n-button>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">成功状态码</label>
            <n-input-number v-model:value="apiForm.successCode" :min="200" :max="299" />
          </div>
          <div class="form-group">
            <label class="form-label">响应类型</label>
            <n-select 
              v-model:value="apiForm.contentType" 
              :options="[
                { label: 'application/json', value: 'application/json' },
                { label: 'application/xml', value: 'application/xml' },
                { label: 'text/plain', value: 'text/plain' }
              ]"
            />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">响应示例</label>
          <n-input 
            v-model:value="apiForm.responseExample" 
            type="textarea" 
            placeholder='{"code": 200, "data": {}, "message": "success"}'
            :rows="4"
          />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">版本</label>
            <n-input v-model:value="apiForm.version" placeholder="v1.0.0" />
          </div>
          <div class="form-group">
            <label class="form-label">标签</label>
            <n-input v-model:value="apiForm.tags" placeholder="用户,管理,CRUD" />
          </div>
        </div>

        <div class="form-group">
          <div style="display: flex; gap: 16px;">
            <n-checkbox v-model:checked="apiForm.enabled">启用API</n-checkbox>
            <n-checkbox v-model:checked="apiForm.deprecated">已废弃</n-checkbox>
          </div>
        </div>
      </div>

      <template #action>
        <n-button @click="showApiModal = false">取消</n-button>
        <n-button type="primary" @click="createApi">创建</n-button>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useMessage } from 'naive-ui'
import { 
  RefreshCcw as RefreshIcon,
  RotateCcw as SyncIcon,
  Plus as PlusIcon,
  Search as SearchIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Trash2 as TrashIcon
} from 'lucide-vue-next'
import { getRoutes } from '@/api/gateway'

const message = useMessage()

// 响应式数据
const loading = ref(false)
const activeTab = ref('routes')

// 搜索和筛选
const routeSearchQuery = ref('')
const routeStatusFilter = ref('')
const routeMethodFilter = ref('')
const rateLimitSearchQuery = ref('')
const rateLimitTypeFilter = ref('')
const circuitBreakerSearchQuery = ref('')
const circuitBreakerStateFilter = ref('')
const docsSearchQuery = ref('')
const docsTagFilter = ref('')

// 模态框状态
const showRouteModal = ref(false)
const showRateLimitModal = ref(false)
const showCircuitBreakerModal = ref(false)
const showApiModal = ref(false)

// 选中状态
const selectedGroup = ref('')
const selectedApi = ref('')
const selectedApiDetails = ref(null)

// 表单数据
const routeForm = ref({
  name: '',
  method: 'GET',
  path: '',
  service: '',
  upstream: '',
  loadBalancer: 'round_robin',
  timeout: 5000,
  retries: 3,
  auth: 'none',
  cors: true,
  enabled: true,
  logging: true
})

const rateLimitForm = ref({
  name: '',
  type: 'IP限流',
  description: '',
  limit: 100,
  window: '1分钟',
  scope: '全局',
  key: 'ip',
  statusCode: 429,
  message: '请求过于频繁，请稍后再试',
  enabled: true,
  alert: true
})

const circuitBreakerForm = ref({
  name: '',
  service: '',
  description: '',
  failureThreshold: 50,
  minRequests: 10,
  timeout: 5000,
  recoveryTime: 30,
  statisticsWindow: 60,
  halfOpenRequests: 5,
  enabled: true,
  alert: true
})

const apiForm = ref({
  name: '',
  method: 'GET',
  path: '',
  group: '',
  description: '',
  parameters: [{ name: '', type: 'string', in: 'query', description: '', required: false }],
  successCode: 200,
  contentType: 'application/json',
  responseExample: '',
  version: 'v1.0.0',
  tags: '',
  enabled: true,
  deprecated: false
})

// 路由数据 - 从API获取
const routes = ref([])

const rateLimitPolicies = ref([
  {
    id: '1',
    name: 'API访问限制',
    type: 'IP限流',
    limit: 1000,
    window: '1小时',
    scope: '全局',
    enabled: true,
    currentUsage: 750,
    triggerCount: 23,
    lastTriggered: new Date(Date.now() - 2 * 60 * 60 * 1000)
  },
  {
    id: '2',
    name: '登录接口限制',
    type: '接口限流',
    limit: 10,
    window: '1分钟',
    scope: '单个路由',
    enabled: true,
    currentUsage: 3,
    triggerCount: 156,
    lastTriggered: new Date(Date.now() - 30 * 60 * 1000)
  }
])

const circuitBreakers = ref([
  {
    id: '1',
    name: '用户服务熔断器',
    service: 'user-service',
    state: 'CLOSED',
    successRate: 98.5,
    avgResponseTime: 45,
    requestCount: 1250,
    failureThreshold: 50,
    timeout: 5000,
    recoveryTime: 30
  },
  {
    id: '2',
    name: '订单服务熔断器',
    service: 'order-service',
    state: 'OPEN',
    successRate: 45.2,
    avgResponseTime: 2500,
    requestCount: 890,
    failureThreshold: 50,
    timeout: 5000,
    recoveryTime: 30
  },
  {
    id: '3',
    name: '支付服务熔断器',
    service: 'payment-service',
    state: 'HALF_OPEN',
    successRate: 75.8,
    avgResponseTime: 120,
    requestCount: 450,
    failureThreshold: 50,
    timeout: 5000,
    recoveryTime: 30
  }
])

const apis = ref([
  {
    id: '1',
    name: '用户登录',
    method: 'POST',
    path: '/api/v1/auth/login',
    group: '认证管理',
    summary: '用户登录接口，支持邮箱和手机号登录',
    description: '用户可以通过邮箱或手机号进行登录，系统会验证用户凭据并返回访问令牌。',
    deprecated: false,
    version: 'v1.0.0',
    tags: ['认证', '登录', '用户'],
    parameters: [
      { name: 'email', type: 'string', in: 'body', description: '用户邮箱', required: true },
      { name: 'password', type: 'string', in: 'body', description: '用户密码', required: true }
    ],
    responses: [
      {
        code: '200',
        description: '登录成功',
        example: {
          code: 200,
          message: '登录成功',
          data: {
            token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            user: {
              id: 1,
              email: 'user@example.com',
              name: '用户名'
            }
          }
        }
      }
    ]
  }

  const newApi = {
    id: Date.now().toString(),
    name: apiForm.value.name,
    method: apiForm.value.method,
    path: apiForm.value.path,
    group: apiForm.value.group,
    description: apiForm.value.description,
    deprecated: apiForm.value.deprecated,
    version: apiForm.value.version,
    tags: apiForm.value.tags.split(',').map(tag => tag.trim()),
    parameters: apiForm.value.parameters,
    responses: [
      {
        code: apiForm.value.successCode.toString(),
        description: '成功',
        example: JSON.parse(apiForm.value.responseExample || '{}')
      }
    ]
  }

   apis.value.push(newApi)
   message.success(`API ${apiForm.value.name} 创建成功`)
   showApiModal.value = false

   // 重置表单
   apiForm.value = {
     name: '',
     method: 'GET',
     path: '',
     group: '',
     description: '',
     parameters: [{ name: '', type: 'string', in: 'query', description: '', required: false }],
     successCode: 200,
     contentType: 'application/json',
     responseExample: '',
     version: 'v1.0.0',
     tags: '',
     enabled: true,
     deprecated: false
   }
 }

 onMounted(() => {
  // 初始化数据
  refreshData()
  if (apis.value.length > 0) {
    selectedApiDetails.value = apis.value[0]
    selectedApi.value = apis.value[0].id
  }
})
 </script>

 <style scoped>
 .gateway-page {
   padding: 24px;
   background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
   min-height: 100vh;
   color: white;
 }

 .page-header {
   display: flex;
   justify-content: space-between;
   align-items: center;
   margin-bottom: 32px;
   padding: 24px;
   background: rgba(255, 255, 255, 0.1);
   backdrop-filter: blur(10px);
   border-radius: 16px;
   border: 1px solid rgba(255, 255, 255, 0.2);
 }

 .page-title {
   font-size: 28px;
   font-weight: 700;
   margin: 0;
   background: linear-gradient(45deg, #fff, #e0e7ff);
   -webkit-background-clip: text;
   -webkit-text-fill-color: transparent;
   background-clip: text;
 }

 .header-actions {
   display: flex;
   gap: 12px;
 }

 .overview-cards {
   display: grid;
   grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
   gap: 24px;
   margin-bottom: 32px;
 }

 .overview-card {
   background: rgba(255, 255, 255, 0.1);
   backdrop-filter: blur(10px);
   border-radius: 16px;
   padding: 24px;
   border: 1px solid rgba(255, 255, 255, 0.2);
   transition: all 0.3s ease;
 }

 .overview-card:hover {
   transform: translateY(-4px);
   box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
 }

 .card-header {
   display: flex;
   justify-content: space-between;
   align-items: center;
   margin-bottom: 16px;
 }

 .card-title {
   font-size: 14px;
   font-weight: 500;
   color: rgba(255, 255, 255, 0.8);
 }

 .card-icon {
   font-size: 24px;
 }

 .card-value {
   font-size: 32px;
   font-weight: 700;
   margin-bottom: 8px;
   color: white;
 }

 .card-trend {
   display: flex;
   align-items: center;
   gap: 4px;
   font-size: 12px;
   font-weight: 500;
 }

 .trend-up {
   color: #10b981;
 }

 .trend-down {
   color: #f59e0b;
 }

 .charts-section {
   display: grid;
   grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
   gap: 24px;
   margin-bottom: 32px;
 }

 .chart-card {
   background: rgba(255, 255, 255, 0.1);
   backdrop-filter: blur(10px);
   border-radius: 16px;
   padding: 24px;
   border: 1px solid rgba(255, 255, 255, 0.2);
 }

 .chart-title {
   font-size: 18px;
   font-weight: 600;
   margin-bottom: 16px;
   color: white;
 }

 .chart-placeholder {
   height: 200px;
   display: flex;
   align-items: center;
   justify-content: center;
   background: rgba(255, 255, 255, 0.05);
   border-radius: 8px;
   color: rgba(255, 255, 255, 0.6);
   font-size: 14px;
 }

 .content-tabs {
   background: rgba(255, 255, 255, 0.1);
   backdrop-filter: blur(10px);
   border-radius: 16px;
   padding: 24px;
   border: 1px solid rgba(255, 255, 255, 0.2);
 }

 .tab-content {
   padding: 24px 0;
 }

 .section-header {
   display: flex;
   justify-content: space-between;
   align-items: center;
   margin-bottom: 24px;
 }

 .section-title {
   font-size: 20px;
   font-weight: 600;
   margin: 0;
   color: white;
 }

 .section-actions {
   display: flex;
   gap: 12px;
 }

 .filters {
   display: flex;
   gap: 16px;
   margin-bottom: 24px;
   flex-wrap: wrap;
 }

 .routes-list,
 .policies-list,
 .breakers-list {
   display: grid;
   gap: 16px;
 }

 .route-card,
 .policy-card,
 .breaker-card {
   background: rgba(255, 255, 255, 0.05);
   border-radius: 12px;
   padding: 20px;
   border: 1px solid rgba(255, 255, 255, 0.1);
   transition: all 0.3s ease;
 }

 .route-card:hover,
 .policy-card:hover,
 .breaker-card:hover {
   background: rgba(255, 255, 255, 0.1);
   transform: translateY(-2px);
 }

 .route-header,
 .policy-header,
 .breaker-header {
   display: flex;
   justify-content: space-between;
   align-items: center;
   margin-bottom: 16px;
 }

 .route-name,
 .policy-name,
 .breaker-name {
   font-size: 16px;
   font-weight: 600;
   color: white;
 }

 .route-status {
   padding: 4px 12px;
   border-radius: 20px;
   font-size: 12px;
   font-weight: 500;
 }

 .route-status.active {
   background: rgba(16, 185, 129, 0.2);
   color: #10b981;
   border: 1px solid rgba(16, 185, 129, 0.3);
 }

 .route-status.inactive {
   background: rgba(156, 163, 175, 0.2);
   color: #9ca3af;
   border: 1px solid rgba(156, 163, 175, 0.3);
 }

 .policy-toggle {
   display: flex;
   align-items: center;
   gap: 8px;
   font-size: 14px;
   color: rgba(255, 255, 255, 0.8);
 }

 .route-info,
 .policy-info,
 .breaker-metrics {
   display: grid;
   grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
   gap: 12px;
   margin-bottom: 16px;
 }

 .route-info-item {
   display: flex;
   flex-direction: column;
   gap: 4px;
 }

 .info-label {
   font-size: 12px;
   color: rgba(255, 255, 255, 0.6);
   font-weight: 500;
 }

 .info-value {
   font-size: 14px;
   color: white;
   font-weight: 500;
 }

 .route-metrics {
   display: flex;
   gap: 24px;
   margin-bottom: 16px;
 }

 .metric-item {
   text-align: center;
 }

 .metric-value {
   font-size: 18px;
   font-weight: 700;
   color: white;
   margin-bottom: 4px;
 }

 .metric-label {
   font-size: 12px;
   color: rgba(255, 255, 255, 0.6);
 }

 .usage-bar {
   height: 4px;
   background: rgba(255, 255, 255, 0.1);
   border-radius: 2px;
   margin-bottom: 16px;
   overflow: hidden;
 }

 .usage-fill {
   height: 100%;
   background: linear-gradient(90deg, #10b981, #059669);
   border-radius: 2px;
   transition: width 0.3s ease;
 }

 .route-actions,
 .policy-actions,
 .breaker-actions {
   display: flex;
   gap: 8px;
   justify-content: flex-end;
 }

 .breaker-state {
   font-weight: 600;
 }

 .breaker-state.closed {
   color: #10b981;
 }

 .breaker-state.open {
   color: #ef4444;
 }

 .breaker-state.half-open {
   color: #f59e0b;
 }

 .docs-layout {
   display: grid;
   grid-template-columns: 300px 1fr;
   gap: 24px;
   height: 600px;
 }

 .docs-sidebar {
   background: rgba(255, 255, 255, 0.05);
   border-radius: 12px;
   padding: 16px;
   overflow-y: auto;
 }

 .api-group {
   margin-bottom: 16px;
 }

 .group-title {
   font-size: 14px;
   font-weight: 600;
   color: white;
   padding: 8px 12px;
   cursor: pointer;
   border-radius: 8px;
   transition: background 0.2s ease;
 }

 .group-title:hover {
   background: rgba(255, 255, 255, 0.1);
 }

 .api-list {
   list-style: none;
   padding: 0;
   margin: 8px 0 0 0;
 }

 .api-item {
   display: flex;
   align-items: center;
   gap: 8px;
   padding: 8px 12px;
   cursor: pointer;
   border-radius: 6px;
   transition: background 0.2s ease;
   font-size: 13px;
 }

 .api-item:hover {
   background: rgba(255, 255, 255, 0.1);
 }

 .api-item.selected {
   background: rgba(255, 255, 255, 0.2);
 }

 .api-method {
   padding: 2px 6px;
   border-radius: 4px;
   font-size: 10px;
   font-weight: 600;
   text-transform: uppercase;
 }

 .api-method.get {
   background: rgba(34, 197, 94, 0.2);
   color: #22c55e;
 }

 .api-method.post {
   background: rgba(59, 130, 246, 0.2);
   color: #3b82f6;
 }

 .api-method.put {
   background: rgba(245, 158, 11, 0.2);
   color: #f59e0b;
 }

 .api-method.delete {
   background: rgba(239, 68, 68, 0.2);
   color: #ef4444;
 }

 .api-method.patch {
   background: rgba(168, 85, 247, 0.2);
   color: #a855f7;
 }

 .api-name {
   color: rgba(255, 255, 255, 0.9);
   flex: 1;
 }

 .docs-content {
   background: rgba(255, 255, 255, 0.05);
   border-radius: 12px;
   padding: 24px;
   overflow-y: auto;
 }

 .api-detail {
   color: white;
 }

 .api-title {
   display: flex;
   align-items: center;
   gap: 12px;
   margin-bottom: 16px;
   font-size: 20px;
   font-weight: 600;
 }

 .api-description {
   font-size: 14px;
   color: rgba(255, 255, 255, 0.8);
   margin-bottom: 24px;
   line-height: 1.6;
 }

 .api-section {
   margin-bottom: 32px;
 }

 .api-section .section-title {
   font-size: 16px;
   font-weight: 600;
   margin-bottom: 12px;
   color: white;
 }

 .code-block {
   background: rgba(0, 0, 0, 0.3);
   border-radius: 8px;
   padding: 16px;
   font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
   font-size: 13px;
   color: #e5e7eb;
   overflow-x: auto;
   white-space: pre-wrap;
 }

 .parameter-table {
   width: 100%;
   border-collapse: collapse;
   margin-top: 12px;
 }

 .parameter-table th,
 .parameter-table td {
   padding: 12px;
   text-align: left;
   border-bottom: 1px solid rgba(255, 255, 255, 0.1);
 }

 .parameter-table th {
   background: rgba(255, 255, 255, 0.05);
   font-weight: 600;
   color: white;
   font-size: 13px;
 }

 .parameter-table td {
   font-size: 13px;
   color: rgba(255, 255, 255, 0.9);
 }

 .parameter-type {
   background: rgba(59, 130, 246, 0.2);
   color: #3b82f6;
   padding: 2px 6px;
   border-radius: 4px;
   font-size: 11px;
   font-weight: 500;
 }

 .parameter-required {
   color: #ef4444;
   font-weight: 600;
 }

 .response-code {
   background: rgba(34, 197, 94, 0.2);
   color: #22c55e;
   padding: 2px 8px;
   border-radius: 4px;
   font-size: 12px;
   font-weight: 600;
 }

 .empty-state {
   text-align: center;
   padding: 60px 20px;
   color: rgba(255, 255, 255, 0.6);
 }

 .empty-icon {
   font-size: 48px;
   margin-bottom: 16px;
   opacity: 0.5;
 }

 .empty-title {
   font-size: 18px;
   font-weight: 600;
   margin-bottom: 8px;
   color: rgba(255, 255, 255, 0.8);
 }

 .empty-description {
   font-size: 14px;
   margin-bottom: 24px;
 }

 .modal-form {
   display: flex;
   flex-direction: column;
   gap: 20px;
 }

 .form-row {
   display: grid;
   grid-template-columns: 1fr 1fr;
   gap: 16px;
 }

 .form-group {
   display: flex;
   flex-direction: column;
   gap: 8px;
 }

 .form-label {
   font-size: 14px;
   font-weight: 500;
   color: #333;
 }

 .parameter-form {
   background: #f5f5f5;
   border-radius: 8px;
   padding: 16px;
   margin-bottom: 12px;
 }

 .parameter-header {
   display: flex;
   justify-content: space-between;
   align-items: center;
   margin-bottom: 12px;
 }

 .parameter-title {
   font-size: 14px;
   font-weight: 600;
   color: #333;
 }

 .remove-parameter {
   color: #ff4d4f;
   cursor: pointer;
   padding: 4px;
 }

 .add-parameter {
   width: 100%;
   margin-top: 12px;
 }

 @media (max-width: 1200px) {
   .docs-layout {
     grid-template-columns: 250px 1fr;
   }
 }

 @media (max-width: 768px) {
   .gateway-page {
     padding: 16px;
   }
   
   .overview-cards {
     grid-template-columns: 1fr;
   }
   
   .charts-section {
     grid-template-columns: 1fr;
   }
   
   .docs-layout {
     grid-template-columns: 1fr;
     height: auto;
   }
   
   .docs-sidebar {
     height: 300px;
   }
   
   .form-row {
     grid-template-columns: 1fr;
   }
   
   .route-info,
   .policy-info,
   .breaker-metrics {
     grid-template-columns: 1fr;
   }
   
   .route-metrics {
     flex-direction: column;
     gap: 12px;
   }
 }
 </style> '登录成功',
        example: {
          code: 200,
          data: {
            token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            user: {
              id: 1,
              email: 'user@example.com',
              name: '张三'
            }
          },
          message: '登录成功'
        }
      }
    ]
  },
  {
    id: '2',
    name: '获取用户信息',
    method: 'GET',
    path: '/api/v1/users/:id',
    group: '用户管理',
    summary: '根据用户ID获取用户详细信息',
    description: '通过用户ID获取用户的详细信息，包括基本资料、权限等。',
    deprecated: false,
    version: 'v1.0.0',
    tags: ['用户', '查询'],
    parameters: [
      { name: 'id', type: 'number', in: 'path', description: '用户ID', required: true },
      { name: 'include', type: 'string', in: 'query', description: '包含的关联数据', required: false }
    ],
    responses: [
      {
        code: '200',
        description: '获取成功',
        example: {
          code: 200,
          data: {
            id: 1,
            email: 'user@example.com',
            name: '张三',
            avatar: 'https://example.com/avatar.jpg',
            createdAt: '2023-01-01T00:00:00Z'
          },
          message: '获取成功'
        }
      }
    ]
  }
])

const apiGroups = computed(() => {
  const groups = {}
  apis.value.forEach(api => {
    if (!groups[api.group]) {
      groups[api.group] = {
        id: api.group,
        name: api.group,
        apis: []
      }
    }
    groups[api.group].apis.push(api)
  })
  return Object.values(groups)
})

// 计算属性
const filteredRoutes = computed(() => {
  let filtered = routes.value

  if (routeSearchQuery.value) {
    const query = routeSearchQuery.value.toLowerCase()
    filtered = filtered.filter(route =>
      route.name.toLowerCase().includes(query) ||
      route.path.toLowerCase().includes(query) ||
      route.service.toLowerCase().includes(query)
    )
  }

  if (routeStatusFilter.value) {
    filtered = filtered.filter(route => route.status === routeStatusFilter.value)
  }

  if (routeMethodFilter.value) {
    filtered = filtered.filter(route => route.method === routeMethodFilter.value)
  }

  return filtered
})

const filteredRateLimitPolicies = computed(() => {
  let filtered = rateLimitPolicies.value

  if (rateLimitSearchQuery.value) {
    const query = rateLimitSearchQuery.value.toLowerCase()
    filtered = filtered.filter(policy =>
      policy.name.toLowerCase().includes(query) ||
      policy.type.toLowerCase().includes(query)
    )
  }

  if (rateLimitTypeFilter.value) {
    filtered = filtered.filter(policy => policy.type === rateLimitTypeFilter.value)
  }

  return filtered
})

const filteredCircuitBreakers = computed(() => {
  let filtered = circuitBreakers.value

  if (circuitBreakerSearchQuery.value) {
    const query = circuitBreakerSearchQuery.value.toLowerCase()
    filtered = filtered.filter(breaker =>
      breaker.name.toLowerCase().includes(query) ||
      breaker.service.toLowerCase().includes(query)
    )
  }

  if (circuitBreakerStateFilter.value) {
    filtered = filtered.filter(breaker => breaker.state === circuitBreakerStateFilter.value)
  }

  return filtered
})

const filteredApis = computed(() => {
  let filtered = apis.value

  if (selectedGroup.value) {
    filtered = filtered.filter(api => api.group === selectedGroup.value)
  }

  if (docsSearchQuery.value) {
    const query = docsSearchQuery.value.toLowerCase()
    filtered = filtered.filter(api =>
      api.name.toLowerCase().includes(query) ||
      api.path.toLowerCase().includes(query) ||
      api.summary.toLowerCase().includes(query)
    )
  }

  if (docsTagFilter.value) {
    filtered = filtered.filter(api => 
      api.tags.some(tag => tag.includes(docsTagFilter.value))
    )
  }

  return filtered
})

// 方法
const refreshData = async () => {
  loading.value = true
  try {
    const response = await getRoutes()
    routes.value = response.data || []
    message.success('数据已刷新')
  } catch (error) {
    console.error('获取路由列表失败:', error)
    message.error('获取路由列表失败')
  } finally {
    loading.value = false
  }
}

const syncRoutes = async () => {
  try {
    await new Promise(resolve => setTimeout(resolve, 2000))
    message.success('路由同步成功')
  } catch (error) {
    message.error('路由同步失败')
  }
}

const getMethodType = (method: string) => {
  const types = {
    GET: 'info',
    POST: 'success',
    PUT: 'warning',
    DELETE: 'error',
    PATCH: 'info',
    HEAD: 'default',
    OPTIONS: 'default'
  }
  return types[method] || 'default'
}

const getCircuitBreakerClass = (state: string) => {
  return {
    closed: state === 'CLOSED',
    open: state === 'OPEN',
    'half-open': state === 'HALF_OPEN'
  }
}

const getCircuitBreakerStateType = (state: string) => {
  const types = {
    CLOSED: 'success',
    OPEN: 'error',
    HALF_OPEN: 'warning'
  }
  return types[state] || 'default'
}

const getSuccessRateColor = (rate: number) => {
  if (rate >= 95) return '#52c41a'
  if (rate >= 80) return '#faad14'
  return '#ff4d4f'
}

const formatTime = (date: Date | null) => {
  if (!date) return '从未'
  
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  
  if (hours < 1) return '刚刚'
  if (hours < 24) return `${hours}小时前`
  
  const days = Math.floor(hours / 24)
  return `${days}天前`
}

const exportRoutes = () => {
  message.info('导出路由配置')
}

const importRoutes = () => {
  message.info('导入路由配置')
}

const editRoute = (route: any) => {
  message.info(`编辑路由: ${route.name}`)
}

const testRoute = (route: any) => {
  message.info(`测试路由: ${route.path}`)
}

const deleteRoute = (route: any) => {
  message.info(`删除路由: ${route.name}`)
}

const toggleRateLimit = (policy: any) => {
  message.info(`${policy.enabled ? '启用' : '禁用'}限流策略: ${policy.name}`)
}

const editRateLimit = (policy: any) => {
  message.info(`编辑限流策略: ${policy.name}`)
}

const viewRateLimitStats = (policy: any) => {
  message.info(`查看限流统计: ${policy.name}`)
}

const testRateLimit = (policy: any) => {
  message.info(`测试限流策略: ${policy.name}`)
}

const resetAllCircuitBreakers = () => {
  message.info('重置所有熔断器')
}

const resetCircuitBreaker = (breaker: any) => {
  message.info(`重置熔断器: ${breaker.name}`)
}

const editCircuitBreaker = (breaker: any) => {
  message.info(`编辑熔断器: ${breaker.name}`)
}

const viewCircuitBreakerLogs = (breaker: any) => {
  message.info(`查看熔断器日志: ${breaker.name}`)
}

const selectGroup = (groupId: string) => {
  selectedGroup.value = groupId
  selectedApi.value = null
  selectedApiDetails.value = null
}

const selectApi = (api: any) => {
  selectedApi.value = api.id
  selectedApiDetails.value = api
}

const generateDocs = () => {
  message.info('生成API文档')
}

const exportDocs = () => {
  message.info('导出API文档')
}

const testApi = (api: any) => {
  message.info(`测试API: ${api.name}`)
}

const copyApiUrl = (api: any) => {
  message.info(`复制API地址: ${api.path}`)
}

const createRoute = () => {
  if (!routeForm.value.name || !routeForm.value.path) {
    message.error('请填写必填字段')
    return
  }

  const newRoute = {
    id: Date.now().toString(),
    name: routeForm.value.name,
    method: routeForm.value.method,
    path: routeForm.value.path,
    service: routeForm.value.service,
    upstream: routeForm.value.upstream,
    status: routeForm.value.enabled ? 'active' : 'inactive',
    requests: 0,
    avgLatency: 0,
    errorRate: 0
  }

  routes.value.push(newRoute)
  message.success(`路由 ${routeForm.value.name} 创建成功`)
  showRouteModal.value = false

  // 重置表单
  routeForm.value = {
    name: '',
    method: 'GET',
    path: '',
    service: '',
    upstream: '',
    loadBalancer: 'round_robin',
    timeout: 5000,
    retries: 3,
    auth: 'none',
    cors: true,
    enabled: true,
    logging: true
  }
}

const createRateLimit = () => {
  if (!rateLimitForm.value.name || !rateLimitForm.value.limit) {
    message.error('请填写必填字段')
    return
  }

  const newPolicy = {
    id: Date.now().toString(),
    name: rateLimitForm.value.name,
    type: rateLimitForm.value.type,
    limit: rateLimitForm.value.limit,
    window: rateLimitForm.value.window,
    scope: rateLimitForm.value.scope,
    enabled: rateLimitForm.value.enabled,
    currentUsage: 0,
    triggerCount: 0,
    lastTriggered: null
  }

  rateLimitPolicies.value.push(newPolicy)
  message.success(`限流策略 ${rateLimitForm.value.name} 创建成功`)
  showRateLimitModal.value = false

  // 重置表单
  rateLimitForm.value = {
    name: '',
    type: 'IP限流',
    description: '',
    limit: 100,
    window: '1分钟',
    scope: '全局',
    key: 'ip',
    statusCode: 429,
    message: '请求过于频繁，请稍后再试',
    enabled: true,
    alert: true
  }
}

const createCircuitBreaker = () => {
  if (!circuitBreakerForm.value.name || !circuitBreakerForm.value.service) {
    message.error('请填写必填字段')
    return
  }

  const newBreaker = {
    id: Date.now().toString(),
    name: circuitBreakerForm.value.name,
    service: circuitBreakerForm.value.service,
    state: 'CLOSED',
    successRate: 100,
    avgResponseTime: 0,
    requestCount: 0,
    failureThreshold: circuitBreakerForm.value.failureThreshold,
    timeout: circuitBreakerForm.value.timeout,
    recoveryTime: circuitBreakerForm.value.recoveryTime
  }

  circuitBreakers.value.push(newBreaker)
  message.success(`熔断器 ${circuitBreakerForm.value.name} 创建成功`)
  showCircuitBreakerModal.value = false

  // 重置表单
  circuitBreakerForm.value = {
    name: '',
    service: '',
    description: '',
    failureThreshold: 50,
    minRequests: 10,
    timeout: 5000,
    recoveryTime: 30,
    statisticsWindow: 60,
    halfOpenRequests: 5,
    enabled: true,
    alert: true
  }
}

const createParameter = () => {
  return { name: '', type: 'string', in: 'query', description: '', required: false }
}

const createApi = () => {
  if (!apiForm.value.name || !apiForm.value.path) {
    message.error('请填写必填字段')
    return
  }

  const newApi = {
    id: Date.now().toString(),
    name: apiForm.value.name,
    method: apiForm.value.method,
    path: apiForm.value.path,
    group: apiForm.value.group,
    summary: apiForm.value.description.substring(0, 50),
    description: