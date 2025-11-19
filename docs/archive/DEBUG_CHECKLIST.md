# 仓库创建问题调试清单

## 立即检查的事项

### ✅ 1. 检查浏览器控制台错误
打开浏览器开发者工具（F12），查看：
- **Console 标签**：是否有 JavaScript 错误？
- **Network 标签**：找到 `createWithTemplate` 请求
  - 查看请求的 Payload（发送的数据）
  - 查看响应的 Response（返回的错误）
  - 记录 HTTP 状态码

### ✅ 2. 检查后端日志
查看后端控制台输出，寻找以下关键日志：

```
Creating project: ...
Handling repository for project ...
Creating github/gitlab repository: ...
```

如果看到错误，记录完整的错误堆栈。

### ✅ 3. 验证访问令牌

#### 如果使用手动输入的令牌：
```bash
# 测试 GitHub 令牌
curl -H "Authorization: Bearer YOUR_TOKEN" https://api.github.com/user

# 测试 GitLab 令牌
curl -H "Authorization: Bearer YOUR_TOKEN" https://gitlab.com/api/v4/user
```

#### 如果使用 OAuth：
1. 进入"设置 > 账户连接"
2. 检查是否已连接 GitHub/GitLab 账户
3. 尝试断开并重新连接

### ✅ 4. 检查仓库名称
- 确保仓库名称不包含特殊字符
- 确保仓库名称在你的 GitHub/GitLab 账户中不存在
- 尝试使用一个完全唯一的名称（如：`test-repo-20241114-001`）

### ✅ 5. 检查数据库
```sql
-- 检查最近创建的项目
SELECT id, name, status, initialization_status 
FROM projects 
ORDER BY created_at DESC 
LIMIT 5;

-- 检查是否有仓库记录
SELECT * FROM repositories 
WHERE project_id = 'YOUR_PROJECT_ID';
```

## 常见问题快速修复

### 问题 1: "访问令牌无效或权限不足"
**解决方案：**
1. 重新生成 GitHub Personal Access Token
   - 访问：https://github.com/settings/tokens
   - 点击 "Generate new token (classic)"
   - 勾选 `repo` 权限（所有子权限）
   - 生成并复制新令牌
2. 在创建项目时使用新令牌

### 问题 2: "仓库名称已存在"
**解决方案：**
1. 访问你的 GitHub/GitLab 账户
2. 检查是否有同名仓库
3. 删除或重命名现有仓库
4. 或者在创建项目时使用不同的名称

### 问题 3: "未找到 OAuth 连接"
**解决方案：**
1. 不要选择"使用 OAuth 令牌"
2. 改为手动输入访问令牌
3. 或者先去"设置 > 账户连接"连接 OAuth 账户

### 问题 4: 项目创建成功但没有仓库
**可能原因：**
- 仓库创建步骤失败但项目已创建
- 初始化流程被中断

**解决方案：**
1. 查看项目详情页的初始化状态
2. 手动连接仓库：
   - 进入项目详情页
   - 点击"连接仓库"
   - 选择"关联现有仓库"或"创建新仓库"

## 详细调试步骤

### 步骤 1: 收集信息
在浏览器中创建项目时：
1. 打开开发者工具（F12）
2. 切换到 Network 标签
3. 勾选 "Preserve log"
4. 尝试创建项目
5. 找到失败的请求，记录：
   - 请求 URL
   - 请求方法
   - 请求 Payload
   - 响应状态码
   - 响应内容

### 步骤 2: 测试 API 直接调用
使用以下命令测试 GitHub API：

```bash
# 替换 YOUR_TOKEN 为你的 GitHub token
TOKEN="YOUR_TOKEN"

# 测试用户信息
curl -H "Authorization: Bearer $TOKEN" \
     -H "Accept: application/vnd.github.v3+json" \
     https://api.github.com/user

# 测试创建仓库
curl -X POST \
     -H "Authorization: Bearer $TOKEN" \
     -H "Accept: application/vnd.github.v3+json" \
     -H "Content-Type: application/json" \
     -d '{"name":"test-repo-debug","private":true,"auto_init":true}' \
     https://api.github.com/user/repos
```

如果这些命令失败，说明问题在于：
- 令牌无效
- 令牌权限不足
- 网络连接问题

### 步骤 3: 检查服务依赖
确认以下服务都已正确启动：
```bash
# 检查 API Gateway
curl http://localhost:3000/health

# 检查数据库连接
# 在后端日志中查找 "Database connected" 或类似信息
```

### 步骤 4: 启用调试模式
在 `.env` 文件中添加：
```env
LOG_LEVEL=debug
NODE_ENV=development
```

重启应用，再次尝试创建项目，查看详细日志。

## 如果问题仍未解决

请提供以下信息：

1. **浏览器 Network 请求详情**
   - 截图或复制 Request Payload
   - 截图或复制 Response

2. **后端日志**
   - 从开始创建项目到失败的完整日志
   - 特别注意包含 "error", "failed", "exception" 的行

3. **环境信息**
   ```bash
   node --version
   npm --version
   # 数据库版本
   # 操作系统
   ```

4. **配置信息**
   - 使用的是 GitHub 还是 GitLab？
   - 使用 OAuth 还是手动令牌？
   - 创建新仓库还是关联现有仓库？

5. **测试结果**
   - 上面的 curl 命令是否成功？
   - 数据库查询结果如何？

## 临时解决方案

如果急需创建项目，可以：

1. **先创建项目（不配置仓库）**
   - 在创建项目时跳过仓库配置
   - 项目创建成功后
   - 进入项目详情页手动连接仓库

2. **手动创建仓库**
   - 在 GitHub/GitLab 上手动创建仓库
   - 在项目中选择"关联现有仓库"
   - 输入仓库 URL

3. **使用模板但不创建仓库**
   - 选择模板
   - 不配置仓库
   - 后续手动添加
