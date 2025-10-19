# GitLab 私服配置

这个目录包含了所有 GitLab 私服相关的配置文件和脚本。

## 目录结构

```
gitlab/
├── README.md                    # 本文档
├── docker-compose.yml          # GitLab Docker Compose 配置
├── .env                        # 环境变量配置模板
├── GITLAB_PRIVATE_SETUP.md     # 详细的 GitLab 私服配置指南
└── scripts/
    └── gitlab-setup.sh         # GitLab 管理脚本
```

## 快速开始

1. **复制环境变量文件**
   ```bash
   cp gitlab/.env gitlab/.env.local
   ```

2. **编辑环境变量**
   ```bash
   # 编辑 gitlab/.env.local 文件，设置你的配置
   nano gitlab/.env.local
   ```

3. **启动 GitLab 私服**
   ```bash
   ./gitlab/scripts/gitlab-setup.sh start
   ```

4. **查看状态**
   ```bash
   ./gitlab/scripts/gitlab-setup.sh status
   ```

## 主要配置文件

- **docker-compose.yml**: GitLab 容器配置
- **.env**: 环境变量模板（复制为 .env.local 使用）
- **GITLAB_PRIVATE_SETUP.md**: 详细的配置指南和 OAuth 设置

## 管理命令

使用 `gitlab-setup.sh` 脚本管理 GitLab 私服：

```bash
# 启动服务
./gitlab/scripts/gitlab-setup.sh start

# 停止服务
./gitlab/scripts/gitlab-setup.sh stop

# 重启服务
./gitlab/scripts/gitlab-setup.sh restart

# 查看日志
./gitlab/scripts/gitlab-setup.sh logs

# 查看状态
./gitlab/scripts/gitlab-setup.sh status

# 备份数据
./gitlab/scripts/gitlab-setup.sh backup

# 恢复数据
./gitlab/scripts/gitlab-setup.sh restore
```

## 注意事项

- 所有 GitLab 相关的数据和配置都在这个目录中
- `.env.local` 文件包含敏感信息，已被 `.gitignore` 忽略
- 数据目录 `data/`、日志目录 `logs/` 等也被忽略，不会提交到版本控制