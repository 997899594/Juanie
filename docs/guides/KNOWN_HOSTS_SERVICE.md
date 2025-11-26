# SSH Known Hosts 管理服务

## 概述

`KnownHostsService` 是一个专门管理 SSH known_hosts 的服务，用于 Flux GitRepository 的 SSH 认证。

## 为什么需要这个服务？

### 问题背景

Flux 的 GitRepository 使用 SSH 认证时，需要在 Kubernetes Secret 中提供三个字段：

1. `ssh-privatekey` - SSH 私钥（Kubernetes 标准）
2. `identity` - SSH 私钥（Flux 要求，与 ssh-privatekey 相同）
3. `known_hosts` - SSH 主机密钥（Flux 要求，用于验证服务器身份）

如果缺少 `known_hosts`，Flux 会报错：
```
'known_hosts' is required
```

### 什么是 known_hosts？

`known_hosts` 是 SSH 客户端用来验证服务器身份的文件，包含已知服务器的公钥指纹。

**作用：**
- 防止中间人攻击（MITM）
- 确保连接的是真正的 Git 服务器

**格式：**
```
hostname algorithm public-key
```

例如：
```
github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl
```

## 服务特性

### 1. 动态获取

使用 `ssh-keyscan` 命令动态获取 Git 提供商的 SSH 主机密钥：

```typescript
const knownHosts = await knownHostsService.getKnownHosts('github')
```

**优点：**
- 始终获取最新的主机密钥
- 支持所有算法（RSA, ECDSA, Ed25519）
- 自动处理主机密钥更新

### 2. 智能缓存

- 缓存时间：24 小时
- 减少网络请求
- 提高性能

```typescript
// 第一次调用：从 ssh-keyscan 获取
const hosts1 = await knownHostsService.getKnownHosts('github')

// 24 小时内再次调用：从缓存返回
const hosts2 = await knownHostsService.getKnownHosts('github')
```

### 3. 备用方案

如果 `ssh-keyscan` 失败（网络问题、命令不存在等），自动使用官方提供的备用密钥：

- **GitHub**: 来自 [GitHub 官方文档](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/githubs-ssh-key-fingerprints)
- **GitLab**: 来自 [GitLab 官方文档](https://docs.gitlab.com/ee/user/gitlab_com/index.html#ssh-host-keys-fingerprints)

### 4. 多提供商支持

支持多个 Git 提供商：

```typescript
// GitHub
const githubHosts = await knownHostsService.getKnownHosts('github')

// GitLab
const gitlabHosts = await knownHostsService.getKnownHosts('gitlab')

// 自定义主机
const customHosts = await knownHostsService.getKnownHosts('github', 'github.example.com')
```

## 使用方法

### 在 FluxResourcesService 中使用

```typescript
@Injectable()
export class FluxResourcesService {
  constructor(
    private knownHosts: KnownHostsService,
    // ... 其他依赖
  ) {}

  async createGitSecret(namespace: string, credential: GitCredential) {
    // 获取 known_hosts
    const knownHostsContent = await this.knownHosts.getKnownHosts('github')

    // 创建 Secret
    await this.k3s.createSecret(
      namespace,
      secretName,
      {
        'ssh-privatekey': credential.token,
        identity: credential.token,
        known_hosts: knownHostsContent, // 动态获取
      },
      'kubernetes.io/ssh-auth',
    )
  }
}
```

### 管理缓存

```typescript
// 查看缓存统计
const stats = knownHostsService.getCacheStats()
console.log(stats)
// {
//   size: 2,
//   entries: [
//     { host: 'github.com', age: 3600 },
//     { host: 'gitlab.com', age: 1800 }
//   ]
// }

// 清除缓存（强制重新获取）
knownHostsService.clearCache()
```

### 从 URL 提取主机名

```typescript
// SSH URL
const host1 = knownHostsService.extractHostFromUrl('ssh://git@github.com/owner/repo.git')
// 返回: 'github.com'

// HTTPS URL
const host2 = knownHostsService.extractHostFromUrl('https://github.com/owner/repo.git')
// 返回: 'github.com'

// 传统 SSH URL
const host3 = knownHostsService.extractHostFromUrl('git@github.com:owner/repo.git')
// 返回: 'github.com'
```

## 工作流程

```
1. 调用 getKnownHosts('github')
   ↓
2. 检查缓存
   ├─ 有缓存且未过期 → 返回缓存
   └─ 无缓存或已过期 → 继续
   ↓
3. 执行 ssh-keyscan github.com
   ├─ 成功 → 缓存结果并返回
   └─ 失败 → 使用备用密钥
   ↓
4. 返回 known_hosts 内容
```

## ssh-keyscan 命令

服务内部使用的命令：

```bash
ssh-keyscan -t rsa,ecdsa,ed25519 github.com
```

**参数说明：**
- `-t rsa,ecdsa,ed25519`: 获取所有三种算法的密钥
- `github.com`: 目标主机
- `2>/dev/null`: 忽略错误输出

**输出示例：**
```
github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl
github.com ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBEmKSENjQEezOmxkZMy7opKgwFB9nkt5YRrYMjNuG5N87uRgg6CLrbo5wAdT/y6v0mKV0U2w0WZ2YB/++Tpockg=
github.com ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQCj7ndNxQowgcQnjshcLrqPEiiphnt+VTTvDP6mHBL9j1aNUkY4Ue1gvwnGLVlOhGeYrnZaMgRK6+PKCUXaDbC7qtbW8gIkhL7aGCsOr/C56SJMy/BCZfxd1nWzAOxSDPgVsmerOBYfNqltV9/hWCqBywINIR+5dIg6JTJ72pcEpEjcYgXkE2YEFXV1JHnsKgbLWNlhScqb2UmyRkQyytRLtL+38TGxkxCflmO+5Z8CSSNY7GidjMIZ7Q4zMjA2n1nGrlTDkzwDCsw+wqFPGQA179cnfGWOWRVruj16z6XyvxvjJwbz0wQZ75XK5tKSb7FNyeIEs4TT4jk+S4dhPeAUC5y+bDYirYgM4GC7uEnztnZyaVWQ7B381AK4Qdrwt51ZqExKbQpTUNn+EjqoTwvqNj4kqx5QUCI0ThS/YkOxJCXmPUWZbhjpCg56i+2aB6CmK2JGhn57K5mj0MNdBXA4/WnwH6XoPWJzK5Nyu2zB3nAZp+S5hpQs+p1vN1/wsjk=
```

## 安全考虑

### 1. 主机密钥验证

使用 known_hosts 可以防止中间人攻击：

```
没有 known_hosts:
Client → [攻击者] → GitHub
         ↑ 可以伪装成 GitHub

有 known_hosts:
Client → [攻击者] → GitHub
         ↑ 公钥不匹配，连接被拒绝
```

### 2. 备用密钥的可靠性

备用密钥来自官方文档，定期更新：
- GitHub: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/githubs-ssh-key-fingerprints
- GitLab: https://docs.gitlab.com/ee/user/gitlab_com/index.html#ssh-host-keys-fingerprints

### 3. 缓存过期

24 小时的缓存时间平衡了性能和安全性：
- 足够短，可以及时获取密钥更新
- 足够长，减少不必要的网络请求

## 故障排查

### 问题 1: ssh-keyscan 命令不存在

**症状：**
```
ssh-keyscan failed: command not found
```

**解决：**
服务会自动使用备用密钥，无需手动处理。

如果需要安装 ssh-keyscan：
```bash
# Ubuntu/Debian
apt-get install openssh-client

# Alpine
apk add openssh-client

# macOS (通常已安装)
brew install openssh
```

### 问题 2: 网络超时

**症状：**
```
ssh-keyscan failed: timeout
```

**解决：**
- 检查网络连接
- 检查防火墙规则（需要访问端口 22）
- 服务会自动使用备用密钥

### 问题 3: 缓存过期导致频繁请求

**解决：**
调整缓存 TTL（在代码中修改 `CACHE_TTL` 常量）：

```typescript
private readonly CACHE_TTL = 7 * 24 * 60 * 60 * 1000 // 7 天
```

## 最佳实践

1. **使用动态获取**：优先使用 `getKnownHosts()` 而不是硬编码
2. **监控缓存**：定期检查缓存统计，确保正常工作
3. **测试备用方案**：确保备用密钥是最新的
4. **日志记录**：关注服务日志，及时发现问题

## 相关文档

- [Flux SSH 认证](https://fluxcd.io/flux/components/source/gitrepositories/#ssh-authentication)
- [GitHub SSH 密钥指纹](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/githubs-ssh-key-fingerprints)
- [GitLab SSH 主机密钥](https://docs.gitlab.com/ee/user/gitlab_com/index.html#ssh-host-keys-fingerprints)
