#!/usr/bin/env bun
/**
 * 测试 BunK8sClient 基本功能
 */
import { BunK8sClient } from '../packages/services/business/src/gitops/k3s/bun-k8s-client'

async function main() {
  console.log('🧪 测试 BunK8sClient\n')

  // 获取 kubeconfig 路径
  const kubeconfigPath = process.env.K3S_KUBECONFIG_PATH || process.env.KUBECONFIG_PATH
  if (!kubeconfigPath) {
    console.error('❌ 请设置 K3S_KUBECONFIG_PATH 或 KUBECONFIG_PATH 环境变量')
    process.exit(1)
  }

  console.log(`📁 Kubeconfig: ${kubeconfigPath}`)

  try {
    // 创建客户端
    const client = new BunK8sClient(kubeconfigPath)
    console.log('✅ BunK8sClient 创建成功\n')

    // 测试健康检查
    console.log('🏥 测试健康检查...')
    const healthy = await client.healthCheck()
    console.log(healthy ? '✅ K3s 集群健康' : '❌ K3s 集群不健康')
    console.log()

    // 测试列出 Namespaces
    console.log('📦 测试列出 Namespaces...')
    const namespaces = await client.listNamespaces()
    console.log(`✅ 找到 ${namespaces.length} 个 Namespace:`)
    namespaces.slice(0, 5).forEach((ns: any) => {
      console.log(`   - ${ns.metadata.name}`)
    })
    if (namespaces.length > 5) {
      console.log(`   ... 还有 ${namespaces.length - 5} 个`)
    }
    console.log()

    // 测试列出 Deployments
    console.log('🚀 测试列出 Deployments (kube-system)...')
    const deployments = await client.listDeployments('kube-system')
    console.log(`✅ 找到 ${deployments.length} 个 Deployment:`)
    deployments.forEach((dep: any) => {
      const ready = dep.status?.readyReplicas || 0
      const desired = dep.spec?.replicas || 0
      console.log(`   - ${dep.metadata.name}: ${ready}/${desired}`)
    })
    console.log()

    // 测试列出 Pods
    console.log('🐳 测试列出 Pods (kube-system)...')
    const pods = await client.listPods('kube-system')
    console.log(`✅ 找到 ${pods.length} 个 Pod:`)
    pods.slice(0, 5).forEach((pod: any) => {
      const phase = pod.status?.phase || 'Unknown'
      console.log(`   - ${pod.metadata.name}: ${phase}`)
    })
    if (pods.length > 5) {
      console.log(`   ... 还有 ${pods.length - 5} 个`)
    }
    console.log()

    // 测试 Flux 资源（如果安装了）
    console.log('🔄 测试 Flux GitRepository 资源...')
    try {
      const gitRepos = await client.listCustomResources(
        'source.toolkit.fluxcd.io',
        'v1',
        'gitrepositories',
        'flux-system',
      )
      console.log(`✅ 找到 ${gitRepos.length} 个 GitRepository`)
      gitRepos.forEach((repo: any) => {
        const ready = repo.status?.conditions?.find((c: any) => c.type === 'Ready')
        const status = ready?.status === 'True' ? '✅' : '❌'
        console.log(`   ${status} ${repo.metadata.name}`)
      })
    } catch (error: any) {
      if (error.message.includes('404')) {
        console.log('ℹ️  Flux 未安装或 GitRepository CRD 不存在')
      } else {
        throw error
      }
    }
    console.log()

    console.log('✅ 所有测试通过！')
  } catch (error: any) {
    console.error('❌ 测试失败:', error.message)
    if (error.stack) {
      console.error(error.stack)
    }
    process.exit(1)
  }
}

main()
