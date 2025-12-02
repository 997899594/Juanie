#!/usr/bin/env bun

/**
 * 诊断 Flux Kustomization Reconciling 问题
 *
 * 检查：
 * 1. Kustomization 状态
 * 2. source-controller 日志
 * 3. kustomize-controller 日志
 * 4. NetworkPolicy 配置
 * 5. 内部连接测试
 */

import { $ } from 'bun'

console.log('🔍 诊断 Flux Kustomization Reconciling 问题\n')

// 1. 检查 Kustomization 状态
console.log('📋 1. 检查 Kustomization 状态')
console.log('='.repeat(60))
try {
  await $`kubectl get kustomization -A`.quiet()
  console.log()

  // 获取详细状态
  const kustomizations = await $`kubectl get kustomization -A -o json`.json()

  for (const item of kustomizations.items || []) {
    const name = item.metadata.name
    const namespace = item.metadata.namespace
    const ready = item.status?.conditions?.find((c: any) => c.type === 'Ready')

    if (ready?.status !== 'True') {
      console.log(`\n⚠️  ${namespace}/${name} 不是 Ready 状态:`)
      console.log(`   状态: ${ready?.status || 'Unknown'}`)
      console.log(`   原因: ${ready?.reason || 'N/A'}`)
      console.log(`   消息: ${ready?.message || 'N/A'}`)
    }
  }
} catch (error) {
  console.error('❌ 无法获取 Kustomization 状态:', error)
}

console.log('\n')

// 2. 检查 source-controller 日志
console.log('📋 2. 检查 source-controller 日志（最近 20 行）')
console.log('='.repeat(60))
try {
  await $`kubectl logs -n flux-system deployment/source-controller --tail=20`.quiet()
  console.log()
} catch (error) {
  console.error('❌ 无法获取 source-controller 日志:', error)
}

console.log()

// 3. 检查 kustomize-controller 日志
console.log('📋 3. 检查 kustomize-controller 日志（最近 20 行）')
console.log('='.repeat(60))
try {
  await $`kubectl logs -n flux-system deployment/kustomize-controller --tail=20`.quiet()
  console.log()
} catch (error) {
  console.error('❌ 无法获取 kustomize-controller 日志:', error)
}

console.log()

// 4. 检查 NetworkPolicy
console.log('📋 4. 检查 NetworkPolicy 配置')
console.log('='.repeat(60))
try {
  const policies = await $`kubectl get networkpolicy -n flux-system -o json`.json()

  if (policies.items.length === 0) {
    console.log('✅ flux-system 命名空间没有 NetworkPolicy')
  } else {
    console.log(`找到 ${policies.items.length} 个 NetworkPolicy:\n`)

    for (const policy of policies.items) {
      console.log(`📄 ${policy.metadata.name}:`)

      // 检查 egress 规则
      if (policy.spec.egress) {
        console.log('   Egress 规则:')
        let has9090 = false

        for (const rule of policy.spec.egress) {
          if (rule.ports) {
            for (const port of rule.ports) {
              console.log(`     - 端口 ${port.port}/${port.protocol}`)
              if (port.port === 9090) {
                has9090 = true
              }
            }
          }
        }

        if (!has9090) {
          console.log('   ⚠️  缺少 9090 端口（source-controller artifact 服务）')
        } else {
          console.log('   ✅ 包含 9090 端口')
        }
      }

      console.log()
    }
  }
} catch (error) {
  console.error('❌ 无法获取 NetworkPolicy:', error)
}

console.log()

// 5. 测试内部连接
console.log('📋 5. 测试 Flux 内部连接')
console.log('='.repeat(60))
try {
  console.log('测试从 kustomize-controller 连接到 source-controller:9090...')

  const result =
    await $`kubectl exec -n flux-system deployment/kustomize-controller -- wget -q -O- --timeout=5 http://source-controller.flux-system.svc.cluster.local:9090/`.nothrow()

  if (result.exitCode === 0) {
    console.log('✅ 连接成功')
  } else {
    console.log('❌ 连接失败')
    console.log('   这通常意味着 NetworkPolicy 阻止了 9090 端口')
  }
} catch (error) {
  console.log('❌ 连接测试失败:', error)
}

console.log('\n')

// 总结和建议
console.log('📋 诊断总结和建议')
console.log('='.repeat(60))
console.log(`
如果看到以下问题：
1. Kustomization 状态为 "Reconciling" 或 "Unknown"
2. source-controller 日志中有 "connection refused" 错误
3. NetworkPolicy 缺少 9090 端口
4. 内部连接测试失败

解决方案：
1. 更新 NetworkPolicy 添加 9090 端口
2. 或者允许 flux-system 内部所有通信
3. 或者临时删除 NetworkPolicy 测试

详细文档：docs/troubleshooting/flux/kustomization-reconciling.md

修复命令：
  bun run scripts/fix-flux-network-policy.ts
`)
