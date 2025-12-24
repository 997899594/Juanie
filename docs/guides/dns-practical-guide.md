# DNS 实战指南：从零到部署

## DNS 是什么？

**Domain Name System（域名系统）** - 互联网的"电话簿"，把人类可读的域名（如 `juanie.art`）翻译成机器可读的 IP 地址（如 `49.232.237.136`）。

### 为什么需要 DNS？

```
没有 DNS:
你: "我要访问 Google"
电脑: "请输入 142.250.185.46"
你: "我记不住啊！"

有了 DNS:
你: "我要访问 google.com"
电脑: "好的，我去查一下... 是 142.250.185.46"
```

## 核心概念（5 分钟掌握）

### 1. 域名结构

```
www.blog.juanie.art.
 │   │    │      │  └─ 根域（通常省略）
 │   │    │      └─── 顶级域（TLD）
 │   │    └────────── 二级域（你购买的域名）
 │   └─────────────── 三级域（子域名）
 └─────────────────── 四级域（子域名）
```

**你的情况**:
- `juanie.art` - 你购买的域名（二级域）
- `rrr.juanie.art` - 子域名（三级域）
- `www.juanie.art` - 子域名（三级域）

### 2. DNS 记录类型（只需记住这 4 个）

| 记录类型 | 作用 | 示例 | 使用场景 |
|---------|------|------|---------|
| **A** | 域名 → IPv4 地址 | `juanie.art → 49.232.237.136` | 最常用，指向服务器 |
| **AAAA** | 域名 → IPv6 地址 | `juanie.art → 2001:db8::1` | IPv6 服务器 |
| **CNAME** | 域名 → 另一个域名 | `www → juanie.art` | 域名别名 |
| **TXT** | 文本信息 | 用于验证、配置 | 域名验证、SPF 等 |

**记忆技巧**:
- **A** = Address（地址）
- **CNAME** = Canonical Name（规范名称）
- **TXT** = Text（文本）

### 3. 泛域名（Wildcard）

**符号**: `*`（星号）

**作用**: 匹配所有未明确定义的子域名

```
配置: *.juanie.art → 49.232.237.136

效果:
✅ rrr.juanie.art → 49.232.237.136
✅ 777q.juanie.art → 49.232.237.136
✅ anything.juanie.art → 49.232.237.136
❌ juanie.art → 不匹配（需要单独配置）
```

**为什么你需要泛域名？**
- 每个项目自动获得子域名
- 不用每次创建项目都去配置 DNS
- 一次配置，永久有效

## 实战操作：配置你的域名

### 场景 1: 泛域名配置（推荐）

**目标**: 所有项目自动使用 `<项目名>.juanie.art`

**腾讯云 DNSPod 操作步骤**:

1. 登录 [DNSPod 控制台](https://console.dnspod.cn/)
2. 找到 `juanie.art` 域名，点击"解析"
3. 点击"添加记录"
4. 填写配置：

```
记录类型: A
主机记录: *
记录值: 49.232.237.136
TTL: 600（10分钟）
```

5. 点击"保存"

**生效时间**: 5-10 分钟

**验证方法**:
```bash
# 测试任意子域名
nslookup rrr.juanie.art
nslookup 777q.juanie.art
nslookup test123.juanie.art

# 都应该返回: 49.232.237.136
```

### 场景 2: 单个子域名配置

**目标**: 只配置特定项目的域名

**配置**:
```
记录类型: A
主机记录: rrr
记录值: 49.232.237.136
TTL: 600
```

**效果**: 只有 `rrr.juanie.art` 可以访问

### 场景 3: 主域名配置

**目标**: `juanie.art`（不带 www）指向服务器

**配置**:
```
记录类型: A
主机记录: @
记录值: 49.232.237.136
TTL: 600
```

**注意**: `@` 代表主域名本身

### 场景 4: www 配置

**方法 1: 使用 A 记录**（推荐）
```
记录类型: A
主机记录: www
记录值: 49.232.237.136
TTL: 600
```

**方法 2: 使用 CNAME**
```
记录类型: CNAME
主机记录: www
记录值: juanie.art
TTL: 600
```

**区别**:
- A 记录: 直接指向 IP，速度快
- CNAME: 指向另一个域名，灵活但多一次查询

## DNS 查询流程（理解原理）

```
1. 你在浏览器输入: rrr.juanie.art
   ↓
2. 浏览器检查本地缓存
   ↓ (没有缓存)
3. 查询本地 DNS 服务器（通常是运营商提供）
   ↓ (没有缓存)
4. 查询根域名服务器: "art 在哪？"
   ↓
5. 查询 .art 顶级域服务器: "juanie.art 在哪？"
   ↓
6. 查询 juanie.art 权威服务器: "rrr.juanie.art 的 IP 是？"
   ↓
7. 返回: 49.232.237.136
   ↓
8. 浏览器连接到这个 IP
```

**首次查询**: 可能需要 1-2 秒  
**后续查询**: 毫秒级（有缓存）

## TTL（Time To Live）详解

**TTL** = DNS 记录的缓存时间

```
TTL: 600 秒（10分钟）
含义: DNS 服务器会缓存这条记录 10 分钟
```

**常用值**:

| TTL | 时间 | 使用场景 |
|-----|------|---------|
| 60 | 1分钟 | 测试阶段，需要频繁修改 |
| 600 | 10分钟 | 开发环境，平衡灵活性和性能 |
| 3600 | 1小时 | 生产环境，稳定配置 |
| 86400 | 1天 | 极少变动的配置 |

**实战建议**:
- 配置新域名时: 用 60 秒，方便测试
- 确认正常后: 改为 600 或 3600 秒

## 常见问题排查

### 问题 1: 域名配置了但访问不了

**排查步骤**:

```bash
# 1. 检查 DNS 是否生效
nslookup rrr.juanie.art

# 期望输出:
# Name:    rrr.juanie.art
# Address: 49.232.237.136

# 2. 检查服务器端口是否开放
telnet 49.232.237.136 80
telnet 49.232.237.136 443

# 3. 检查 Ingress 配置
kubectl get ingress -A | grep rrr

# 4. 测试 Traefik 路由
curl -H "Host: rrr.juanie.art" http://49.232.237.136:31611
```

**可能原因**:
- ✅ DNS 未生效（等待 TTL 时间）
- ✅ 云服务器防火墙未开放端口
- ✅ Ingress 配置错误
- ✅ Traefik 未正确路由

### 问题 2: 有的地方能访问，有的地方不能

**原因**: DNS 缓存不一致

**解决方法**:
```bash
# macOS/Linux 清除 DNS 缓存
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder

# Windows 清除 DNS 缓存
ipconfig /flushdns

# 或者等待 TTL 时间自动过期
```

### 问题 3: 修改了 DNS 但没生效

**原因**: 
1. TTL 未过期（旧记录还在缓存）
2. 配置错误

**解决方法**:
```bash
# 使用 Google DNS 测试（绕过本地缓存）
nslookup rrr.juanie.art 8.8.8.8

# 如果 Google DNS 能查到，说明配置正确，只是本地缓存问题
```

## 你的项目配置清单

### ✅ 推荐配置（一劳永逸）

```
记录 1:
类型: A
主机记录: *
记录值: 49.232.237.136
TTL: 600

记录 2:
类型: A
主机记录: @
记录值: 49.232.237.136
TTL: 600

记录 3:
类型: A
主机记录: www
记录值: 49.232.237.136
TTL: 600
```

**效果**:
- `juanie.art` ✅
- `www.juanie.art` ✅
- `rrr.juanie.art` ✅
- `777q.juanie.art` ✅
- `任意名字.juanie.art` ✅

### 配置后的访问方式

**开发环境**（使用 NodePort）:
```
http://rrr.juanie.art:31611
https://rrr.juanie.art:32427
```

**生产环境**（使用标准端口）:
```
http://rrr.juanie.art
https://rrr.juanie.art
```

## 进阶知识（可选）

### 1. DNS 传播

**全球 DNS 服务器同步需要时间**:
- 国内: 5-10 分钟
- 全球: 24-48 小时（极端情况）

**检查传播状态**: https://www.whatsmydns.net/

### 2. HTTPS 证书

配置域名后，cert-manager 会自动申请 Let's Encrypt 证书：

```bash
# 检查证书状态
kubectl get certificate -A

# 查看证书详情
kubectl describe certificate <证书名> -n <命名空间>
```

**证书申请流程**:
1. cert-manager 检测到新的 Ingress
2. 向 Let's Encrypt 发起申请
3. Let's Encrypt 验证域名所有权（HTTP-01 或 DNS-01）
4. 颁发证书（有效期 90 天）
5. cert-manager 自动续期

### 3. 本地测试（不配置 DNS）

**修改 hosts 文件**:

```bash
# macOS/Linux
sudo nano /etc/hosts

# Windows
# C:\Windows\System32\drivers\etc\hosts

# 添加
49.232.237.136 rrr.juanie.art
49.232.237.136 777q.juanie.art
```

**注意**: 只对你自己的电脑有效，别人无法访问

## 实用工具

### 命令行工具

```bash
# 查询 DNS 记录
nslookup rrr.juanie.art
dig rrr.juanie.art
host rrr.juanie.art

# 查询特定 DNS 服务器
nslookup rrr.juanie.art 8.8.8.8  # Google DNS
nslookup rrr.juanie.art 1.1.1.1  # Cloudflare DNS

# 查看完整 DNS 查询过程
dig +trace rrr.juanie.art
```

### 在线工具

- **DNS 传播检查**: https://www.whatsmydns.net/
- **DNS 查询**: https://dnschecker.org/
- **Ping 测试**: https://ping.pe/
- **端口检查**: https://www.yougetsignal.com/tools/open-ports/

## 总结：你需要做什么

### 立即行动（5 分钟）

1. **登录腾讯云 DNSPod**
2. **添加泛域名记录**:
   ```
   类型: A
   主机记录: *
   记录值: 49.232.237.136
   TTL: 600
   ```
3. **等待 5-10 分钟**
4. **测试访问**:
   ```bash
   curl -I http://rrr.juanie.art:31611
   ```

### 后续优化（可选）

1. **开放标准端口**（80, 443）
2. **配置主域名**（`@` 记录）
3. **配置 www**（`www` 记录）
4. **增加 TTL**（改为 3600 秒）

## 关键要点

1. **泛域名 `*` 是你的最佳选择** - 一次配置，所有项目自动可用
2. **TTL 600 秒是平衡点** - 既灵活又有缓存效果
3. **DNS 生效需要时间** - 耐心等待 5-10 分钟
4. **Traefik 基于域名路由** - 必须配置 DNS 或 Host header
5. **HTTPS 证书自动申请** - cert-manager 会处理一切

## 下一步

配置完 DNS 后，你的项目访问流程：

```
用户输入: http://rrr.juanie.art
    ↓
DNS 查询: rrr.juanie.art → 49.232.237.136
    ↓
连接服务器: 49.232.237.136:31611
    ↓
Traefik 检查 Host: rrr.juanie.art
    ↓
路由到对应的 Service
    ↓
转发到 Pod
    ↓
返回页面
```

现在去配置你的 DNS 吧！🚀
