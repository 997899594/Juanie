// 测试 API Gateway 启动，检查 K3s 连接
import { spawn } from 'child_process'

const child = spawn('node', ['--import', 'tsx', 'src/main.ts'], {
  cwd: 'apps/api-gateway',
  stdio: ['ignore', 'pipe', 'pipe'],
})

let output = ''

child.stdout.on('data', (data) => {
  output += data.toString()
  process.stdout.write(data)
})

child.stderr.on('data', (data) => {
  output += data.toString()
  process.stderr.write(data)
})

// 15秒后停止
setTimeout(() => {
  child.kill()
  console.log('\n--- 启动完成 ---')

  if (output.includes('K3s 连接成功')) {
    console.log('✅ K3s 连接成功!')
  } else if (output.includes('K3s 连接失败')) {
    console.log('❌ K3s 连接失败')
  } else {
    console.log('⚠️ 未找到 K3s 连接状态')
  }

  process.exit(0)
}, 15000)
