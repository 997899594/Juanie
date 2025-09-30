<template>
  <div class="min-h-screen bg-white">
    <!-- 页面头部 -->
    <div class="bg-white border-b border-gray-200 px-6 py-4">
      <div class="max-w-6xl mx-auto">
        <h1 class="text-2xl font-medium text-gray-900 mb-2">DevOps 平台组件库</h1>
        <p class="text-gray-600">基于B站设计风格的DevOps平台组件展示 - Naive UI + UnoCSS</p>
        
        <!-- 导航标签 -->
        <div class="flex gap-2 mt-4">
          <n-tag type="primary" size="small">DevOps</n-tag>
          <n-tag type="info" size="small">Naive UI</n-tag>
          <n-tag type="success" size="small">B站设计</n-tag>
          <n-tag size="small">UnoCSS</n-tag>
        </div>
      </div>
    </div>

    <div class="max-w-6xl mx-auto px-6 py-8">
      <!-- 项目管理组件 -->
      <section class="mb-12">
        <h2 class="text-xl font-medium text-gray-900 mb-6">项目管理组件</h2>
        
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <!-- 项目卡片 -->
          <n-card title="前端项目" class="hover:shadow-xl hover:-translate-y-1 transition-all duration-normal cursor-pointer group border-0 shadow-md">
            <template #header-extra>
              <n-tag size="small" type="success">运行中</n-tag>
            </template>
            <div class="space-y-3">
              <div class="flex justify-between text-sm">
                <span class="text-gray-600">环境:</span>
                <span class="font-medium">Production</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-gray-600">版本:</span>
                <span class="font-medium">v2.1.3</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-gray-600">负责人:</span>
                <span class="font-medium">张三</span>
              </div>
            </div>
            <template #footer>
              <div class="flex gap-2">
                <n-button size="small" type="primary" class="group-hover:scale-105 transition-transform">部署</n-button>
                <n-button size="small" class="group-hover:scale-105 transition-transform">查看日志</n-button>
              </div>
            </template>
          </n-card>

          <!-- API服务卡片 -->
          <n-card title="API服务" class="hover:shadow-xl hover:-translate-y-1 transition-all duration-normal cursor-pointer group border-0 shadow-md">
            <template #header-extra>
              <n-tag size="small" type="warning">更新中</n-tag>
            </template>
            <div class="space-y-3">
              <div class="flex justify-between text-sm">
                <span class="text-gray-600">环境:</span>
                <span class="font-medium">Staging</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-gray-600">版本:</span>
                <span class="font-medium">v1.8.2</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-gray-600">负责人:</span>
                <span class="font-medium">李四</span>
              </div>
            </div>
            <template #footer>
              <div class="flex gap-2">
                <n-button size="small" disabled>部署中...</n-button>
                <n-button size="small" class="group-hover:scale-105 transition-transform">查看进度</n-button>
              </div>
            </template>
          </n-card>

          <!-- 数据库服务卡片 -->
          <n-card title="数据库服务" class="hover:shadow-xl hover:-translate-y-1 transition-all duration-normal cursor-pointer group border-0 shadow-md">
            <template #header-extra>
              <n-tag size="small" type="error">异常</n-tag>
            </template>
            <div class="space-y-3">
              <div class="flex justify-between text-sm">
                <span class="text-gray-600">环境:</span>
                <span class="font-medium">Production</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-gray-600">版本:</span>
                <span class="font-medium">MySQL 8.0</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-gray-600">负责人:</span>
                <span class="font-medium">王五</span>
              </div>
            </div>
            <template #footer>
              <div class="flex gap-2">
                <n-button size="small" type="error" class="group-hover:scale-105 transition-transform">修复</n-button>
                <n-button size="small" class="group-hover:scale-105 transition-transform">查看告警</n-button>
              </div>
            </template>
          </n-card>
        </div>

        <!-- 项目状态统计 -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <!-- 运行中项目 -->
          <div class="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-lg p-5 hover:shadow-lg hover:scale-105 transition-all duration-normal cursor-pointer group">
            <div class="flex items-center justify-between mb-3">
              <div class="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center group-hover:bg-green-200 transition-colors">
                <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
              <div class="flex items-center text-green-600 text-sm font-medium">
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 17l9.2-9.2M17 17V7H7"></path>
                </svg>
                +8.5%
              </div>
            </div>
            <div class="text-3xl font-bold text-green-700 mb-1">12</div>
            <div class="text-sm text-green-600 font-medium">运行中项目</div>
            <div class="text-xs text-green-500 mt-1">较上月增长</div>
          </div>

          <!-- 部署中项目 -->
          <div class="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-lg p-5 hover:shadow-lg hover:scale-105 transition-all duration-normal cursor-pointer group">
            <div class="flex items-center justify-between mb-3">
              <div class="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center group-hover:bg-orange-200 transition-colors">
                <svg class="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                </svg>
              </div>
              <div class="flex items-center text-orange-600 text-sm font-medium">
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 17l9.2-9.2M17 17V7H7"></path>
                </svg>
                +2.1%
              </div>
            </div>
            <div class="text-3xl font-bold text-orange-700 mb-1">3</div>
            <div class="text-sm text-orange-600 font-medium">部署中项目</div>
            <div class="text-xs text-orange-500 mt-1">活跃部署</div>
          </div>

          <!-- 异常项目 -->
          <div class="bg-gradient-to-br from-red-50 to-rose-50 border border-red-200 rounded-lg p-5 hover:shadow-lg hover:scale-105 transition-all duration-normal cursor-pointer group">
            <div class="flex items-center justify-between mb-3">
              <div class="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center group-hover:bg-red-200 transition-colors">
                <svg class="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                </svg>
              </div>
              <div class="flex items-center text-red-600 text-sm font-medium">
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 13l-5 5m0 0l-5-5m5 5V6"></path>
                </svg>
                -12.3%
              </div>
            </div>
            <div class="text-3xl font-bold text-red-700 mb-1">1</div>
            <div class="text-sm text-red-600 font-medium">异常项目</div>
            <div class="text-xs text-red-500 mt-1">需要关注</div>
          </div>

          <!-- 总项目数 -->
          <div class="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-5 hover:shadow-lg hover:scale-105 transition-all duration-normal cursor-pointer group">
            <div class="flex items-center justify-between mb-3">
              <div class="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                </svg>
              </div>
              <div class="flex items-center text-blue-600 text-sm font-medium">
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 17l9.2-9.2M17 17V7H7"></path>
                </svg>
                +6.2%
              </div>
            </div>
            <div class="text-3xl font-bold text-blue-700 mb-1">16</div>
            <div class="text-sm text-blue-600 font-medium">总项目数</div>
            <div class="text-xs text-blue-500 mt-1">持续增长</div>
          </div>
        </div>
      </section>

      <!-- 部署流水线组件 -->
      <section class="mb-12">
        <h2 class="text-xl font-medium text-gray-900 mb-6">部署流水线</h2>
        
        <!-- 流水线步骤 -->
        <n-card class="mb-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-normal border-0 shadow-md">
          <template #header>
            <div class="flex justify-between items-center">
              <span>前端项目部署 #1234</span>
              <n-tag type="success" size="small">成功</n-tag>
            </div>
          </template>
          
          <div class="space-y-4">
            <!-- 流水线步骤 -->
            <div class="flex items-center space-x-4">
              <div class="flex items-center space-x-2">
                <div class="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                  <span class="text-white text-xs">✓</span>
                </div>
                <span class="font-medium">代码检出</span>
              </div>
              <div class="flex-1 h-px bg-gray-200"></div>
              <span class="text-sm text-gray-500">2分钟</span>
            </div>
            
            <div class="flex items-center space-x-4">
              <div class="flex items-center space-x-2">
                <div class="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                  <span class="text-white text-xs">✓</span>
                </div>
                <span class="font-medium">依赖安装</span>
              </div>
              <div class="flex-1 h-px bg-gray-200"></div>
              <span class="text-sm text-gray-500">5分钟</span>
            </div>
            
            <div class="flex items-center space-x-4">
              <div class="flex items-center space-x-2">
                <div class="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                  <span class="text-white text-xs">✓</span>
                </div>
                <span class="font-medium">构建打包</span>
              </div>
              <div class="flex-1 h-px bg-gray-200"></div>
              <span class="text-sm text-gray-500">8分钟</span>
            </div>
            
            <div class="flex items-center space-x-4">
              <div class="flex items-center space-x-2">
                <div class="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                  <span class="text-white text-xs">✓</span>
                </div>
                <span class="font-medium">部署发布</span>
              </div>
              <div class="flex-1 h-px bg-gray-200"></div>
              <span class="text-sm text-gray-500">3分钟</span>
            </div>
          </div>
          
          <template #footer>
            <div class="flex justify-between items-center">
              <span class="text-sm text-gray-500">总耗时: 18分钟</span>
              <div class="flex gap-2">
                <n-button size="small">查看日志</n-button>
                <n-button size="small" type="primary">重新部署</n-button>
              </div>
            </div>
          </template>
        </n-card>

        <!-- 部署状态卡片 -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="bg-green-50 border border-green-200 rounded-md p-4">
            <div class="flex items-center justify-between mb-2">
              <span class="font-medium text-green-800">部署成功</span>
              <div class="w-3 h-3 bg-green-500 rounded-full"></div>
            </div>
            <div class="text-sm text-green-600">最近一次部署成功完成</div>
            <div class="text-xs text-green-500 mt-1">2024-01-15 14:30</div>
          </div>
          
          <div class="bg-orange-50 border border-orange-200 rounded-md p-4">
            <div class="flex items-center justify-between mb-2">
              <span class="font-medium text-orange-800">部署中</span>
              <div class="w-3 h-3 bg-orange-500 rounded-full animate-pulse"></div>
            </div>
            <div class="text-sm text-orange-600">正在执行部署流程</div>
            <div class="text-xs text-orange-500 mt-1">预计剩余 5分钟</div>
          </div>
          
          <div class="bg-red-50 border border-red-200 rounded-md p-4">
            <div class="flex items-center justify-between mb-2">
              <span class="font-medium text-red-800">部署失败</span>
              <div class="w-3 h-3 bg-red-500 rounded-full"></div>
            </div>
            <div class="text-sm text-red-600">构建过程中出现错误</div>
            <div class="text-xs text-red-500 mt-1">2024-01-15 12:15</div>
          </div>
        </div>
      </section>

      <!-- 监控告警组件 -->
      <section class="mb-12">
        <h2 class="text-xl font-medium text-gray-900 mb-6">监控告警</h2>
        
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <!-- 系统指标卡片 -->
          <n-card class="text-center hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer border-0 shadow-md">
            <div class="text-3xl font-bold text-blue-600 mb-2">85%</div>
            <div class="text-sm text-gray-600 mb-1">CPU使用率</div>
            <n-tag size="tiny" type="warning">偏高</n-tag>
          </n-card>
          
          <n-card class="text-center hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer border-0 shadow-md">
            <div class="text-3xl font-bold text-green-600 mb-2">62%</div>
            <div class="text-sm text-gray-600 mb-1">内存使用率</div>
            <n-tag size="tiny" type="success">正常</n-tag>
          </n-card>
          
          <n-card class="text-center hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer border-0 shadow-md">
            <div class="text-3xl font-bold text-purple-600 mb-2">1.2GB</div>
            <div class="text-sm text-gray-600 mb-1">磁盘使用</div>
            <n-tag size="tiny" type="info">正常</n-tag>
          </n-card>
          
          <n-card class="text-center hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer border-0 shadow-md">
            <div class="text-3xl font-bold text-red-600 mb-2">3</div>
            <div class="text-sm text-gray-600 mb-1">活跃告警</div>
            <n-tag size="tiny" type="error">需处理</n-tag>
          </n-card>
        </div>

        <!-- 告警列表 -->
        <n-card title="最新告警" class="hover:shadow-lg hover:-translate-y-1 transition-all duration-300 border-0 shadow-md">
          <div class="space-y-3">
            <div class="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded">
              <div class="flex items-center space-x-3">
                <div class="w-2 h-2 bg-red-500 rounded-full"></div>
                <div>
                  <div class="font-medium text-red-800">数据库连接超时</div>
                  <div class="text-sm text-red-600">production-db-01 连接响应时间超过5秒</div>
                </div>
              </div>
              <div class="text-xs text-red-500">5分钟前</div>
            </div>
            
            <div class="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded">
              <div class="flex items-center space-x-3">
                <div class="w-2 h-2 bg-orange-500 rounded-full"></div>
                <div>
                  <div class="font-medium text-orange-800">CPU使用率过高</div>
                  <div class="text-sm text-orange-600">web-server-02 CPU使用率持续超过80%</div>
                </div>
              </div>
              <div class="text-xs text-orange-500">15分钟前</div>
            </div>
            
            <div class="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded">
              <div class="flex items-center space-x-3">
                <div class="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <div>
                  <div class="font-medium text-yellow-800">磁盘空间不足</div>
                  <div class="text-sm text-yellow-600">log-server 磁盘使用率达到85%</div>
                </div>
              </div>
              <div class="text-xs text-yellow-500">1小时前</div>
            </div>
          </div>
        </n-card>
      </section>

      <!-- 用户权限组件 -->
      <section class="mb-12">
        <h2 class="text-xl font-medium text-gray-900 mb-6">用户权限管理</h2>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- 用户列表 -->
          <n-card title="团队成员" class="hover:shadow-lg hover:-translate-y-1 transition-all duration-300 border-0 shadow-md">
            <div class="space-y-4">
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-3">
                  <div class="w-8 h-8 bg-bilibili-pink rounded-full flex items-center justify-center">
                    <span class="text-white text-sm">张</span>
                  </div>
                  <div>
                    <div class="font-medium">张三</div>
                    <div class="text-sm text-gray-500">zhang@company.com</div>
                  </div>
                </div>
                <div class="flex items-center space-x-2">
                  <n-tag size="small" type="primary">管理员</n-tag>
                  <n-switch size="small" :default-value="true" />
                </div>
              </div>
              
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-3">
                  <div class="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                    <span class="text-white text-sm">李</span>
                  </div>
                  <div>
                    <div class="font-medium">李四</div>
                    <div class="text-sm text-gray-500">li@company.com</div>
                  </div>
                </div>
                <div class="flex items-center space-x-2">
                  <n-tag size="small" type="info">开发者</n-tag>
                  <n-switch size="small" :default-value="true" />
                </div>
              </div>
              
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-3">
                  <div class="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                    <span class="text-white text-sm">王</span>
                  </div>
                  <div>
                    <div class="font-medium">王五</div>
                    <div class="text-sm text-gray-500">wang@company.com</div>
                  </div>
                </div>
                <div class="flex items-center space-x-2">
                  <n-tag size="small" type="success">运维</n-tag>
                  <n-switch size="small" :default-value="false" />
                </div>
              </div>
            </div>
          </n-card>

          <!-- 权限配置 -->
          <n-card title="权限配置" class="hover:shadow-lg hover:-translate-y-1 transition-all duration-300 border-0 shadow-md">
            <div class="space-y-4">
              <div class="flex items-center justify-between">
                <div>
                  <div class="font-medium">项目部署</div>
                  <div class="text-sm text-gray-500">允许执行项目部署操作</div>
                </div>
                <n-switch :default-value="true" />
              </div>
              
              <div class="flex items-center justify-between">
                <div>
                  <div class="font-medium">日志查看</div>
                  <div class="text-sm text-gray-500">允许查看系统日志</div>
                </div>
                <n-switch :default-value="true" />
              </div>
              
              <div class="flex items-center justify-between">
                <div>
                  <div class="font-medium">用户管理</div>
                  <div class="text-sm text-gray-500">允许管理团队成员</div>
                </div>
                <n-switch :default-value="false" />
              </div>
              
              <div class="flex items-center justify-between">
                <div>
                  <div class="font-medium">系统配置</div>
                  <div class="text-sm text-gray-500">允许修改系统配置</div>
                </div>
                <n-switch :default-value="false" />
              </div>
            </div>
          </n-card>
        </div>
      </section>

      <!-- 代码仓库组件 -->
      <section class="mb-12">
        <h2 class="text-xl font-medium text-gray-900 mb-6">代码仓库</h2>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <n-card class="hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group border-0 shadow-md">
            <template #header>
              <div class="flex items-center justify-between">
                <span class="font-medium">frontend-app</span>
                <n-tag size="small" type="success">活跃</n-tag>
              </div>
            </template>
            
            <div class="space-y-3">
              <div class="flex justify-between text-sm">
                <span class="text-gray-600">语言:</span>
                <span class="font-medium">TypeScript</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-gray-600">分支:</span>
                <span class="font-medium">main</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-gray-600">最后提交:</span>
                <span class="font-medium">2小时前</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-gray-600">提交者:</span>
                <span class="font-medium">张三</span>
              </div>
            </div>
            
            <template #footer>
              <div class="flex gap-2">
                <n-button size="small" type="primary" class="group-hover:scale-105 transition-transform">查看代码</n-button>
                <n-button size="small" class="group-hover:scale-105 transition-transform">提交历史</n-button>
              </div>
            </template>
          </n-card>

          <n-card class="hover:shadow-xl hover:-translate-y-1 transition-all duration-normal cursor-pointer group border-0 shadow-md">
            <template #header>
              <div class="flex items-center justify-between">
                <span class="font-medium">backend-api</span>
                <n-tag size="small" type="warning">待合并</n-tag>
              </div>
            </template>
            
            <div class="space-y-3">
              <div class="flex justify-between text-sm">
                <span class="text-gray-600">语言:</span>
                <span class="font-medium">Node.js</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-gray-600">分支:</span>
                <span class="font-medium">feature/auth</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-gray-600">最后提交:</span>
                <span class="font-medium">1天前</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-gray-600">提交者:</span>
                <span class="font-medium">李四</span>
              </div>
            </div>
            
            <template #footer>
              <div class="flex gap-2">
                <n-button size="small" type="primary" class="group-hover:scale-105 transition-transform">合并请求</n-button>
                <n-button size="small" class="group-hover:scale-105 transition-transform">查看差异</n-button>
              </div>
            </template>
          </n-card>
        </div>
      </section>

      <!-- 基础组件展示 -->
      <section class="mb-12">
        <h2 class="text-xl font-medium text-gray-900 mb-6">基础组件</h2>
        
        <!-- 按钮组件 -->
        <div class="mb-8">
          <h3 class="text-lg font-medium text-gray-900 mb-4">操作按钮</h3>
          <div class="flex flex-wrap gap-4">
            <n-button type="primary">部署项目</n-button>
            <n-button type="info">查看日志</n-button>
            <n-button type="success">启动服务</n-button>
            <n-button type="warning">重启服务</n-button>
            <n-button type="error">停止服务</n-button>
            <n-button secondary>取消操作</n-button>
            <n-button text type="primary">查看详情</n-button>
          </div>
        </div>

        <!-- 输入组件 -->
        <div class="mb-8">
          <h3 class="text-lg font-medium text-gray-900 mb-4">表单输入</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <n-input 
              placeholder="项目名称" 
              size="medium"
              class="h-10"
            />
            <n-input 
              placeholder="搜索项目"
              size="medium"
              class="h-10"
            >
              <template #prefix>
                <n-icon><Search /></n-icon>
              </template>
            </n-input>
            <n-select 
              placeholder="选择环境" 
              size="medium"
              class="h-10"
              :options="[
                { label: 'Development', value: 'dev' },
                { label: 'Staging', value: 'staging' },
                { label: 'Production', value: 'prod' }
              ]" 
            />
            <n-date-picker 
              placeholder="选择日期" 
              size="medium"
              class="w-full h-10"
            />
          </div>
        </div>

        <!-- 状态标签 -->
        <div>
          <h3 class="text-lg font-medium text-gray-900 mb-4">状态标签</h3>
          <div class="flex flex-wrap gap-2">
            <n-tag type="success">运行中</n-tag>
            <n-tag type="warning">部署中</n-tag>
            <n-tag type="error">异常</n-tag>
            <n-tag type="info">待部署</n-tag>
            <n-tag>已停止</n-tag>
            <n-tag type="primary">生产环境</n-tag>
            <n-tag type="success" size="small">v2.1.0</n-tag>
            <n-tag closable>可关闭标签</n-tag>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Search } from '@vicons/ionicons5'

// DevOps平台组件展示页面
// 基于B站设计风格，展示DevOps相关的业务组件
</script>
