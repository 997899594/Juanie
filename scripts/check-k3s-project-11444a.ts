#!/usr/bin/env bun
import { K3sService } from '@juanie/service-business'

async function checkK3sProject() {
  const k3sService = new K3sService()
  const projectId = 'a5ca948d-2db3-437e-8504-bc7cc956013e'
  const namespace = `project-${projectId}`

  console.log('=== K3s 集群状态检查 ===')
  console.log(`项目 ID: ${projectId}`)
  console.log(`命名空间: ${namespace}\n`)

  try {
    // 检查命名空间
    console.log('📦 检查命名空间...')
    const namespaces = await k3sService.listNamespaces()
    const nsExists = namespaces.items.some((ns: any) => ns.metadata.name === namespace)
    console.log(`命名空间存在: ${nsExists ? '✅' : '❌'}`)

    if (!nsExists) {
      console.log('\n❌ 命名空间不存在，项目未部署到 K3s')
      return
    }

    // 检查 Deployments
    console.log('\n🚀 检查 Deployments...')
    const deployments = await k3sService.listDeployments(namespace)
    if (deployments.items.length === 0) {
      console.log('❌ 未找到 Deployment')
    } else {
      for (const deploy of deployments.items) {
        console.log(`\n部署: ${deploy.metadata.name}`)
        console.log(`  副本: ${deploy.status.readyReplicas || 0}/${deploy.spec.replicas}`)
        console.log(`  可用: ${deploy.status.availableReplicas || 0}`)
        console.log(`  镜像: ${deploy.spec.template.spec.containers[0].image}`)
        console.log(`  状态: ${deploy.status.conditions?.[0]?.type || 'Unknown'}`)
      }
    }

    // 检查 Pods
    console.log('\n🐳 检查 Pods...')
    const pods = await k3sService.listPods(namespace)
    if (pods.items.length === 0) {
      console.log('❌ 未找到 Pod')
    } else {
      for (const pod of pods.items) {
        console.log(`\nPod: ${pod.metadata.name}`)
        console.log(`  状态: ${pod.status.phase}`)
        console.log(`  IP: ${pod.status.podIP || 'N/A'}`)
        console.log(`  节点: ${pod.spec.nodeName || 'N/A'}`)

        // 容器状态
        if (pod.status.containerStatuses) {
          for (const container of pod.status.containerStatuses) {
            console.log(`  容器 ${container.name}:`)
            console.log(`    就绪: ${container.ready ? '✅' : '❌'}`)
            console.log(`    重启次数: ${container.restartCount}`)
            if (container.state.waiting) {
              console.log(`    等待原因: ${container.state.waiting.reason}`)
              console.log(`    等待消息: ${container.state.waiting.message || 'N/A'}`)
            }
            if (container.state.terminated) {
              console.log(`    终止原因: ${container.state.terminated.reason}`)
              console.log(`    退出码: ${container.state.terminated.exitCode}`)
            }
          }
        }
      }
    }

    // 检查 Services
    console.log('\n🌐 检查 Services...')
    const services = await k3sService.listServices(namespace)
    if (services.items.length === 0) {
      console.log('❌ 未找到 Service')
    } else {
      for (const svc of services.items) {
        console.log(`\nService: ${svc.metadata.name}`)
        console.log(`  类型: ${svc.spec.type}`)
        console.log(`  ClusterIP: ${svc.spec.clusterIP}`)
        if (svc.spec.ports) {
          console.log(
            `  端口: ${svc.spec.ports.map((p: any) => `${p.port}:${p.targetPort}`).join(', ')}`,
          )
        }
      }
    }

    // 检查 Ingress
    console.log('\n🔗 检查 Ingress...')
    const ingresses = await k3sService.listIngresses(namespace)
    if (ingresses.items.length === 0) {
      console.log('❌ 未找到 Ingress')
    } else {
      for (const ing of ingresses.items) {
        console.log(`\nIngress: ${ing.metadata.name}`)
        if (ing.spec.rules) {
          for (const rule of ing.spec.rules) {
            console.log(`  域名: ${rule.host}`)
            if (rule.http?.paths) {
              for (const path of rule.http.paths) {
                console.log(
                  `    路径: ${path.path} -> ${path.backend.service.name}:${path.backend.service.port.number}`,
                )
              }
            }
          }
        }
      }
    }

    // 检查 Flux Kustomization
    console.log('\n🔄 检查 Flux Kustomization...')
    try {
      const kustomizations = await k3sService.getFluxKustomizations(namespace)
      if (kustomizations.items.length === 0) {
        console.log('❌ 未找到 Flux Kustomization')
      } else {
        for (const kust of kustomizations.items) {
          console.log(`\nKustomization: ${kust.metadata.name}`)
          console.log(
            `  就绪: ${kust.status?.conditions?.find((c: any) => c.type === 'Ready')?.status || 'Unknown'}`,
          )
          console.log(`  最后应用: ${kust.status?.lastAppliedRevision || 'N/A'}`)
          if (kust.status?.conditions) {
            for (const condition of kust.status.conditions) {
              if (condition.status === 'False') {
                console.log(`  ⚠️  ${condition.type}: ${condition.message}`)
              }
            }
          }
        }
      }
    } catch (error) {
      console.log('⚠️  无法获取 Flux Kustomization (可能未安装 Flux)')
    }

    console.log('\n✅ 检查完成')
  } catch (error) {
    console.error('\n❌ 检查失败:', error)
  }
}

checkK3sProject()
