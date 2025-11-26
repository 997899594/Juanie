# Kubernetes 资源创建时机问题

## 问题：在 Namespace 创建前尝试创建 Secret

### 症状

```
HTTP request failed
```

创建 Secret 时失败，没有详细错误信息。

### 根本原因

代码尝试在 Namespace 还不存在时就创建 Secret，导致操作失败。

**错误的执行顺序：**
```
1. GitAuthService.setupProjectAuth()
   └─ createK8sSecrets() ← 尝试创建 Secret
2. FluxResourcesService.setupProjectGitOps()
   └─ createNamespace() ← Namespace 才被创建
```

### 解决方案

#### 方案 1: 延迟 Secret 创建（推荐）

在 GitAuthService 中添加 `skipK8sSecrets` 参数：

```typescript
// GitAuthService
async setupProjectAuth(data: {
  // ... 其他参数
  skipK8sSecrets?: boolean  // 是否跳过 K8s Secret 创建
}): Promise<{ success: boolean; credentialId: string }> {
  // 创建 Git 凭证（GitHub Deploy Key / GitLab Token）
  const credential = await this.createCredential(data)
  
  // 只在需要时创建 K8s Secret
  if (!data.skipK8sSecrets) {
    await this.createK8sSecrets(projectId, credential)
  }
  
  return { success: true, credentialId: credential.id }
}
```

调用时：

```typescript
// GitOpsEventHandlerService
// 1. 创建凭证（但不创建 K8s Secret）
const authResult = await this.gitAuth.setupProjectAuth({
  projectId,
  userId,
  skipK8sSecrets: true,  // 先不创建 Secret
})

// 2. 获取凭证
const credential = await this.gitAuth.getProjectCredential(projectId)

// 3. 创建 GitOps 资源（包括 Namespace 和 Secret）
await this.fluxResources.setupProjectGitOps({
  projectId,
  credential,  // 传递凭证对象
  environments,
})
```

在 FluxResourcesService 中：

```typescript
async setupProjectGitOps(data: {
  projectId: string
  credential: GitCredential  // 接收凭证对象
  environments: Array<...>
}) {
  for (const environment of environments) {
    const namespace = `project-${projectId}-${environment.type}`
    
    // 1. 先创建 Namespace
    await this.k3s.createNamespace(namespace)
    
    // 2. 再创建 Secret（使用传入的 credential）
    await this.k3s.createSecret(
      namespace,
      secretName,
      {
        'ssh-privatekey': credential.token,
        identity: credential.token,
        known_hosts: knownHosts,
      },
      'kubernetes.io/ssh-auth',
    )
    
    // 3. 创建其他资源...
  }
}
```

#### 方案 2: 确保 Namespace 存在

在创建 Secret 前检查 Namespace：

```typescript
async createK8sSecrets(projectId: string, credential: GitCredential) {
  const environments = await this.getEnvironments(projectId)
  
  for (const environment of environments) {
    const namespace = `project-${projectId}-${environment.type}`
    
    // 确保 Namespace 存在
    try {
      await this.k3s.getNamespace(namespace)
    } catch (error) {
      // Namespace 不存在，先创建
      await this.k3s.createNamespace(namespace)
    }
    
    // 创建 Secret
    await this.k3s.createSecret(...)
  }
}
```

### 正确的执行顺序

```
GitOpsEventHandlerService.handleSetupRequest()
  ↓
1. GitAuthService.setupProjectAuth(skipK8sSecrets: true)
   ├─ 创建 GitHub Deploy Key / GitLab Token
   └─ 存储到数据库
  ↓
2. 获取凭证对象
  ↓
3. FluxResourcesService.setupProjectGitOps(credential)
   ├─ 创建 Namespace
   ├─ 创建 Secret（使用凭证）
   ├─ 创建 GitRepository
   └─ 创建 Kustomization
```

### 为什么这样设计？

**职责分离：**
- `GitAuthService`：负责创建 Git 凭证（Deploy Key / Token）
- `FluxResourcesService`：负责创建 K8s 资源（Namespace、Secret、GitRepository）

**优点：**
1. 清晰的职责划分
2. 避免循环依赖
3. 更容易测试和维护

### 预防措施

#### 1. 使用依赖检查

```typescript
async createSecret(namespace: string, name: string, data: any) {
  // 检查 Namespace 是否存在
  const namespaceExists = await this.namespaceExists(namespace)
  if (!namespaceExists) {
    throw new Error(`Namespace ${namespace} does not exist`)
  }
  
  // 创建 Secret
  await this.k8sApi.createNamespacedSecret(namespace, secret)
}
```

#### 2. 使用事务性操作

```typescript
async setupProject(projectId: string) {
  try {
    // 1. 创建所有 Namespace
    await this.createNamespaces(projectId)
    
    // 2. 创建所有 Secret
    await this.createSecrets(projectId)
    
    // 3. 创建其他资源
    await this.createResources(projectId)
  } catch (error) {
    // 回滚操作
    await this.cleanup(projectId)
    throw error
  }
}
```

#### 3. 使用状态机

```typescript
enum SetupState {
  CREATING_NAMESPACES,
  CREATING_SECRETS,
  CREATING_RESOURCES,
  COMPLETED,
}

// 确保按顺序执行
```

### 相关问题

- [Flux SSH 认证问题](../flux/ssh-authentication.md)
- [代码冗余问题](../architecture/code-redundancy.md)

### 调试技巧

#### 检查 Namespace 是否存在

```bash
kubectl get namespace project-xxx-development
```

#### 查看 Secret 创建失败的详细错误

```bash
# 查看 API Gateway 日志
kubectl logs -n default deployment/api-gateway --tail=100

# 或者在本地开发环境
bun run dev
# 查看控制台输出
```

#### 使用 kubectl 手动测试

```bash
# 尝试在不存在的 namespace 中创建 Secret
kubectl create secret generic test-secret \
  --from-literal=key=value \
  -n non-existent-namespace

# 应该看到错误：
# Error from server (NotFound): namespaces "non-existent-namespace" not found
```

### 最佳实践

1. **先创建容器，再创建内容**
   - Namespace → Secret
   - Namespace → ConfigMap
   - Namespace → Pod

2. **使用幂等操作**
   ```typescript
   // 如果已存在，不报错
   try {
     await createNamespace(name)
   } catch (error) {
     if (error.statusCode !== 409) { // 409 = Already Exists
       throw error
     }
   }
   ```

3. **明确依赖关系**
   ```typescript
   // 在函数签名中体现依赖
   async createSecret(
     namespace: Namespace,  // 要求传入 Namespace 对象
     secretData: SecretData
   )
   ```

4. **使用 Kubernetes Operator 模式**
   - 声明期望状态
   - 让控制器处理创建顺序

## 总结

资源创建时机问题的关键：

1. **识别依赖**：哪些资源依赖其他资源
2. **正确排序**：先创建被依赖的资源
3. **职责分离**：不同服务负责不同层次的资源
4. **错误处理**：提供清晰的错误信息

记住：Namespace 是容器，必须先创建！
