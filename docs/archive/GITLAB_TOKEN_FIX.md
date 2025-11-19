# GitLab 令牌问题修复指南

## 问题
创建项目时提示：**"Git 访问令牌无效。请重新连接您的账户或检查手动输入的令牌是否正确。"**

## 根本原因
GitLab 访问令牌无效、已过期或权限不足。

---

## 快速修复步骤

### 方案 1: 重新生成 GitLab 访问令牌（推荐）

#### 步骤 1: 生成新令牌
1. 访问 GitLab 个人访问令牌页面：
   - GitLab.com: https://gitlab.com/-/profile/personal_access_tokens
   - 自托管 GitLab: `https://your-gitlab-domain/-/profile/personal_access_tokens`

2. 点击 **"Add new token"** 按钮

3. 填写令牌信息：
   - **Token name**: `juanie-platform`（或任何你喜欢的名称）
   - **Expiration date**: 选择一个未来的日期（建议至少 90 天）

4. **重要：勾选以下权限**
   ```
   ✅ api                    (完整的 API 访问权限)
   ✅ read_api               (读取 API 权限)
   ✅ read_repository        (读取仓库权限)
   ✅ write_repository       (写入仓库权限)
   ```

5. 点击 **"Create personal access token"**

6. **立即复制生成的令牌**（离开页面后将无法再次查看）

#### 步骤 2: 测试令牌
```bash
# 运行测试脚本（替换 YOUR_TOKEN）
./scripts/test-gitlab-token.sh YOUR_TOKEN

# 如果使用自托管 GitLab
./scripts/test-gitlab-token.sh YOUR_TOKEN https://your-gitlab-domain
```

如果测试通过，你会看到：
```
✅ 令牌测试通过！
```

#### 步骤 3: 在应用中使用新令牌

**选项 A: 手动输入令牌**
1. 在创建项目页面
2. 仓库配置部分
3. 取消勾选"使用 OAuth 令牌"
4. 在"访问令牌"字段中粘贴新令牌
5. 继续创建项目

**选项 B: 更新 OAuth 连接**
1. 进入"设置 > 账户连接"
2. 如果已连接 GitLab，先断开连接
3. 重新连接 GitLab 账户
4. 在创建项目时选择"使用 OAuth 令牌"

---

### 方案 2: 使用 GitHub 代替 GitLab

如果 GitLab 令牌问题持续存在，可以暂时使用 GitHub：

#### 步骤 1: 生成 GitHub 令牌
1. 访问：https://github.com/settings/tokens
2. 点击 **"Generate new token (classic)"**
3. 勾选 **`repo`** 权限（所有子权限）
4. 生成并复制令牌

#### 步骤 2: 在应用中使用
1. 创建项目时选择 **GitHub** 作为 Git Provider
2. 输入 GitHub 令牌
3. 继续创建项目

---

## 常见错误及解决方案

### 错误 1: "401 Unauthorized"
**原因：** 令牌无效或已过期

**解决方案：**
- 重新生成新令牌
- 确保令牌没有过期
- 检查令牌是否正确复制（没有多余的空格）

### 错误 2: "403 Forbidden"
**原因：** 令牌权限不足

**解决方案：**
- 确保勾选了 `api` 权限
- 重新生成令牌并勾选所有必需权限

### 错误 3: "422 Unprocessable Entity"
**原因：** 仓库名称已存在或其他验证错误

**解决方案：**
- 使用不同的仓库名称
- 检查 GitLab 账户中是否已有同名仓库

---

## 验证清单

在创建项目前，请确认：

- [ ] GitLab 令牌已生成且未过期
- [ ] 令牌包含 `api` 权限
- [ ] 令牌已正确复制（无多余空格）
- [ ] 使用测试脚本验证令牌有效
- [ ] 仓库名称唯一（不与现有仓库冲突）
- [ ] 网络连接正常，可以访问 GitLab API

---

## 调试命令

### 测试 GitLab API 连接
```bash
# 测试用户信息（替换 YOUR_TOKEN）
curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://gitlab.com/api/v4/user

# 测试创建仓库（替换 YOUR_TOKEN）
curl -X POST \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"name":"test-repo","visibility":"private","initialize_with_readme":true}' \
     https://gitlab.com/api/v4/projects
```

### 查看应用日志
```bash
# 查看后端日志
docker logs -f juanie-api-gateway

# 或本地开发
npm run dev
```

---

## 需要帮助？

如果问题仍未解决，请提供：

1. **令牌测试脚本的输出**
   ```bash
   ./scripts/test-gitlab-token.sh YOUR_TOKEN > token-test-result.txt 2>&1
   ```

2. **浏览器控制台错误**
   - 打开开发者工具（F12）
   - 查看 Console 和 Network 标签
   - 截图或复制错误信息

3. **后端日志**
   - 从创建项目开始到失败的完整日志
   - 特别注意包含 "GitLab" 或 "error" 的行

4. **环境信息**
   - 使用的是 GitLab.com 还是自托管 GitLab？
   - GitLab 版本（如果是自托管）
   - 网络环境（是否使用代理）

---

## 相关文档

- [GitLab Personal Access Tokens 文档](https://docs.gitlab.com/ee/user/profile/personal_access_tokens.html)
- [GitLab API 文档](https://docs.gitlab.com/ee/api/)
- [项目创建流程文档](.kiro/specs/project-creation-flow-review/design.md)
