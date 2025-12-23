# Flux 网络策略问题

## 问题：网络策略阻止 SSH 连接

### 症状

```
failed to checkout and determine revision: 
unable to clone 'ssh://git@github.com/owner/repo.git': 
dial tcp 20.205.243.166:22: connect: connection refused
```

GitRepository 状态：
- Ready: Unknown
- Type: FetchFailed
- Reason: GitOperationFailed

### 根本原因

Kubernetes NetworkPolicy 只允许 HTTPS (443) 出站连接，但 SSH 使用 22 端口。

**问题的网络策略：**
```yaml
spec:
  egress:
  - ports:
    - port: 443      # ✅ HTTPS
      protocol: TCP
    - port: 6443     # ✅ Kubernetes API
      protocol: TCP
  # ❌ 缺少 22 端口 (SSH)
```

### 诊断步骤

#### 1. 检查网络策略

```bash
# 查看 flux-system 的网络策略
kubectl get networkpolicy -n flux-system

# 查看详细配置
kubectl get networkpolicy allow-egress -n flux-system -o yaml
```

#### 2. 测试网络连接

```bash
# 进入 Flux pod
kubectl exec -it -n flux-system deployment/source-controller -- sh

# 测试 DNS 解析
nslookup github.com

# 测试 22 端口连接
nc -zv github.com 22

# 如果没有输出或超时，说明端口被阻止
```

#### 3. 从服务器测试

```bash
# 在 K3s 服务器上（不是 pod 内）
curl -v telnet://github.com:22

# 或者
timeout 5 bash -c 'cat < /dev/null > /dev/tcp/github.com/22' && echo "Port 22 is open" || echo "Port 22 is closed"
```

### 解决方案

更新网络策略，添加 22 端口：

```bash
kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-egress
  namespace: flux-system
spec:
  podSelector: {}
  policyTypes:
  - Egress
  egress:
  # 允许访问 Kubernetes API
  - to:
    - namespaceSelector: {}
    ports:
    - protocol: TCP
      port: 443
    - protocol: TCP
      port: 6443
  
  # 允许 DNS 查询
  - to:
    - namespaceSelector: {}
      podSelector:
        matchLabels:
          k8s-app: kube-dns
    ports:
    - protocol: UDP
      port: 53
  
  # 允许外部 HTTPS 和 SSH
  - ports:
    - protocol: TCP
      port: 443   # HTTPS
    - protocol: TCP
      port: 22    # SSH ← 添加这个！
EOF
```

### 验证修复

```bash
# 等待几秒钟让策略生效

# 再次测试连接
kubectl exec -it -n flux-system deployment/source-controller -- sh -c "nc -zv github.com 22"

# 应该看到：
# github.com (20.205.243.166:22) open

# 检查 GitRepository 状态
kubectl get gitrepository -A

# 应该看到 Ready: True
```

### 网络策略最佳实践

#### 1. 最小权限原则

只开放必需的端口：

```yaml
egress:
- ports:
  - port: 443   # HTTPS (Git over HTTPS, Helm charts)
    protocol: TCP
  - port: 22    # SSH (Git over SSH)
    protocol: TCP
  - port: 53    # DNS
    protocol: UDP
```

#### 2. 使用标签选择器

针对特定的 pod 应用策略：

```yaml
spec:
  podSelector:
    matchLabels:
      app: source-controller  # 只对 source-controller 应用
```

#### 3. 分离内部和外部流量

```yaml
egress:
# 内部流量（集群内）
- to:
  - namespaceSelector: {}
  ports:
  - port: 443
    protocol: TCP

# 外部流量（互联网）
- ports:
  - port: 443
    protocol: TCP
  - port: 22
    protocol: TCP
```

### 常见端口需求

| 服务 | 端口 | 协议 | 用途 |
|------|------|------|------|
| DNS | 53 | UDP | 域名解析 |
| SSH | 22 | TCP | Git over SSH |
| HTTPS | 443 | TCP | Git over HTTPS, Helm charts |
| Kubernetes API | 6443 | TCP | 集群内通信 |

### 故障排查清单

- [ ] 检查网络策略是否存在
- [ ] 确认 22 端口在 egress 规则中
- [ ] 测试从 pod 内访问 github.com:22
- [ ] 检查服务器防火墙规则
- [ ] 查看 Flux source-controller 日志
- [ ] 验证 DNS 解析正常

### 相关问题

- [SSH 认证问题](./ssh-authentication.md)
- [Secret 配置问题](./secret-configuration.md)

### 参考资料

- [Kubernetes NetworkPolicy 文档](https://kubernetes.io/docs/concepts/services-networking/network-policies/)
- [Flux 网络要求](https://fluxcd.io/flux/installation/#network-requirements)

## 其他网络问题

### 问题：防火墙阻止出站连接

如果服务器本身的防火墙阻止了 22 端口：

```bash
# 检查 iptables
sudo iptables -L -n | grep 22

# 检查 ufw（如果使用）
sudo ufw status

# 允许出站 SSH
sudo ufw allow out 22/tcp
```

### 问题：代理配置

如果需要通过代理访问 GitHub：

```yaml
# 在 Flux deployment 中配置代理
env:
- name: HTTPS_PROXY
  value: "http://proxy.example.com:8080"
- name: NO_PROXY
  value: "localhost,127.0.0.1,.cluster.local"
```

### 问题：DNS 解析失败

```bash
# 测试 DNS
kubectl exec -it -n flux-system deployment/source-controller -- nslookup github.com

# 如果失败，检查 CoreDNS
kubectl get pods -n kube-system -l k8s-app=kube-dns
kubectl logs -n kube-system -l k8s-app=kube-dns
```

## 总结

网络策略问题的关键点：

1. **识别症状**：connection refused 通常是网络策略问题
2. **检查策略**：确认所需端口在 egress 规则中
3. **分层诊断**：从 pod → 节点 → 外部网络逐层测试
4. **最小权限**：只开放必需的端口和协议

记住：SSH 需要 22 端口，HTTPS 需要 443 端口！
