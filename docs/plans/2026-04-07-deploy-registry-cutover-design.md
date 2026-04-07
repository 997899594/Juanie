# Deploy Registry Cutover Design

## Goal

将 Juanie 的发布链路从 `GHCR pull` 收敛为 `deploy registry pull`。

- CI 负责把最终镜像推到部署仓库
- Juanie 平台只消费部署仓库镜像
- migration / deployment / preview 统一使用同一个镜像来源

## Decision

采用两层职责分离：

1. 构建与发布仓库由 CI 决定，通过 `DEPLOY_REGISTRY` 统一配置。
2. 平台运行时只识别 `DEPLOY_REGISTRY` 和 `DEPLOY_REGISTRY_PULL_SECRET_NAME`，不再从 GitHub OAuth 推导镜像拉取权限。

这次不把 registry 内嵌到 Juanie 应用 chart。
原因很直接：

- deploy registry 属于基础设施，不属于平台业务工作负载
- 这样可以避免平台自举时的鸡生蛋问题
- 平台 chart 和基础设施职责更清晰

## Runtime Changes

- 新增 `src/lib/deploy-registry.ts`
- `k8s.ts` 改为 registry-agnostic 的 pull secret 管理
- migration runner 只在镜像属于 deploy registry 时注入 pull secret
- deployment executor 先读 release image，其次读 `project.configJson.imageName`
- project init 将 `configJson.imageName` 固定写成 deploy registry repository

## Infra Changes

新增 `deploy/k8s/infrastructure/deploy-registry/`：

- `deployment.yaml`
- `service.yaml`
- `pvc.yaml`
- `httproute.yaml`

新增 `deploy/k8s/scripts/install-deploy-registry.sh`：

- 创建 registry htpasswd secret
- 创建 pull secret
- patch `juanie-secret`
- patch `juanie-config`
- 部署 registry workload
- 重启 juanie web/worker 使配置生效

## Cutover Steps

1. 在服务器执行 `deploy/k8s/scripts/install-deploy-registry.sh`
2. 在 Juanie / nexusnote 仓库配置：
   - `vars.DEPLOY_REGISTRY=registry.juanie.art`
   - `vars.DEPLOY_REGISTRY_PULL_SECRET_NAME=deploy-registry-pull-secret`
   - `secrets.DEPLOY_REGISTRY_USERNAME`
   - `secrets.DEPLOY_REGISTRY_PASSWORD`
3. 触发 Juanie 自部署，确认平台本身已从新 registry 发布
4. 触发 nexusnote release，确认 migration 和 deployment 都指向 `registry.juanie.art/...`

## Non-Goals

- 不保留 GHCR 专属 OAuth 推导逻辑
- 不做多 registry 路由决策
- 不做额外镜像同步层
