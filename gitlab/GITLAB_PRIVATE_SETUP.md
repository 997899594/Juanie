# GitLab 私服 OAuth 配置指南

本指南将帮助您配置 GitLab 私服的 OAuth 登录功能。

## 1. 在 GitLab 私服中创建 OAuth 应用程序

### 步骤 1: 登录 GitLab 私服管理界面

1. 打开您的 GitLab 私服地址（例如：`https://gitlab.your-company.com` 或 `http://192.168.1.100:8080`）
2. 使用管理员账户登录

### 步骤 2: 创建 OAuth 应用程序

1. 进入 **Admin Area**（管理区域）
   - 点击右上角的扳手图标 🔧
   - 或访问 `{your-gitlab-url}/admin`

2. 导航到 **Applications**（应用程序）
   - 在左侧菜单中找到 **Applications**
   - 或访问 `{your-gitlab-url}/admin/applications`

3. 点击 **New Application**（新建应用程序）

4. 填写应用程序信息：
   - **Name**: `Juanie App`（或您喜欢的名称）
   - **Redirect URI**: `http://localhost:3000/auth/gitlab/callback`
     - 如果您的后端运行在不同端口，请相应调整
     - 生产环境请使用 HTTPS 地址
   - **Scopes**: 选择 `read_user`
     - 这允许应用读取用户基本信息

5. 点击 **Save application**（保存应用程序）

### 步骤 3: 获取 OAuth 凭据

保存后，您将看到：
- **Application ID**（应用程序 ID）
- **Secret**（密钥）

**重要**: 请妥善保存这些凭据，特别是 Secret，它只会显示一次。

## 2. 配置环境变量

在您的项目中创建或编辑 `.env` 文件：

```bash
# GitLab 私服配置
GITLAB_BASE_URL="https://gitlab.your-company.com"  # 替换为您的 GitLab 私服地址
GITLAB_CLIENT_ID="your_application_id_here"        # 从步骤 3 获取的 Application ID
GITLAB_CLIENT_SECRET="your_secret_here"            # 从步骤 3 获取的 Secret
GITLAB_REDIRECT_URI="http://localhost:3000/auth/gitlab/callback"
```

### 环境变量说明

- `GITLAB_BASE_URL`: GitLab 私服的完整 URL
  - 示例: `https://gitlab.company.com`
  - 示例: `http://192.168.1.100:8080`
  - 不要在末尾添加斜杠 `/`

- `GITLAB_CLIENT_ID`: OAuth 应用程序的 Application ID

- `GITLAB_CLIENT_SECRET`: OAuth 应用程序的 Secret

- `GITLAB_REDIRECT_URI`: OAuth 回调地址
  - 必须与 GitLab 中配置的 Redirect URI 完全一致
  - 开发环境通常是 `http://localhost:3000/auth/gitlab/callback`
  - 生产环境应使用 HTTPS

## 3. 网络配置注意事项

### 防火墙设置

确保以下端口可以访问：
- GitLab 私服端口（通常是 80/443 或自定义端口）
- 您的应用后端端口（默认 3000）

### SSL/TLS 配置

如果您的 GitLab 私服使用自签名证书：

1. **开发环境**: 可以设置环境变量跳过证书验证
   ```bash
   NODE_TLS_REJECT_UNAUTHORIZED=0
   ```

2. **生产环境**: 建议配置正确的 SSL 证书或将证书添加到信任列表

## 4. 测试配置

### 步骤 1: 重启应用

配置完成后，重启您的后端服务：

```bash
cd apps/api-new
npm run dev
# 或
nest start --watch
```

### 步骤 2: 测试 OAuth 流程

1. 访问前端应用
2. 点击 "GitLab 登录" 按钮
3. 应该会重定向到您的 GitLab 私服登录页面
4. 登录后应该会重定向回您的应用

### 步骤 3: 检查日志

如果遇到问题，检查：
- 后端控制台日志
- 浏览器开发者工具的网络面板
- GitLab 私服的日志（如果有访问权限）

## 5. 常见问题排查

### 问题 1: "Failed to fetch GitLab user"

**可能原因**:
- `GITLAB_BASE_URL` 配置错误
- 网络连接问题
- SSL 证书问题

**解决方案**:
- 检查 `GITLAB_BASE_URL` 是否正确
- 确保应用可以访问 GitLab 私服
- 如果是 SSL 问题，参考上面的 SSL/TLS 配置

### 问题 2: "Invalid redirect URI"

**可能原因**:
- GitLab 中配置的 Redirect URI 与环境变量不匹配

**解决方案**:
- 确保 `GITLAB_REDIRECT_URI` 与 GitLab 应用程序中的设置完全一致
- 注意协议（http/https）和端口号

### 问题 3: "GitLab OAuth not configured"

**可能原因**:
- 环境变量未正确加载
- `GITLAB_CLIENT_ID` 或 `GITLAB_CLIENT_SECRET` 为空

**解决方案**:
- 检查 `.env` 文件是否在正确位置
- 确保环境变量名称正确
- 重启应用以重新加载环境变量

## 6. 安全建议

1. **生产环境**:
   - 使用 HTTPS
   - 定期轮换 OAuth 密钥
   - 限制 OAuth 应用程序的权限范围

2. **开发环境**:
   - 不要将 `.env` 文件提交到版本控制
   - 使用不同的 OAuth 应用程序用于开发和生产

3. **网络安全**:
   - 配置防火墙规则
   - 使用 VPN 或内网访问私服

## 7. 支持的 GitLab 版本

此配置支持：
- GitLab CE (Community Edition) 13.0+
- GitLab EE (Enterprise Edition) 13.0+
- 自托管 GitLab 实例

如果您使用的是较旧版本的 GitLab，API 端点可能有所不同，请参考相应版本的文档。