#!/usr/bin/env bun
/**
 * 重新同步项目 11444a 的 ImagePullSecret
 */

import { db } from '@juanie/core/database'
import { gitConnections } from '@juanie/core/database/schemas/git-connections.schema'
import { execSync } from 'child_process'
import { eq } from 'drizzle-orm'

const NAMESPACE = 'project-a5ca948d-2db3-437e-8504-bc7cc956013e-development'
const USERNAME = '997899594'

async function syncSecret() {
  console.log('🔄 同步 ImagePullSecret...')
  console.log(`📦 命名空间: ${NAMESPACE}`)

  // 1. 获取更新后的 Token
  console.log('\n📥 获取 GitHub Token...')
  const [gitConnection] = await db
    .select()
    .from(gitConnections)
    .where(eq(gitConnections.username, USERNAME))

  if (!gitConnection) {
    console.error(`❌ 未找到用户 ${USERNAME} 的 Git 连接`)
    process.exit(1)
  }

  console.log('✅ Git Connection:')
  console.log({
    username: gitConnection.username,
    provider: gitConnection.provider,
    tokenPrefix: gitConnection.accessToken.substring(0, 10) + '...',
  })

  // 2. 创建 Docker Config
  console.log('\n🔧 创建 Docker Config...')
  const dockerConfig = {
    auths: {
      'ghcr.io': {
        username: gitConnection.username,
        password: gitConnection.accessToken,
        auth: Buffer.from(`${gitConnection.username}:${gitConnection.accessToken}`).toString(
          'base64',
        ),
      },
    },
  }

  const dockerConfigJson = JSON.stringify(dockerConfig)
  const dockerConfigBase64 = Buffer.from(dockerConfigJson).toString('base64')

  // 3. 删除旧 Secret
  console.log('\n🗑️  删除旧 Secret...')
  try {
    execSync(
      `kubectl --kubeconfig=.kube/k3s-remote.yaml delete secret ghcr-secret -n ${NAMESPACE}`,
      { stdio: 'inherit' },
    )
    console.log('✅ 旧 Secret 已删除')
  } catch (error) {
    console.log('ℹ️  旧 Secret 不存在，跳过删除')
  }

  // 4. 创建新 Secret
  console.log('\n📝 创建新 Secret...')
  const secretYaml = `
apiVersion: v1
kind: Secret
metadata:
  name: ghcr-secret
  namespace: ${NAMESPACE}
type: kubernetes.io/dockerconfigjson
data:
  .dockerconfigjson: ${dockerConfigBase64}
`

  // 写入临时文件
  await Bun.write('/tmp/ghcr-secret.yaml', secretYaml)

  // 应用 Secret
  execSync('kubectl --kubeconfig=.kube/k3s-remote.yaml apply -f /tmp/ghcr-secret.yaml', {
    stdio: 'inherit',
  })

  console.log('✅ 新 Secret 已创建')

  // 5. 验证 Secret
  console.log('\n🔍 验证 Secret...')
  const secretData = execSync(
    `kubectl --kubeconfig=.kube/k3s-remote.yaml get secret ghcr-secret -n ${NAMESPACE} -o jsonpath='{.data.\\.dockerconfigjson}' | base64 -d`,
    { encoding: 'utf-8' },
  )

  const parsedConfig = JSON.parse(secretData)
  console.log('✅ Secret 内容:')
  console.log({
    registry: 'ghcr.io',
    username: parsedConfig.auths['ghcr.io'].username,
    hasPassword: !!parsedConfig.auths['ghcr.io'].password,
    hasAuth: !!parsedConfig.auths['ghcr.io'].auth,
  })

  console.log('\n✅ ImagePullSecret 同步完成！')
  console.log('\n📋 下一步:')
  console.log('   1. 删除旧 Pod:')
  console.log(`      kubectl --kubeconfig=.kube/k3s-remote.yaml delete pod --all -n ${NAMESPACE}`)
  console.log('   2. 等待新 Pod 创建 (10-15秒)')
  console.log('   3. 查看 Pod 状态:')
  console.log(`      kubectl --kubeconfig=.kube/k3s-remote.yaml get pods -n ${NAMESPACE}`)
}

syncSecret().catch(console.error)
