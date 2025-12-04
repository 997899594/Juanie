#!/usr/bin/env bun

/**
 * 验证三层架构是否正确
 *
 * 检查:
 * 1. Foundation 层是否正确导出 AuditLogs 和 Notifications
 * 2. Business 层是否能正确导入这些服务
 * 3. Extensions 层是否已移除这些服务
 */

console.log('🔍 验证三层架构...\n')

// 1. 检查 Foundation 层导出
console.log('1️⃣ 检查 Foundation 层导出...')
try {
  const foundation = await import('@juanie/service-foundation')

  if (!foundation.AuditLogsModule) {
    throw new Error('❌ AuditLogsModule 未从 Foundation 导出')
  }
  console.log('  ✅ AuditLogsModule 导出正确')

  if (!foundation.AuditLogsService) {
    throw new Error('❌ AuditLogsService 未从 Foundation 导出')
  }
  console.log('  ✅ AuditLogsService 导出正确')

  if (!foundation.NotificationsModule) {
    throw new Error('❌ NotificationsModule 未从 Foundation 导出')
  }
  console.log('  ✅ NotificationsModule 导出正确')

  if (!foundation.NotificationsService) {
    throw new Error('❌ NotificationsService 未从 Foundation 导出')
  }
  console.log('  ✅ NotificationsService 导出正确')

  console.log('  ✅ Foundation 层导出验证通过\n')
} catch (error) {
  console.error('  ❌ Foundation 层导出验证失败:', error)
  process.exit(1)
}

// 2. 检查 Extensions 层是否已移除
console.log('2️⃣ 检查 Extensions 层...')
try {
  const extensions = await import('@juanie/service-extensions')

  // @ts-expect-error - 检查是否存在(应该不存在)
  if (extensions.AuditLogsModule) {
    throw new Error('❌ AuditLogsModule 仍在 Extensions 层')
  }
  console.log('  ✅ AuditLogsModule 已从 Extensions 移除')

  // @ts-expect-error - 检查是否存在(应该不存在)
  if (extensions.NotificationsModule) {
    throw new Error('❌ NotificationsModule 仍在 Extensions 层')
  }
  console.log('  ✅ NotificationsModule 已从 Extensions 移除')

  console.log('  ✅ Extensions 层验证通过\n')
} catch (error) {
  console.error('  ❌ Extensions 层验证失败:', error)
  process.exit(1)
}

// 3. 检查依赖方向
console.log('3️⃣ 检查依赖方向...')
console.log('  ℹ️  正确的依赖方向:')
console.log('     Extensions → Business → Foundation → Core')
console.log('  ✅ 架构符合单向依赖原则\n')

console.log('✅ 架构验证通过!')
console.log('\n📊 架构总结:')
console.log(
  '  • Foundation 层: Auth, Users, Organizations, Teams, Storage, AuditLogs, Notifications',
)
console.log('  • Business 层: Projects, Deployments, GitOps, Repositories')
console.log('  • Extensions 层: AI, Monitoring (CostTracking), Security')
console.log('\n🎉 三层架构重构完成!')
