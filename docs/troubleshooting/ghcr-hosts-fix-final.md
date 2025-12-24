# ghcr.io Hosts 配置修复完成

**日期**: 2024-12-23  
**问题**: `/etc/hosts` 中 ghcr.io 的 IP 配置错误  
**状态**: ✅ 已解决

## 问题根因

用户的 `/etc/hosts` 文件中，ghcr.io 被错误地映射到了 `raw.githubusercontent.com` 的 IP：

```bash
# ❌ 错误配置
185.199.108.133 ghcr.io  # 这是 raw.githubusercontent.com 的 IP
```

**导致的问题**:
1. 连接到错误的服务器
2. 收到 `*.github.io` 的证书（不是 `*.ghcr.io`）
3. TLS 证书验证失败

## 解决方案

### 1. 使用 DNS 解析获取正确 IP

```bash
# 使用 Google DNS 解析 ghcr.io
nslookup ghcr.io 8.8.8.8

# 输出:
Server:         8.8.8.8
Address:        8.8.8.8#53

Non-authoritative answer:
Name:   ghcr.io
Address: 20.205.243.164  # ✅ 正确的 IP (Azure CDN)
```

### 2. 更新 /etc/hosts

```bash
# 删除旧的错误配置
sed -i '/185.199.108.133 ghcr.io/d' /etc/hosts
sed -i '/185.199.109.133 ghcr.io/d' /etc/hosts
sed -i '/185.199.110.133 ghcr.io/d' /etc/hosts
sed -i '/185.199.111.133 ghcr.io/d' /etc/hosts

# 添加正确的 IP
echo "20.205.243.164 ghcr.io" >> /etc/hosts
```

### 3. 验证修复

```bash
# 1. 验证 TLS 证书
openssl s_client -connect ghcr.io:443 -CAfile /etc/ssl/certs/ca-certificates.crt 2>&1 | grep -E "subject|issuer|Verify"

# ✅ 成功输出:
subject=CN = *.ghcr.io
issuer=C = GB, ST = Greater Manchester, L = Salford, O = Sectigo Limited, CN = Sectigo RSA Domain Validation Secure Server CA
Verify return code: 0 (ok)
```

## 多租户场景

### 当前架构（已正确实现）

每个用户使用自己的 GitHub 账号和 Token：

```
用户 A → GitHub Token A → ghcr.io/user-a/project-name
用户 B → GitHub Token B → ghcr.io/user-b/project-name
用户 C → GitHub Token C → ghcr.io/user-c/project-name
```

### ImagePullSecret 管理

系统已经为每个用户的命名空间创建了独立的 ImagePullSecret：

```yaml
# 用户 A 的命名空间
apiVersion: v1
kind: Secret
metadata:
  name: ghcr-secret
  namespace: project-xxx-development
type: kubernetes.io/dockerconfigjson
data:
  .dockerconfigjson: <base64-encoded-docker-config>
    # 包含用户 A 的 GitHub Token
```

### 测试多租户镜像拉取

```bash
# 1. 测试用户自己的镜像（使用实际的用户名）
k3s crictl pull ghcr.io/997899594/11444a:latest

# 2. 删除旧 Pod，让 K8s 重新拉取镜像
k3s kubectl delete pod --all -n project-a5ca948d-2db3-437e-8504-bc7cc956013e-development

# 3. 等待新 Pod 创建
sleep 15

# 4. 查看 Pod 状态
k3s kubectl get pods -n project-a5ca948d-2db3-437e-8504-bc7cc956013e-development

# 5. 查看详细事件
k3s kubectl describe pod -n project-a5ca948d-2db3-437e-8504-bc7cc956013e-development
```

## 为什么不需要平台统一 Token

### 当前方案的优势

1. **自然隔离** - GitHub 用户级别隔离
2. **零运维** - 平台不需要管理镜像仓库
3. **权限清晰** - 用户完全控制自己的镜像
4. **无限扩展** - 支持任意数量用户
5. **成本为零** - 使用 GitHub 免费额度

### 如果使用平台统一 Token

❌ **问题**:
- 需要平台管理镜像仓库
- 需要实现复杂的权限控制
- 用户无法独立管理镜像
- 平台需要承担存储成本
- 扩展性受限

## 常见问题

### Q1: 用户的 Token 过期了怎么办？

**方案 A: 自动检测**
```typescript
// 定期检查 Token 有效性
async function checkTokenValidity(userId: string) {
  const gitConnection = await getGitConnection(userId)
  
  try {
    await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${gitConnection.accessToken}` }
    })
    return { valid: true }
  } catch {
    // 通知用户重新连接 GitHub
    await notifyUser(userId, 'token_expired')
    return { valid: false }
  }
}
```

**方案 B: 使用 GitHub App（推荐）**
- GitHub App Token 可以自动刷新
- 无需用户手动更新

### Q2: 如何防止用户拉取其他用户的镜像？

**GitHub 自动隔离**:
- 用户 A 的 Token 只能访问用户 A 的镜像
- 用户 B 的 Token 只能访问用户 B 的镜像
- 无需平台额外控制

### Q3: 多个用户共享一个项目怎么办？

**使用 GitHub Organization**:
```typescript
// 项目属于 Organization
const imageUrl = `ghcr.io/my-org/project-name`

// Organization 成员都可以访问
// 使用任一成员的 Token 都能拉取镜像
```

## 总结

✅ **TLS 证书问题已解决** - 更新 hosts 配置到正确的 IP
✅ **多租户架构正确** - 每个用户使用自己的 GitHub Token
✅ **无需平台统一 Token** - 当前架构已经是最佳实践

**下一步**: 测试用户实际的镜像拉取
```bash
k3s crictl pull ghcr.io/997899594/11444a:latest
```
