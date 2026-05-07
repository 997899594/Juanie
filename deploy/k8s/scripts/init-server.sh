#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
INFRA_DIR="${ROOT_DIR}/deploy/k8s/infrastructure"

PLATFORM_NAMESPACE="${PLATFORM_NAMESPACE:-juanie}"
TLS_CERTIFICATE_NAME="${TLS_CERTIFICATE_NAME:-${PLATFORM_NAMESPACE}-wildcard-tls}"
PLATFORM_DOMAIN="${PLATFORM_DOMAIN:-juanie.art}"
LETSENCRYPT_EMAIL="${LETSENCRYPT_EMAIL:-admin@juanie.art}"
CERT_MANAGER_NAMESPACE="${CERT_MANAGER_NAMESPACE:-cert-manager}"
ARGOCD_NAMESPACE="${ARGOCD_NAMESPACE:-argocd}"
ARGOCD_PROJECT_NAME="${ARGOCD_PROJECT_NAME:-juanie}"
ARGO_ROLLOUTS_NAMESPACE="${ARGO_ROLLOUTS_NAMESPACE:-argo-rollouts}"
CNPG_NAMESPACE="${CNPG_NAMESPACE:-cnpg-system}"
EXTERNAL_SECRETS_NAMESPACE="${EXTERNAL_SECRETS_NAMESPACE:-external-secrets}"
GATEWAY_CLASS_NAME="${GATEWAY_CLASS_NAME:-cilium}"
GATEWAY_LOADBALANCER_IP="${GATEWAY_LOADBALANCER_IP:-10.2.0.15}"
ARGOCD_REPO_SECRET_NAME="${ARGOCD_REPO_SECRET_NAME:-juanie-preview-source}"

CERT_MANAGER_CHART_VERSION="${CERT_MANAGER_CHART_VERSION:-v1.20.2}"
ARGOCD_CHART_VERSION="${ARGOCD_CHART_VERSION:-9.5.2}"
ARGO_ROLLOUTS_CHART_VERSION="${ARGO_ROLLOUTS_CHART_VERSION:-2.40.9}"
CNPG_CHART_VERSION="${CNPG_CHART_VERSION:-0.28.0}"
EXTERNAL_SECRETS_CHART_VERSION="${EXTERNAL_SECRETS_CHART_VERSION:-2.3.0}"
DNSPOD_WEBHOOK_CHART_VERSION="${DNSPOD_WEBHOOK_CHART_VERSION:-1.5.2}"

CERT_MANAGER_CHART_REF="${CERT_MANAGER_CHART_REF:-jetstack/cert-manager}"
ARGOCD_CHART_REF="${ARGOCD_CHART_REF:-argo/argo-cd}"
ARGO_ROLLOUTS_CHART_REF="${ARGO_ROLLOUTS_CHART_REF:-argo/argo-rollouts}"
CNPG_CHART_REF="${CNPG_CHART_REF:-cnpg/cloudnative-pg}"
EXTERNAL_SECRETS_CHART_REF="${EXTERNAL_SECRETS_CHART_REF:-external-secrets/external-secrets}"
DNSPOD_WEBHOOK_CHART_REF="${DNSPOD_WEBHOOK_CHART_REF:-cert-manager-webhook-dnspod/cert-manager-webhook-dnspod}"

JUANIE_PREVIEW_APPLICATIONSET_REPO_URL="${JUANIE_PREVIEW_APPLICATIONSET_REPO_URL:-}"
ARGOCD_REPO_URL="${ARGOCD_REPO_URL:-${JUANIE_PREVIEW_APPLICATIONSET_REPO_URL}}"
ARGOCD_REPO_USERNAME="${ARGOCD_REPO_USERNAME:-}"
ARGOCD_REPO_PASSWORD="${ARGOCD_REPO_PASSWORD:-}"
ARGOCD_REPO_SSH_PRIVATE_KEY="${ARGOCD_REPO_SSH_PRIVATE_KEY:-}"
ARGOCD_REPO_INSECURE="${ARGOCD_REPO_INSECURE:-false}"

DNSPOD_SECRET_ID="${DNSPOD_SECRET_ID:-}"
DNSPOD_SECRET_KEY="${DNSPOD_SECRET_KEY:-}"

INTERACTIVE="${INTERACTIVE:-auto}"
SKIP_CONFIRM="${SKIP_CONFIRM:-false}"
SKIP_CERT_WAIT="${SKIP_CERT_WAIT:-false}"

require_command() {
  local command_name="$1"
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "缺少必要命令: ${command_name}" >&2
    exit 1
  fi
}

log_section() {
  echo
  echo "=== $1 ==="
}

log_info() {
  echo "[INFO] $1"
}

log_warn() {
  echo "[WARN] $1" >&2
}

log_error() {
  echo "[ERROR] $1" >&2
}

resolve_repo_root() {
  if [[ ! -d "${INFRA_DIR}" ]]; then
    log_error "未找到基础设施目录: ${INFRA_DIR}"
    exit 1
  fi
}

is_interactive() {
  if [[ "${INTERACTIVE}" == "true" ]]; then
    return 0
  fi

  if [[ "${INTERACTIVE}" == "false" ]]; then
    return 1
  fi

  [[ -t 0 ]]
}

confirm_continue() {
  if [[ "${SKIP_CONFIRM}" == "true" ]]; then
    return 0
  fi

  if ! is_interactive; then
    return 0
  fi

  read -r -p "确认继续在当前集群执行 Juanie bootstrap? (y/N) " answer
  [[ "${answer}" =~ ^[Yy]$ ]]
}

ensure_preview_repo_defaults() {
  if [[ -z "${JUANIE_PREVIEW_APPLICATIONSET_REPO_URL}" ]] && command -v git >/dev/null 2>&1; then
    JUANIE_PREVIEW_APPLICATIONSET_REPO_URL="$(git -C "${ROOT_DIR}" remote get-url origin 2>/dev/null || true)"
  fi

  if [[ -z "${ARGOCD_REPO_URL}" ]]; then
    ARGOCD_REPO_URL="${JUANIE_PREVIEW_APPLICATIONSET_REPO_URL}"
  fi
}

helm_repo_add() {
  local name="$1"
  local url="$2"
  helm repo add "${name}" "${url}" >/dev/null 2>&1 || helm repo add "${name}" "${url}" --force-update >/dev/null
}

is_local_chart_ref() {
  local chart_ref="$1"
  [[ "${chart_ref}" == /* || "${chart_ref}" == ./* || "${chart_ref}" == ../* || "${chart_ref}" == *.tgz ]]
}

helm_upgrade_install() {
  local release_name="$1"
  local chart_ref="$2"
  local namespace="$3"
  local values_file="$4"
  local version="$5"
  shift 5
  local extra_args=("$@")
  local helm_args=()

  if [[ -n "${values_file}" ]]; then
    helm_args+=(-f "${values_file}")
  fi

  if [[ -n "${version}" ]] && ! is_local_chart_ref "${chart_ref}"; then
    helm_args+=(--version "${version}")
  fi

  helm upgrade --install "${release_name}" "${chart_ref}" \
    --namespace "${namespace}" \
    --create-namespace \
    --wait \
    --timeout 15m \
    "${helm_args[@]}" \
    "${extra_args[@]}"
}

wait_for_deployment() {
  local namespace="$1"
  local deployment="$2"
  kubectl rollout status "deployment/${deployment}" -n "${namespace}" --timeout=10m
}

wait_for_statefulset() {
  local namespace="$1"
  local statefulset="$2"
  kubectl rollout status "statefulset/${statefulset}" -n "${namespace}" --timeout=10m
}

wait_for_labeled_deployments() {
  local namespace="$1"
  local selector="$2"
  mapfile -t deployments < <(
    kubectl get deployments -n "${namespace}" -l "${selector}" -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}'
  )

  if [[ "${#deployments[@]}" -eq 0 ]]; then
    log_warn "命名空间 ${namespace} 下没有匹配 ${selector} 的 Deployment。"
    return
  fi

  local deployment
  for deployment in "${deployments[@]}"; do
    wait_for_deployment "${namespace}" "${deployment}"
  done
}

wait_for_labeled_statefulsets() {
  local namespace="$1"
  local selector="$2"
  mapfile -t statefulsets < <(
    kubectl get statefulsets -n "${namespace}" -l "${selector}" -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}'
  )

  if [[ "${#statefulsets[@]}" -eq 0 ]]; then
    return
  fi

  local statefulset
  for statefulset in "${statefulsets[@]}"; do
    wait_for_statefulset "${namespace}" "${statefulset}"
  done
}

ensure_namespace() {
  local namespace="$1"
  kubectl create namespace "${namespace}" --dry-run=client -o yaml | kubectl apply -f - >/dev/null
}

patch_resource_for_helm_release() {
  local resource_ref="$1"
  local resource_namespace="$2"
  local release_name="$3"
  local release_namespace="$4"
  local namespace_args=()

  if [[ -n "${resource_namespace}" ]]; then
    namespace_args=(-n "${resource_namespace}")
  fi

  kubectl label "${namespace_args[@]}" --overwrite "${resource_ref}" app.kubernetes.io/managed-by=Helm >/dev/null 2>&1 || true
  kubectl annotate "${namespace_args[@]}" --overwrite "${resource_ref}" meta.helm.sh/release-name="${release_name}" >/dev/null 2>&1 || true
  kubectl annotate "${namespace_args[@]}" --overwrite "${resource_ref}" meta.helm.sh/release-namespace="${release_namespace}" >/dev/null 2>&1 || true
}

adopt_prefixed_resources_for_helm_release() {
  local kind="$1"
  local prefix="$2"
  local namespace="$3"
  local release_name="$4"
  local release_namespace="$5"
  local namespace_args=()

  if [[ -n "${namespace}" ]]; then
    namespace_args=(-n "${namespace}")
  fi

  mapfile -t resources < <(
    kubectl get "${kind}" "${namespace_args[@]}" -o name 2>/dev/null | grep "/${prefix}" || true
  )

  if [[ "${#resources[@]}" -eq 0 ]]; then
    return
  fi

  local resource_ref
  for resource_ref in "${resources[@]}"; do
    patch_resource_for_helm_release "${resource_ref}" "${namespace}" "${release_name}" "${release_namespace}"
  done
}

adopt_dnspod_webhook_release() {
  local release_name='cert-manager-webhook-dnspod'
  local release_namespace="${CERT_MANAGER_NAMESPACE}"

  if helm status "${release_name}" -n "${release_namespace}" >/dev/null 2>&1; then
    return
  fi

  if ! kubectl get deployment cert-manager-webhook-dnspod -n "${CERT_MANAGER_NAMESPACE}" >/dev/null 2>&1; then
    return
  fi

  log_info "检测到历史 cert-manager-webhook-dnspod 资源，正在补齐 Helm ownership metadata"

  patch_resource_for_helm_release "serviceaccount/cert-manager-webhook-dnspod" "${CERT_MANAGER_NAMESPACE}" "${release_name}" "${release_namespace}"
  patch_resource_for_helm_release "deployment.apps/cert-manager-webhook-dnspod" "${CERT_MANAGER_NAMESPACE}" "${release_name}" "${release_namespace}"
  patch_resource_for_helm_release "service/cert-manager-webhook-dnspod" "${CERT_MANAGER_NAMESPACE}" "${release_name}" "${release_namespace}"
  patch_resource_for_helm_release "apiservice.apiregistration.k8s.io/v1alpha1.acme.dnspod.com" "" "${release_name}" "${release_namespace}"

  adopt_prefixed_resources_for_helm_release "clusterrole" "cert-manager-webhook-dnspod" "" "${release_name}" "${release_namespace}"
  adopt_prefixed_resources_for_helm_release "clusterrolebinding" "cert-manager-webhook-dnspod" "" "${release_name}" "${release_namespace}"
  adopt_prefixed_resources_for_helm_release "role" "cert-manager-webhook-dnspod" "${CERT_MANAGER_NAMESPACE}" "${release_name}" "${release_namespace}"
  adopt_prefixed_resources_for_helm_release "rolebinding" "cert-manager-webhook-dnspod" "${CERT_MANAGER_NAMESPACE}" "${release_name}" "${release_namespace}"
  adopt_prefixed_resources_for_helm_release "role" "cert-manager-webhook-dnspod" "kube-system" "${release_name}" "${release_namespace}"
  adopt_prefixed_resources_for_helm_release "rolebinding" "cert-manager-webhook-dnspod" "kube-system" "${release_name}" "${release_namespace}"
  adopt_prefixed_resources_for_helm_release "secret" "cert-manager-webhook-dnspod" "${CERT_MANAGER_NAMESPACE}" "${release_name}" "${release_namespace}"
  adopt_prefixed_resources_for_helm_release "certificate" "cert-manager-webhook-dnspod" "${CERT_MANAGER_NAMESPACE}" "${release_name}" "${release_namespace}"
  adopt_prefixed_resources_for_helm_release "issuer" "cert-manager-webhook-dnspod" "${CERT_MANAGER_NAMESPACE}" "${release_name}" "${release_namespace}"
  adopt_prefixed_resources_for_helm_release "validatingwebhookconfiguration" "cert-manager-webhook-dnspod" "" "${release_name}" "${release_namespace}"
  adopt_prefixed_resources_for_helm_release "mutatingwebhookconfiguration" "cert-manager-webhook-dnspod" "" "${release_name}" "${release_namespace}"

  log_info "删除 legacy Deployment，交给 Helm 以正确 selector 重建 cert-manager-webhook-dnspod"
  kubectl delete deployment cert-manager-webhook-dnspod -n "${CERT_MANAGER_NAMESPACE}" --ignore-not-found=true >/dev/null 2>&1 || true
}

apply_rendered_manifest() {
  local manifest_path="$1"
  local rendered
  local namespace_escaped
  local platform_domain_escaped
  local wildcard_domain
  local wildcard_domain_escaped
  local letsencrypt_email_escaped
  local gateway_class_escaped
  local gateway_lb_ip_escaped

  namespace_escaped="$(printf '%s' "${PLATFORM_NAMESPACE}" | sed 's/[\\/&]/\\&/g')"
  platform_domain_escaped="$(printf '%s' "${PLATFORM_DOMAIN}" | sed 's/[\\/&]/\\&/g')"
  wildcard_domain="*.${PLATFORM_DOMAIN}"
  wildcard_domain_escaped="$(printf '%s' "${wildcard_domain}" | sed 's/[\\/&]/\\&/g')"
  letsencrypt_email_escaped="$(printf '%s' "${LETSENCRYPT_EMAIL}" | sed 's/[\\/&]/\\&/g')"
  gateway_class_escaped="$(printf '%s' "${GATEWAY_CLASS_NAME}" | sed 's/[\\/&]/\\&/g')"

  rendered="$(sed \
    -e "s/^  name: juanie\$/  name: ${namespace_escaped}/" \
    -e "s/^  namespace: juanie\$/  namespace: ${namespace_escaped}/" \
    -e "s/admin@juanie\\.art/${letsencrypt_email_escaped}/g" \
    -e "s/\\*\\.juanie\\.art/${wildcard_domain_escaped}/g" \
    -e "s/juanie\\.art/${platform_domain_escaped}/g" \
    -e "s/gatewayClassName: cilium/gatewayClassName: ${gateway_class_escaped}/" \
    "${manifest_path}")"

  if [[ -n "${GATEWAY_LOADBALANCER_IP}" ]]; then
    gateway_lb_ip_escaped="$(printf '%s' "${GATEWAY_LOADBALANCER_IP}" | sed 's/[\\/&]/\\&/g')"
    rendered="$(printf '%s\n' "${rendered}" | sed "s/10\\.2\\.0\\.15/${gateway_lb_ip_escaped}/g")"
  else
    rendered="$(printf '%s\n' "${rendered}" | sed '/io\.cilium\/lb-ipam-ips:/d')"
  fi

  printf '%s\n' "${rendered}" | kubectl apply -f - >/dev/null
}

ensure_dnspod_secret() {
  if kubectl get secret dnspod-secret -n "${CERT_MANAGER_NAMESPACE}" >/dev/null 2>&1; then
    log_info "检测到现有 dnspod-secret，复用 ${CERT_MANAGER_NAMESPACE}/dnspod-secret"
    return 0
  fi

  if [[ -n "${DNSPOD_SECRET_ID}" && -n "${DNSPOD_SECRET_KEY}" ]]; then
    kubectl apply -f - >/dev/null <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: dnspod-secret
  namespace: ${CERT_MANAGER_NAMESPACE}
type: Opaque
stringData:
  secretId: ${DNSPOD_SECRET_ID}
  secretKey: ${DNSPOD_SECRET_KEY}
EOF
    log_info "已同步 dnspod-secret 到 ${CERT_MANAGER_NAMESPACE}"
    return 0
  fi

  if is_interactive; then
    echo "请输入 DNSPod API 凭证（用于 wildcard 证书 DNS-01 校验）"
    read -r -p "SecretId: " DNSPOD_SECRET_ID
    read -r -p "SecretKey: " DNSPOD_SECRET_KEY

    if [[ -n "${DNSPOD_SECRET_ID}" && -n "${DNSPOD_SECRET_KEY}" ]]; then
      ensure_dnspod_secret
      return 0
    fi
  fi

  log_warn "未提供 DNSPOD_SECRET_ID / DNSPOD_SECRET_KEY，已跳过 dnspod-secret；证书签发会保持 pending。"
  return 1
}

ensure_argocd_project() {
  local rendered
  rendered="$(cat "${INFRA_DIR}/argocd/app-project.yaml")"
  rendered="${rendered//name: juanie/name: ${ARGOCD_PROJECT_NAME}}"
  rendered="${rendered//namespace: argocd/namespace: ${ARGOCD_NAMESPACE}}"
  printf '%s\n' "${rendered}" | kubectl apply -f - >/dev/null
}

ensure_argocd_repo_secret() {
  if [[ -z "${ARGOCD_REPO_URL}" ]]; then
    log_warn "未提供 JUANIE_PREVIEW_APPLICATIONSET_REPO_URL / ARGOCD_REPO_URL，跳过 Argo CD repository secret。"
    return
  fi

  if [[ -z "${ARGOCD_REPO_PASSWORD}" && -z "${ARGOCD_REPO_SSH_PRIVATE_KEY}" ]]; then
    log_info "Argo CD preview source repo 使用匿名/公共访问，不创建 repository secret。"
    return
  fi

  local insecure_field='false'
  if [[ "${ARGOCD_REPO_INSECURE}" == "true" ]]; then
    insecure_field='true'
  fi

  {
    cat <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: ${ARGOCD_REPO_SECRET_NAME}
  namespace: ${ARGOCD_NAMESPACE}
  labels:
    argocd.argoproj.io/secret-type: repository
    app.kubernetes.io/managed-by: juanie-bootstrap
type: Opaque
stringData:
  type: git
  url: ${ARGOCD_REPO_URL}
  project: ${ARGOCD_PROJECT_NAME}
  insecure: "${insecure_field}"
EOF
    if [[ -n "${ARGOCD_REPO_USERNAME}" ]]; then
      echo '  username: |'
      printf '%s\n' "${ARGOCD_REPO_USERNAME}" | sed 's/^/    /'
    fi
    if [[ -n "${ARGOCD_REPO_PASSWORD}" ]]; then
      echo '  password: |'
      printf '%s\n' "${ARGOCD_REPO_PASSWORD}" | sed 's/^/    /'
    fi
    if [[ -n "${ARGOCD_REPO_SSH_PRIVATE_KEY}" ]]; then
      echo '  sshPrivateKey: |'
      printf '%s\n' "${ARGOCD_REPO_SSH_PRIVATE_KEY}" | sed 's/^/    /'
    fi
  } | kubectl apply -f - >/dev/null

  log_info "已同步 Argo CD repository secret: ${ARGOCD_NAMESPACE}/${ARGOCD_REPO_SECRET_NAME}"
}

wait_for_certificate() {
  if [[ "${SKIP_CERT_WAIT}" == "true" ]]; then
    log_info "按配置跳过证书等待。"
    return
  fi

  kubectl wait \
    --for=condition=Ready \
    "certificate/${TLS_CERTIFICATE_NAME}" \
    -n "${PLATFORM_NAMESPACE}" \
    --timeout=10m
}

show_summary() {
  log_section "Bootstrap 完成"
  kubectl get ns "${PLATFORM_NAMESPACE}" "${CERT_MANAGER_NAMESPACE}" "${ARGOCD_NAMESPACE}" "${ARGO_ROLLOUTS_NAMESPACE}" "${CNPG_NAMESPACE}" "${EXTERNAL_SECRETS_NAMESPACE}" >/dev/null
  kubectl get pods -n "${CERT_MANAGER_NAMESPACE}"
  kubectl get pods -n "${ARGOCD_NAMESPACE}"
  kubectl get pods -n "${ARGO_ROLLOUTS_NAMESPACE}"
  kubectl get pods -n "${CNPG_NAMESPACE}"
  kubectl get pods -n "${EXTERNAL_SECRETS_NAMESPACE}"
  kubectl get gateway -n "${PLATFORM_NAMESPACE}" || true
  kubectl get certificate -n "${PLATFORM_NAMESPACE}" || true
}

require_command kubectl
require_command helm
resolve_repo_root
ensure_preview_repo_defaults

log_section "Juanie Platform Bootstrap"
kubectl config current-context
kubectl version --client=true || true

if ! confirm_continue; then
  log_warn "用户取消 bootstrap。"
  exit 1
fi

if ! kubectl get gatewayclass "${GATEWAY_CLASS_NAME}" >/dev/null 2>&1; then
  log_warn "未找到 GatewayClass ${GATEWAY_CLASS_NAME}，后续 Gateway 会创建但无法接流量，请确认集群已安装对应网关实现。"
fi

log_section "添加 Helm 仓库"
helm_repo_update_required='false'

if ! is_local_chart_ref "${CERT_MANAGER_CHART_REF}"; then
  helm_repo_add jetstack https://charts.jetstack.io
  helm_repo_update_required='true'
fi

if ! is_local_chart_ref "${ARGOCD_CHART_REF}" || ! is_local_chart_ref "${ARGO_ROLLOUTS_CHART_REF}"; then
  helm_repo_add argo https://argoproj.github.io/argo-helm
  helm_repo_update_required='true'
fi

if ! is_local_chart_ref "${CNPG_CHART_REF}"; then
  helm_repo_add cnpg https://cloudnative-pg.github.io/charts
  helm_repo_update_required='true'
fi

if ! is_local_chart_ref "${EXTERNAL_SECRETS_CHART_REF}"; then
  helm_repo_add external-secrets https://charts.external-secrets.io
  helm_repo_update_required='true'
fi

if ! is_local_chart_ref "${DNSPOD_WEBHOOK_CHART_REF}"; then
  helm_repo_add cert-manager-webhook-dnspod https://imroc.github.io/cert-manager-webhook-dnspod
  helm_repo_update_required='true'
fi

if [[ "${helm_repo_update_required}" == 'true' ]]; then
  helm repo update >/dev/null
else
  log_info "全部 chart 使用本地包，跳过 Helm repo update"
fi

log_section "安装 cert-manager"
ensure_namespace "${CERT_MANAGER_NAMESPACE}"
helm_upgrade_install \
  cert-manager \
  "${CERT_MANAGER_CHART_REF}" \
  "${CERT_MANAGER_NAMESPACE}" \
  "${INFRA_DIR}/cert-manager/values.yaml" \
  "${CERT_MANAGER_CHART_VERSION}"
wait_for_labeled_deployments "${CERT_MANAGER_NAMESPACE}" app.kubernetes.io/instance=cert-manager

log_section "安装 cert-manager-webhook-dnspod"
adopt_dnspod_webhook_release
helm_upgrade_install \
  cert-manager-webhook-dnspod \
  "${DNSPOD_WEBHOOK_CHART_REF}" \
  "${CERT_MANAGER_NAMESPACE}" \
  "" \
  "${DNSPOD_WEBHOOK_CHART_VERSION}"
wait_for_deployment "${CERT_MANAGER_NAMESPACE}" cert-manager-webhook-dnspod

log_section "同步 DNSPod Secret 与 ClusterIssuer"
dnspod_secret_ready='false'
if ensure_dnspod_secret; then
  dnspod_secret_ready='true'
fi
apply_rendered_manifest "${INFRA_DIR}/cert-manager/cluster-issuer.yaml"

log_section "安装 External Secrets Operator"
helm_upgrade_install \
  external-secrets \
  "${EXTERNAL_SECRETS_CHART_REF}" \
  "${EXTERNAL_SECRETS_NAMESPACE}" \
  "${INFRA_DIR}/external-secrets/values.yaml" \
  "${EXTERNAL_SECRETS_CHART_VERSION}"
wait_for_labeled_deployments "${EXTERNAL_SECRETS_NAMESPACE}" app.kubernetes.io/instance=external-secrets

log_section "安装 Argo CD"
helm_upgrade_install \
  argocd \
  "${ARGOCD_CHART_REF}" \
  "${ARGOCD_NAMESPACE}" \
  "${INFRA_DIR}/argocd/values.yaml" \
  "${ARGOCD_CHART_VERSION}"
wait_for_labeled_statefulsets "${ARGOCD_NAMESPACE}" app.kubernetes.io/instance=argocd
wait_for_labeled_deployments "${ARGOCD_NAMESPACE}" app.kubernetes.io/instance=argocd
ensure_argocd_project
ensure_argocd_repo_secret

log_section "安装 Argo Rollouts"
helm_upgrade_install \
  argo-rollouts \
  "${ARGO_ROLLOUTS_CHART_REF}" \
  "${ARGO_ROLLOUTS_NAMESPACE}" \
  "${INFRA_DIR}/argo-rollouts/values.yaml" \
  "${ARGO_ROLLOUTS_CHART_VERSION}"
wait_for_labeled_deployments "${ARGO_ROLLOUTS_NAMESPACE}" app.kubernetes.io/instance=argo-rollouts

log_section "安装 CloudNativePG"
helm_upgrade_install \
  cloudnative-pg \
  "${CNPG_CHART_REF}" \
  "${CNPG_NAMESPACE}" \
  "${INFRA_DIR}/cloudnative-pg/values.yaml" \
  "${CNPG_CHART_VERSION}"
wait_for_labeled_deployments "${CNPG_NAMESPACE}" app.kubernetes.io/instance=cloudnative-pg

log_section "应用平台网关与证书资源"
apply_rendered_manifest "${INFRA_DIR}/gateway/namespace.yaml"
apply_rendered_manifest "${INFRA_DIR}/gateway/gateway.yaml"
apply_rendered_manifest "${INFRA_DIR}/gateway/certificate.yaml"

if [[ "${dnspod_secret_ready}" == "true" ]]; then
  log_section "等待 wildcard 证书就绪"
  wait_for_certificate
else
  log_warn "由于 dnspod-secret 未创建，已跳过 wildcard 证书等待。"
fi

show_summary
