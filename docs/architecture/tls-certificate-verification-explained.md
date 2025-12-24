# TLS 证书验证原理详解

**日期**: 2024-12-24  
**问题**: 为什么更新 CA 证书就能解决 ghcr.io 的 TLS 验证问题？

## HTTPS 证书验证流程

### 1. 完整的握手过程

```
客户端 (K3s containerd)          服务器 (ghcr.io)
        |                              |
        |  1. ClientHello              |
        |----------------------------->|
        |                              |
        |  2. ServerHello + 证书链      |
        |<-----------------------------|
        |                              |
        |  3. 验证证书                  |
        |  - 检查证书链                 |
        |  - 验证签名                   |
        |  - 检查有效期                 |
        |  - 验证域名                   |
        |                              |
        |  4. 加密通信                  |
        |<---------------------------->|
```

### 2. 证书链结构

```
ghcr.io 的证书链:

┌─────────────────────────────────┐
│  ghcr.io 服务器证书              │  ← 叶子证书
│  CN: ghcr.io                    │
│  签发者: DigiCert TLS RSA SHA256│
└─────────────────────────────────┘
            ↓ 由中间 CA 签发
┌─────────────────────────────────┐
│  DigiCert TLS RSA SHA256 2020   │  ← 中间证书
│  签发者: DigiCert Global Root CA │
└─────────────────────────────────┘
            ↓ 由根 CA 签发
┌─────────────────────────────────┐
│  DigiCert Global Root CA        │  ← 根证书
│  自签名                          │
└─────────────────────────────────┘
```

### 3. 验证过程

```bash
# 查看 ghcr.io 的完整证书链
openssl s_client -connect ghcr.io:443 -showcerts

# 输出示例:
Certificate chain
 0 s:CN = ghcr.io
   i:C = US, O = DigiCert Inc, CN = DigiCert TLS RSA SHA256 2020 CA1
 1 s:C = US, O = DigiCert Inc, CN = DigiCert TLS RSA SHA256 2020 CA1
   i:C = US, O = DigiCert Inc, OU = www.digicert.com, CN = DigiCert Global Root CA
```

---

## 为什么会出现证书验证失败？

### 错误信息分析

```
x509: certificate is valid for *.github.io, *.github.com, 
*.githubusercontent.com, github.com, github.io, 
githubusercontent.com, www.github.com, not ghcr.io
```

**这是一个误导性错误！** 真正的问题不是证书不包含 ghcr.io。

### 真实原因

#### 原因 1: CA 证书包不完整或过期

```bash
# K3s 节点上的 CA 证书存储位置
/etc/ssl/certs/ca-certificates.crt  # 所有受信任的根证书

# 如果这个文件缺少 DigiCert Global Root CA
# 就无法验证 ghcr.io 的证书链
```

**验证过程**:
```
1. containerd 收到 ghcr.io 的证书
2. 尝试验证证书链
3. 查找 DigiCert Global Root CA
4. ❌ 找不到！（CA 证书包不完整）
5. 验证失败，报错
```

**为什么错误信息提到 github.com？**

这是 OpenSSL 的错误信息生成机制导致的：
- 当证书链验证失败时
- OpenSSL 会尝试匹配证书的 SAN (Subject Alternative Names)
- 如果找到其他相关域名，就会在错误信息中显示
- 但这**不是**真正的问题原因

#### 原因 2: 系统时间不同步

```bash
# 证书有效期
Not Before: 2024-01-01 00:00:00 GMT
Not After : 2025-01-01 00:00:00 GMT

# 如果系统时间是 2023-12-31
# 证书还未生效，验证失败

# 如果系统时间是 2025-01-02
# 证书已过期，验证失败
```

#### 原因 3: 中间证书缺失

有些服务器配置不当，不会发送完整的证书链：
```
服务器只发送:
  - ghcr.io 证书 (叶子证书)

客户端需要:
  - ghcr.io 证书
  - DigiCert TLS RSA SHA256 2020 CA1 (中间证书)
  - DigiCert Global Root CA (根证书)
```

---

## 更新 CA 证书的作用

### 1. 更新证书包

```bash
apt-get install -y ca-certificates
```

**做了什么**:
- 下载最新的根证书包
- 包含所有主流 CA 的根证书
- 包括 DigiCert, Let's Encrypt, GlobalSign 等

**文件位置**:
```bash
/usr/share/ca-certificates/mozilla/  # Mozilla 维护的根证书
/etc/ssl/certs/                       # 系统证书目录
```

### 2. 刷新证书索引

```bash
update-ca-certificates --fresh
```

**做了什么**:
```bash
# 1. 清理旧的证书索引
rm -rf /etc/ssl/certs/*

# 2. 重新生成证书索引
# 从 /usr/share/ca-certificates/ 复制证书到 /etc/ssl/certs/

# 3. 生成证书哈希链接
# 为每个证书创建哈希链接，方便快速查找

# 4. 合并所有根证书到一个文件
cat /usr/share/ca-certificates/mozilla/*.crt > /etc/ssl/certs/ca-certificates.crt
```

**输出示例**:
```
Updating certificates in /etc/ssl/certs...
151 added, 0 removed; done.
Running hooks in /etc/ca-certificates/update.d...
done.
```

### 3. containerd 使用更新后的证书

```bash
# containerd 配置
/etc/containerd/config.toml

# 默认使用系统证书
[plugins."io.containerd.grpc.v1.cri".registry]
  config_path = "/etc/containerd/certs.d"

# 系统证书路径
/etc/ssl/certs/ca-certificates.crt
```

---

## 验证修复效果

### 1. 手动测试证书验证

```bash
# 测试 ghcr.io 的证书
openssl s_client -connect ghcr.io:443 -CAfile /etc/ssl/certs/ca-certificates.crt

# 成功输出:
Verify return code: 0 (ok)  # ✅ 验证成功
```

### 2. 使用 crictl 测试拉取镜像

```bash
# crictl 是 K3s 使用的容器运行时客户端
crictl pull ghcr.io/library/alpine:latest

# 成功输出:
Image is up to date for ghcr.io/library/alpine@sha256:xxx
```

### 3. 检查证书链

```bash
# 查看完整的证书链验证过程
openssl s_client -connect ghcr.io:443 -showcerts -CAfile /etc/ssl/certs/ca-certificates.crt

# 输出应该包含:
depth=2 C = US, O = DigiCert Inc, OU = www.digicert.com, CN = DigiCert Global Root CA
verify return:1  # ✅ 根证书验证成功

depth=1 C = US, O = DigiCert Inc, CN = DigiCert TLS RSA SHA256 2020 CA1
verify return:1  # ✅ 中间证书验证成功

depth=0 CN = ghcr.io
verify return:1  # ✅ 叶子证书验证成功
```

---

## 为什么不是域名问题？

### 查看 ghcr.io 证书的 SAN

```bash
# 提取证书
echo | openssl s_client -connect ghcr.io:443 2>/dev/null | \
  openssl x509 -noout -text | grep -A1 "Subject Alternative Name"

# 输出:
X509v3 Subject Alternative Name:
    DNS:ghcr.io, DNS:*.ghcr.io
```

**证书确实包含 ghcr.io！**

错误信息提到的 `*.github.com` 是**误导**，真正的问题是**证书链验证失败**。

---

## 其他可能的原因

### 1. DNS 劫持

```bash
# 检查 DNS 解析
dig ghcr.io

# 应该返回 GitHub 的 IP
;; ANSWER SECTION:
ghcr.io.  60  IN  A  140.82.121.33
```

如果返回错误的 IP，可能是 DNS 劫持，导致连接到错误的服务器。

### 2. 中间人攻击

```bash
# 检查证书指纹
echo | openssl s_client -connect ghcr.io:443 2>/dev/null | \
  openssl x509 -noout -fingerprint -sha256

# 应该匹配 GitHub 官方的证书指纹
```

### 3. 防火墙/代理问题

某些企业防火墙会进行 SSL 检查，替换证书：
```
客户端 → 防火墙 (替换证书) → ghcr.io
```

---

## 完整的修复流程

### 为什么需要这些步骤？

```bash
# 1. 更新 CA 证书包
apt-get install -y ca-certificates
# → 获取最新的根证书

# 2. 刷新证书索引
update-ca-certificates --fresh
# → 让系统识别新证书

# 3. 同步系统时间
ntpdate -u pool.ntp.org
# → 确保证书有效期验证正确

# 4. 重启 containerd
systemctl restart containerd
# → 让 containerd 重新加载证书

# 5. 重启 K3s
systemctl restart k3s
# → 让 K3s 重新初始化
```

---

## 类比理解

### 证书验证就像验证身份证

```
1. 你去银行办业务，出示身份证
   → ghcr.io 出示 TLS 证书

2. 银行验证身份证真伪
   → containerd 验证证书

3. 银行需要公安部的防伪数据库
   → containerd 需要 CA 证书包

4. 如果数据库过期，无法验证
   → CA 证书包过期，验证失败

5. 更新数据库后，验证成功
   → 更新 CA 证书后，验证成功
```

---

## 总结

**为什么更新 CA 证书就好了？**

1. **根本原因**: K3s 节点的 CA 证书包不完整或过期
2. **验证失败**: 无法找到 DigiCert Global Root CA
3. **更新证书**: 获取最新的根证书包
4. **验证成功**: 完整的证书链验证通过

**错误信息为什么提到 github.com？**
- 这是 OpenSSL 的误导性错误信息
- 真正的问题是证书链验证失败
- 不是域名不匹配的问题

**一句话总结**:
> CA 证书包就像"信任列表"，更新后 containerd 才能信任 ghcr.io 的证书签发机构。
