#!/usr/bin/env bun

/**
 * 修复 Flux NetworkPolicy 问题
 *
 * 添加 9090 端口到 egress 规则，允许 Flux 内部通信
 */

import { $ } from 'bun'

console.log('🔧 修复 Flux NetworkPolicy\n')

const networkPolicy = `
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: flux-system-network-policy
  namespace: flux-system
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
  
  ingress:
  # 允许来自 flux-system 命名空间的入站流量
  - from:
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: flux-system
  
  # 允许来自其他命名空间的 webhook 请求
  - from:
    - namespaceSelector: {}
    ports:
    - protocol: TCP
      port: 9090
  
  egress:
  # 1. 允许 flux-system 内部通信（包括 9090 端口）
  - to:
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: flux-system
  
  # 2. 允许访问 Kubernetes API
  - to:
    - namespaceSelector: {}
    ports:
    - protocol: TCP
      port: 443
    - protocol: TCP
      port: 6443
  
  # 3. 允许 DNS 查询
  - to:
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: kube-system
      podSelector:
        matchLabels:
          k8s-app: kube-dns
    ports:
    - protocol: UDP
      port: 53
    - protocol: TCP
      port: 53
  
  # 4. 允许外部 Git 访问
  - ports:
    - protocol: TCP
      port: 443   # HTTPS (GitHub, GitLab, Helm repos)
    - protocol: TCP
      port: 22    # SSH (Git over SSH)
`

console.log('📄 应用 NetworkPolicy...')
console.log('='.repeat(60))

try {
  // 应用 NetworkPolicy
  await $`kubectl apply -f -`.stdin(networkPolicy).quiet()

  console.log('✅ NetworkPolicy 已应用\n')

  // 等待几秒让策略生效
  console.log('⏳ 等待 5 秒让策略生效...')
  await new Promise((resolve) => setTimeout(resolve, 5000))

  // 强制重新同步所有 Kustomization
  console.log('\n🔄 强制重新同步 Kustomization...')
  const kustomizations = await $`kubectl get kustomization -A -o json`.json()

  for (const item of kustomizations.items || []) {
    const name = item.metadata.name
    const namespace = item.metadata.namespace

    console.log(`   同步 ${namespace}/${name}...`)
    await $`kubectl annotate kustomization ${name} -n ${namespace} reconcile.fluxcd.io/requestedAt="$(date +%s)" --overwrite`
      .nothrow()
      .quiet()
  }

  console.log('\n✅ 所有 Kustomization 已触发重新同步')
  console.log('\n等待 10-30 秒后检查状态:')
  console.log('  kubectl get kustomization -A')
  console.log('\n或运行诊断脚本:')
  console.log('  bun run scripts/diagnose-flux-reconciling.ts')
} catch (error) {
  console.error('❌ 应用 NetworkPolicy 失败:', error)
  process.exit(1)
}
