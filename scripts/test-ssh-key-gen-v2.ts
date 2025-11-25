#!/usr/bin/env bun

import { createPublicKey, generateKeyPairSync } from 'node:crypto'

console.log('Testing OpenSSH format generation...\n')

// 生成密钥对
const { publicKey } = generateKeyPairSync('ed25519', {
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem',
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem',
  },
})

// 从 PEM 格式提取公钥数据
const keyObject = createPublicKey(publicKey)
const exported = keyObject.export({ type: 'spki', format: 'der' })

// 提取 32 字节公钥
const publicKeyBytes = exported.subarray(12, 44)

console.log('Public key bytes (32):', publicKeyBytes.length)
console.log('Hex:', publicKeyBytes.toString('hex'))

// 构建 OpenSSH 格式
const keyType = 'ssh-ed25519'
const keyTypeBuffer = Buffer.from(keyType)

const sshKeyBuffer = Buffer.concat([
  // Key type length (4 bytes, big-endian)
  Buffer.from([0, 0, 0, keyTypeBuffer.length]),
  // Key type
  keyTypeBuffer,
  // Public key length (4 bytes, big-endian)
  Buffer.from([0, 0, 0, publicKeyBytes.length]),
  // Public key data
  publicKeyBytes,
])

const base64Key = sshKeyBuffer.toString('base64')
const sshFormat = `${keyType} ${base64Key} test-comment`

console.log('\nOpenSSH format:')
console.log(sshFormat)
console.log('\nBase64 key length:', base64Key.length)
console.log('Starts with AAAAC3NzaC1lZDI1NTE5?', base64Key.startsWith('AAAAC3NzaC1lZDI1NTE5'))

// 验证格式
console.log('\n--- Validation ---')
const parts = sshFormat.split(' ')
console.log('Parts:', parts.length, '(should be 3)')
console.log('Type:', parts[0], '(should be ssh-ed25519)')
console.log('Key starts correctly?', parts[1]?.startsWith('AAAAC3NzaC1lZDI1NTE5'))
