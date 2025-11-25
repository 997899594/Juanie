#!/usr/bin/env bun

import { createPublicKey, generateKeyPairSync } from 'node:crypto'

console.log('Testing SSH key generation...\n')

// 生成密钥对
const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem',
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem',
  },
})

console.log('PEM Public Key:')
console.log(publicKey)
console.log('\nPEM Private Key (first 100 chars):')
console.log(privateKey.substring(0, 100) + '...')

// 方法 1: 使用 DER 格式提取
const keyObject = createPublicKey(publicKey)
const exported = keyObject.export({ type: 'spki', format: 'der' })

console.log('\n--- Method 1: Manual DER parsing ---')
console.log('DER buffer length:', exported.length)
console.log('DER hex (first 50 bytes):', exported.subarray(0, 50).toString('hex'))

// Ed25519 SPKI 格式分析
// 30 2a - SEQUENCE, length 42
// 30 05 - SEQUENCE, length 5 (algorithm identifier)
// 06 03 2b 65 70 - OID 1.3.101.112 (Ed25519)
// 03 21 00 - BIT STRING, length 33, 0 unused bits
// [32 bytes] - actual public key

const publicKeyBytes = exported.subarray(12, 44) // 提取 32 字节公钥
console.log('Public key bytes length:', publicKeyBytes.length)
console.log('Public key hex:', publicKeyBytes.toString('hex'))

const base64Key = publicKeyBytes.toString('base64')
console.log('Base64 key:', base64Key)
console.log('Base64 length:', base64Key.length)

const sshFormat1 = `ssh-ed25519 ${base64Key} test-key`
console.log('\nOpenSSH format:', sshFormat1)

// 方法 2: 使用 Node.js 内置的 export 方法
console.log('\n--- Method 2: Using export with ssh format ---')
try {
  const sshPublicKey = keyObject.export({
    type: 'spki',
    format: 'pem',
  })

  // 尝试转换为 OpenSSH 格式
  const lines = sshPublicKey
    .split('\n')
    .filter((line) => !line.includes('BEGIN') && !line.includes('END') && line.trim())
  const pemBase64 = lines.join('')
  console.log('PEM base64 (no headers):', pemBase64.substring(0, 50) + '...')
} catch (err) {
  console.error('Method 2 failed:', err)
}

// 验证格式
console.log('\n--- Validation ---')
console.log('Expected format: ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA... comment')
console.log('Our format:     ', sshFormat1.substring(0, 60) + '...')
console.log('\nKey starts with correct prefix?', base64Key.length === 43 || base64Key.length === 44)
