# Sealed Secrets 使用指南

## 安装 Sealed Secrets Controller

```bash
kubectl apply -f https://github.com/bitnami-labs/sealed-secrets/releases/download/v0.24.0/controller.yaml
```

## 创建 Sealed Secret

### 1. 安装 kubeseal

```bash
# macOS
brew install kubeseal

# Linux
wget https://github.com/bitnami-labs/sealed-secrets/releases/download/v0.24.0/kubeseal-linux-amd64 -O kubeseal
chmod +x kubeseal
sudo mv kubeseal /usr/local/bin
```

### 2. 创建原始 Secret

```yaml
# juanie-secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: juanie-secret
  namespace: juanie
type: Opaque
stringData:
  DATABASE_URL: "postgresql://..."
  NEXTAUTH_SECRET: "..."
  GITHUB_CLIENT_ID: "..."
  GITHUB_CLIENT_SECRET: "..."
```

### 3. 封装 Secret

```bash
# 从文件创建
kubeseal -f juanie-secret.yaml -w juanie-sealed-secret.yaml

# 或者从 stdin 创建
cat juanie-secret.yaml | kubeseal -w juanie-sealed-secret.yaml
```

### 4. 提交到 Git

```bash
git add k8s/sealed-secrets/juanie-sealed-secret.yaml
git commit -m "Add sealed secrets"
git push
```

### 5. 部署

```bash
kubectl apply -f k8s/sealed-secrets/juanie-sealed-secret.yaml
```

## 优势

- ✅ 密钥可以安全地提交到 Git
- ✅ 只有集群可以解密
- ✅ 自动同步 Secret
- ✅ 支持 Secret 轮换

## 示例 Sealed Secret

```yaml
apiVersion: bitnami.com/v1alpha1
kind: SealedSecret
metadata:
  name: juanie-secret
  namespace: juanie
spec:
  encryptedData:
    DATABASE_URL: AgBy3i4OJSWK+PiTySY...
    NEXTAUTH_SECRET: AgBy3i4OJSWK+PiTySY...
```

## 参考文档

- https://github.com/bitnami-labs/sealed-secrets
- https://sealed-secrets.netlify.app/
