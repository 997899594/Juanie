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
ARGOCD_ENABLED="${ARGOCD_ENABLED:-false}"
ARGO_ROLLOUTS_NAMESPACE="${ARGO_ROLLOUTS_NAMESPACE:-argo-rollouts}"
CNPG_ENABLED="${CNPG_ENABLED:-false}"
CNPG_NAMESPACE="${CNPG_NAMESPACE:-cnpg-system}"
EXTERNAL_SECRETS_NAMESPACE="${EXTERNAL_SECRETS_NAMESPACE:-external-secrets}"
EXTERNAL_SECRETS_ENABLED="${EXTERNAL_SECRETS_ENABLED:-false}"
BYTEBASE_ENABLED="${BYTEBASE_ENABLED:-false}"
BYTEBASE_NAMESPACE="${BYTEBASE_NAMESPACE:-bytebase}"
BYTEBASE_HOSTNAME="${BYTEBASE_HOSTNAME:-bytebase.${PLATFORM_DOMAIN}}"
BYTEBASE_PUBLIC_URL="${BYTEBASE_PUBLIC_URL:-}"
BYTEBASE_SERVICE_NAME="${BYTEBASE_SERVICE_NAME:-bytebase-entrypoint}"
BYTEBASE_SERVICE_PORT="${BYTEBASE_SERVICE_PORT:-80}"
BYTEBASE_REPLICAS="${BYTEBASE_REPLICAS:-0}"
BYTEBASE_METADATA_DATABASE_URL="${BYTEBASE_METADATA_DATABASE_URL:-}"
BYTEBASE_METADATA_DATABASE_NAME="${BYTEBASE_METADATA_DATABASE_NAME:-bytebase}"
BYTEBASE_METADATA_DATABASE_USER="${BYTEBASE_METADATA_DATABASE_USER:-bytebase}"
BYTEBASE_METADATA_CREDENTIALS_SECRET="${BYTEBASE_METADATA_CREDENTIALS_SECRET:-bytebase-metadata-app}"
BYTEBASE_METADATA_URL_SECRET="${BYTEBASE_METADATA_URL_SECRET:-bytebase-metadata-pg-url}"
BYTEBASE_METADATA_URL_SECRET_KEY="${BYTEBASE_METADATA_URL_SECRET_KEY:-url}"
BYTEBASE_METADATA_WAIT_TIMEOUT="${BYTEBASE_METADATA_WAIT_TIMEOUT:-10m}"
BYTEBASE_METADATA_BOOTSTRAP_IMAGE="${BYTEBASE_METADATA_BOOTSTRAP_IMAGE:-pgvector/pgvector:pg16}"
BYTEBASE_METADATA_BOOTSTRAP_JOB_NAME="${BYTEBASE_METADATA_BOOTSTRAP_JOB_NAME:-bytebase-metadata-bootstrap}"
PLATFORM_DATABASE_SERVICE="${PLATFORM_DATABASE_SERVICE:-postgres}"
PLATFORM_DATABASE_HOST="${PLATFORM_DATABASE_HOST:-${PLATFORM_DATABASE_SERVICE}.${PLATFORM_NAMESPACE}.svc.cluster.local}"
PLATFORM_DATABASE_PORT="${PLATFORM_DATABASE_PORT:-5432}"
PLATFORM_DATABASE_USER="${PLATFORM_DATABASE_USER:-postgres}"
PLATFORM_DATABASE_PASSWORD_SECRET="${PLATFORM_DATABASE_PASSWORD_SECRET:-juanie-secret}"
PLATFORM_DATABASE_PASSWORD_SECRET_KEY="${PLATFORM_DATABASE_PASSWORD_SECRET_KEY:-DATABASE_PASSWORD}"
GATEWAY_CLASS_NAME="${GATEWAY_CLASS_NAME:-cilium}"
GATEWAY_LOADBALANCER_IP="${GATEWAY_LOADBALANCER_IP:-10.2.0.15}"
GATEWAY_EDGE_MODE="${GATEWAY_EDGE_MODE:-loadBalancer}"
GATEWAY_HTTP_PORT="${GATEWAY_HTTP_PORT:-}"
GATEWAY_HTTPS_ENABLED="${GATEWAY_HTTPS_ENABLED:-}"
GATEWAY_WILDCARD_ENABLED="${GATEWAY_WILDCARD_ENABLED:-true}"
ARGOCD_REPO_SECRET_NAME="${ARGOCD_REPO_SECRET_NAME:-juanie-preview-source}"

CERT_MANAGER_CHART_VERSION="${CERT_MANAGER_CHART_VERSION:-v1.20.2}"
ARGOCD_CHART_VERSION="${ARGOCD_CHART_VERSION:-9.5.2}"
ARGO_ROLLOUTS_CHART_VERSION="${ARGO_ROLLOUTS_CHART_VERSION:-2.40.9}"
CNPG_CHART_VERSION="${CNPG_CHART_VERSION:-0.28.0}"
EXTERNAL_SECRETS_CHART_VERSION="${EXTERNAL_SECRETS_CHART_VERSION:-2.3.0}"
DNSPOD_WEBHOOK_CHART_VERSION="${DNSPOD_WEBHOOK_CHART_VERSION:-1.5.2}"
BYTEBASE_CHART_VERSION="${BYTEBASE_CHART_VERSION:-1.1.2}"
BYTEBASE_IMAGE_VERSION="${BYTEBASE_IMAGE_VERSION:-3.17.1}"
BYTEBASE_IMAGE_REGISTRY="${BYTEBASE_IMAGE_REGISTRY:-docker.io}"
BYTEBASE_IMAGE_REPOSITORY="${BYTEBASE_IMAGE_REPOSITORY:-bytebase/bytebase}"
BYTEBASE_RESOURCE_CHECK_ENABLED="${BYTEBASE_RESOURCE_CHECK_ENABLED:-true}"
BYTEBASE_MIN_NODE_MEMORY_MIB="${BYTEBASE_MIN_NODE_MEMORY_MIB:-6144}"
BYTEBASE_MIN_AVAILABLE_MEMORY_MIB="${BYTEBASE_MIN_AVAILABLE_MEMORY_MIB:-1536}"

CERT_MANAGER_CHART_REF="${CERT_MANAGER_CHART_REF:-jetstack/cert-manager}"
ARGOCD_CHART_REF="${ARGOCD_CHART_REF:-argo/argo-cd}"
ARGO_ROLLOUTS_CHART_REF="${ARGO_ROLLOUTS_CHART_REF:-argo/argo-rollouts}"
CNPG_CHART_REF="${CNPG_CHART_REF:-cnpg/cloudnative-pg}"
EXTERNAL_SECRETS_CHART_REF="${EXTERNAL_SECRETS_CHART_REF:-external-secrets/external-secrets}"
DNSPOD_WEBHOOK_CHART_REF="${DNSPOD_WEBHOOK_CHART_REF:-cert-manager-webhook-dnspod/cert-manager-webhook-dnspod}"
BYTEBASE_CHART_REF="${BYTEBASE_CHART_REF:-bytebase/bytebase}"

BOOTSTRAP_CHART_SOURCE="${BOOTSTRAP_CHART_SOURCE:-repo}"
BOOTSTRAP_CHART_DIR="${BOOTSTRAP_CHART_DIR:-${ROOT_DIR}/.charts}"
BOOTSTRAP_CHART_DOWNLOAD_PROXY="${BOOTSTRAP_CHART_DOWNLOAD_PROXY:-}"
BOOTSTRAP_CHART_FORCE_DOWNLOAD="${BOOTSTRAP_CHART_FORCE_DOWNLOAD:-false}"
CERT_MANAGER_CHART_URL="${CERT_MANAGER_CHART_URL:-https://charts.jetstack.io/charts/cert-manager-${CERT_MANAGER_CHART_VERSION}.tgz}"
ARGOCD_CHART_URL="${ARGOCD_CHART_URL:-https://github.com/argoproj/argo-helm/releases/download/argo-cd-${ARGOCD_CHART_VERSION}/argo-cd-${ARGOCD_CHART_VERSION}.tgz}"
ARGO_ROLLOUTS_CHART_URL="${ARGO_ROLLOUTS_CHART_URL:-https://github.com/argoproj/argo-helm/releases/download/argo-rollouts-${ARGO_ROLLOUTS_CHART_VERSION}/argo-rollouts-${ARGO_ROLLOUTS_CHART_VERSION}.tgz}"
CNPG_CHART_URL="${CNPG_CHART_URL:-https://github.com/cloudnative-pg/charts/releases/download/cloudnative-pg-v${CNPG_CHART_VERSION}/cloudnative-pg-${CNPG_CHART_VERSION}.tgz}"
EXTERNAL_SECRETS_CHART_URL="${EXTERNAL_SECRETS_CHART_URL:-https://external-secrets.io/external-secrets-${EXTERNAL_SECRETS_CHART_VERSION}.tgz}"
DNSPOD_WEBHOOK_CHART_URL="${DNSPOD_WEBHOOK_CHART_URL:-https://github.com/imroc/cert-manager-webhook-dnspod/releases/download/cert-manager-webhook-dnspod-${DNSPOD_WEBHOOK_CHART_VERSION}/cert-manager-webhook-dnspod-${DNSPOD_WEBHOOK_CHART_VERSION}.tgz}"
BYTEBASE_CHART_URL="${BYTEBASE_CHART_URL:-https://bytebase.github.io/bytebase/bytebase-${BYTEBASE_CHART_VERSION}.tgz}"

CERT_MANAGER_IMAGE_REPOSITORY="${CERT_MANAGER_IMAGE_REPOSITORY:-}"
CERT_MANAGER_WEBHOOK_IMAGE_REPOSITORY="${CERT_MANAGER_WEBHOOK_IMAGE_REPOSITORY:-}"
CERT_MANAGER_CAINJECTOR_IMAGE_REPOSITORY="${CERT_MANAGER_CAINJECTOR_IMAGE_REPOSITORY:-}"
ARGOCD_IMAGE_REPOSITORY="${ARGOCD_IMAGE_REPOSITORY:-}"
ARGOCD_REDIS_IMAGE_REPOSITORY="${ARGOCD_REDIS_IMAGE_REPOSITORY:-}"
ARGOCD_REDIS_IMAGE_TAG="${ARGOCD_REDIS_IMAGE_TAG:-}"
ARGO_ROLLOUTS_IMAGE_REGISTRY="${ARGO_ROLLOUTS_IMAGE_REGISTRY:-}"
ARGO_ROLLOUTS_IMAGE_REPOSITORY="${ARGO_ROLLOUTS_IMAGE_REPOSITORY:-}"
ARGO_ROLLOUTS_IMAGE_TAG="${ARGO_ROLLOUTS_IMAGE_TAG:-}"
CNPG_IMAGE_REPOSITORY="${CNPG_IMAGE_REPOSITORY:-}"
CNPG_IMAGE_TAG="${CNPG_IMAGE_TAG:-}"
EXTERNAL_SECRETS_IMAGE_REPOSITORY="${EXTERNAL_SECRETS_IMAGE_REPOSITORY:-}"
EXTERNAL_SECRETS_IMAGE_TAG="${EXTERNAL_SECRETS_IMAGE_TAG:-}"

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

chart_download_url() {
  local url="$1"
  if [[ -n "${BOOTSTRAP_CHART_DOWNLOAD_PROXY}" && "${url}" == https://github.com/* ]]; then
    printf '%s%s\n' "${BOOTSTRAP_CHART_DOWNLOAD_PROXY}" "${url}"
    return
  fi

  printf '%s\n' "${url}"
}

download_chart() {
  local file_name="$1"
  local url="$2"
  local target="${BOOTSTRAP_CHART_DIR}/${file_name}"
  local resolved_url

  mkdir -p "${BOOTSTRAP_CHART_DIR}"

  if [[ -s "${target}" && "${BOOTSTRAP_CHART_FORCE_DOWNLOAD}" != "true" ]]; then
    log_info "复用本地 chart: ${target}" >&2
    printf '%s\n' "${target}"
    return
  fi

  resolved_url="$(chart_download_url "${url}")"
  log_info "下载 chart: ${resolved_url}" >&2
  if ! curl -fL --retry 5 --connect-timeout 20 --max-time 300 -o "${target}" "${resolved_url}"; then
    rm -f "${target}"
    return 1
  fi
  if ! tar -tzf "${target}" >/dev/null; then
    rm -f "${target}"
    log_error "下载的 chart 包不可读: ${target}"
    return 1
  fi
  printf '%s\n' "${target}"
}

resolve_chart_refs() {
  case "${BOOTSTRAP_CHART_SOURCE}" in
    repo)
      return
      ;;
    download)
      require_command curl
      CERT_MANAGER_CHART_REF="$(download_chart "cert-manager-${CERT_MANAGER_CHART_VERSION}.tgz" "${CERT_MANAGER_CHART_URL}")"
      if [[ "${ARGOCD_ENABLED}" == "true" ]]; then
        ARGOCD_CHART_REF="$(download_chart "argo-cd-${ARGOCD_CHART_VERSION}.tgz" "${ARGOCD_CHART_URL}")"
      fi
      ARGO_ROLLOUTS_CHART_REF="$(download_chart "argo-rollouts-${ARGO_ROLLOUTS_CHART_VERSION}.tgz" "${ARGO_ROLLOUTS_CHART_URL}")"
      if [[ "${CNPG_ENABLED}" == "true" ]]; then
        CNPG_CHART_REF="$(download_chart "cloudnative-pg-${CNPG_CHART_VERSION}.tgz" "${CNPG_CHART_URL}")"
      fi

      if [[ "${EXTERNAL_SECRETS_ENABLED}" == "true" ]]; then
        EXTERNAL_SECRETS_CHART_REF="$(download_chart "external-secrets-${EXTERNAL_SECRETS_CHART_VERSION}.tgz" "${EXTERNAL_SECRETS_CHART_URL}")"
      fi

      if [[ "${BYTEBASE_ENABLED}" == "true" ]]; then
        BYTEBASE_CHART_REF="$(download_chart "bytebase-${BYTEBASE_CHART_VERSION}.tgz" "${BYTEBASE_CHART_URL}")"
      fi

      if [[ "$(gateway_https_enabled)" == "true" ]]; then
        DNSPOD_WEBHOOK_CHART_REF="$(download_chart "cert-manager-webhook-dnspod-${DNSPOD_WEBHOOK_CHART_VERSION}.tgz" "${DNSPOD_WEBHOOK_CHART_URL}")"
      fi
      ;;
    *)
      log_error "未知 BOOTSTRAP_CHART_SOURCE=${BOOTSTRAP_CHART_SOURCE}，可选值: repo, download"
      exit 1
      ;;
  esac
}

is_local_chart_ref() {
  local chart_ref="$1"
  [[ "${chart_ref}" == /* || "${chart_ref}" == ./* || "${chart_ref}" == ../* || "${chart_ref}" == *.tgz ]]
}

gateway_http_port() {
  if [[ -n "${GATEWAY_HTTP_PORT}" ]]; then
    printf '%s\n' "${GATEWAY_HTTP_PORT}"
    return
  fi

  if [[ "${GATEWAY_EDGE_MODE}" == "externalEdge" ]]; then
    printf '31080\n'
    return
  fi

  printf '80\n'
}

gateway_https_enabled() {
  if [[ -n "${GATEWAY_HTTPS_ENABLED}" ]]; then
    printf '%s\n' "${GATEWAY_HTTPS_ENABLED}"
    return
  fi

  if [[ "${GATEWAY_EDGE_MODE}" == "externalEdge" ]]; then
    printf 'false\n'
    return
  fi

  printf 'true\n'
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

helm_upgrade_install_no_wait() {
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
    --timeout 15m \
    "${helm_args[@]}" \
    "${extra_args[@]}"
}

helm_major_version() {
  helm version --short 2>/dev/null | sed -E 's/^v([0-9]+).*/\1/'
}

helm_supports_executable_post_renderer() {
  local major
  major="$(helm_major_version)"
  [[ -n "${major}" && "${major}" -lt 4 ]]
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

apply_gateway_manifest() {
  local http_port
  local https_enabled
  local wildcard_enabled

  http_port="$(gateway_http_port)"
  https_enabled="$(gateway_https_enabled)"
  wildcard_enabled="${GATEWAY_WILDCARD_ENABLED}"

  if [[ "${GATEWAY_EDGE_MODE}" != "loadBalancer" && "${GATEWAY_EDGE_MODE}" != "externalEdge" ]]; then
    log_error "未知 GATEWAY_EDGE_MODE=${GATEWAY_EDGE_MODE}，可选值: loadBalancer, externalEdge"
    exit 1
  fi

  {
    cat <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: shared-gateway
  namespace: ${PLATFORM_NAMESPACE}
EOF
    if [[ "${https_enabled}" == "true" || -n "${GATEWAY_LOADBALANCER_IP}" ]]; then
      echo "  annotations:"
      if [[ "${https_enabled}" == "true" ]]; then
        echo "    cert-manager.io/cluster-issuer: letsencrypt-prod"
      fi
      if [[ -n "${GATEWAY_LOADBALANCER_IP}" ]]; then
        echo "    io.cilium/lb-ipam-ips: \"${GATEWAY_LOADBALANCER_IP}\""
      fi
    fi
    cat <<EOF
spec:
  gatewayClassName: ${GATEWAY_CLASS_NAME}
  listeners:
    - name: http-apex
      protocol: HTTP
      port: ${http_port}
      hostname: "${PLATFORM_DOMAIN}"
      allowedRoutes:
        namespaces:
          from: All
EOF
    if [[ "${https_enabled}" == "true" ]]; then
      cat <<EOF
    - name: https-apex
      protocol: HTTPS
      port: 443
      hostname: "${PLATFORM_DOMAIN}"
      allowedRoutes:
        namespaces:
          from: All
      tls:
        mode: Terminate
        certificateRefs:
          - name: ${TLS_CERTIFICATE_NAME}
            group: ""
            kind: Secret
EOF
    fi
    if [[ "${wildcard_enabled}" == "true" ]]; then
      cat <<EOF
    - name: http-wildcard
      protocol: HTTP
      port: ${http_port}
      hostname: "*.${PLATFORM_DOMAIN}"
      allowedRoutes:
        namespaces:
          from: All
EOF
      if [[ "${https_enabled}" == "true" ]]; then
        cat <<EOF
    - name: https-wildcard
      protocol: HTTPS
      port: 443
      hostname: "*.${PLATFORM_DOMAIN}"
      allowedRoutes:
        namespaces:
          from: All
      tls:
        mode: Terminate
        certificateRefs:
          - name: ${TLS_CERTIFICATE_NAME}
            group: ""
            kind: Secret
EOF
      fi
    fi
  } | kubectl apply -f - >/dev/null

  log_info "已同步 Gateway shared-gateway: mode=${GATEWAY_EDGE_MODE}, httpPort=${http_port}, https=${https_enabled}"
}

bytebase_public_url() {
  if [[ -n "${BYTEBASE_PUBLIC_URL}" ]]; then
    printf '%s\n' "${BYTEBASE_PUBLIC_URL%/}"
    return
  fi

  if [[ "$(gateway_https_enabled)" == "true" ]]; then
    printf 'https://%s\n' "${BYTEBASE_HOSTNAME}"
    return
  fi

  printf 'http://%s\n' "${BYTEBASE_HOSTNAME}"
}

apply_bytebase_route() {
  local section_name

  if [[ "${BYTEBASE_ENABLED}" != "true" ]]; then
    return
  fi

  if [[ "$(gateway_https_enabled)" == "true" ]]; then
    section_name='https-wildcard'
  else
    section_name='http-wildcard'
  fi

  ensure_namespace "${BYTEBASE_NAMESPACE}"

  cat <<EOF | kubectl apply -f - >/dev/null
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: bytebase
  namespace: ${BYTEBASE_NAMESPACE}
  labels:
    app.kubernetes.io/managed-by: juanie-bootstrap
spec:
  parentRefs:
    - name: shared-gateway
      namespace: ${PLATFORM_NAMESPACE}
      sectionName: ${section_name}
  hostnames:
    - "${BYTEBASE_HOSTNAME}"
  rules:
    - backendRefs:
        - name: ${BYTEBASE_SERVICE_NAME}
          port: ${BYTEBASE_SERVICE_PORT}
EOF

  log_info "已同步 Bytebase HTTPRoute: $(bytebase_public_url)"
}

decode_base64() {
  if base64 --help 2>&1 | grep -q -- '--decode'; then
    base64 --decode
    return
  fi

  base64 -D
}

get_secret_value() {
  local namespace="$1"
  local secret_name="$2"
  local key="$3"

  kubectl get secret "${secret_name}" -n "${namespace}" -o "jsonpath={.data.${key}}" | decode_base64
}

read_meminfo_mib() {
  local key="$1"
  awk -v key="${key}:" '$1 == key { printf "%d\n", int($2 / 1024); found = 1 } END { if (!found) exit 1 }' /proc/meminfo
}

ensure_bytebase_resource_budget() {
  local total_mib
  local available_mib

  if ! [[ "${BYTEBASE_REPLICAS}" =~ ^[0-9]+$ ]]; then
    log_error "BYTEBASE_REPLICAS 必须是非负整数，当前为 ${BYTEBASE_REPLICAS}"
    exit 1
  fi

  if (( BYTEBASE_REPLICAS == 0 )); then
    log_info "Bytebase 以按需模式安装，replicas=0，跳过运行态资源基线检查。"
    return
  fi

  if [[ "${BYTEBASE_RESOURCE_CHECK_ENABLED}" != "true" ]]; then
    log_warn "Bytebase 资源基线检查已关闭。"
    return
  fi

  total_mib="$(read_meminfo_mib MemTotal)"
  available_mib="$(read_meminfo_mib MemAvailable)"

  if (( total_mib < BYTEBASE_MIN_NODE_MEMORY_MIB )); then
    log_error "当前节点内存 ${total_mib}MiB，不满足 Bytebase 最低 ${BYTEBASE_MIN_NODE_MEMORY_MIB}MiB。"
    log_error "请扩容节点、使用外部 Bytebase，或显式设置 BYTEBASE_RESOURCE_CHECK_ENABLED=false 后再安装。"
    exit 1
  fi

  if (( available_mib < BYTEBASE_MIN_AVAILABLE_MEMORY_MIB )); then
    log_error "当前可用内存 ${available_mib}MiB，不满足 Bytebase 安装最低 ${BYTEBASE_MIN_AVAILABLE_MEMORY_MIB}MiB。"
    log_error "请先释放资源、扩容节点，或显式设置 BYTEBASE_RESOURCE_CHECK_ENABLED=false 后再安装。"
    exit 1
  fi
}

ensure_bytebase_metadata_credentials_secret() {
  if kubectl get secret "${BYTEBASE_METADATA_CREDENTIALS_SECRET}" -n "${BYTEBASE_NAMESPACE}" >/dev/null 2>&1; then
    log_info "复用 Bytebase metadata DB 凭证 Secret: ${BYTEBASE_NAMESPACE}/${BYTEBASE_METADATA_CREDENTIALS_SECRET}"
    return
  fi

  require_command openssl

  local password
  password="$(openssl rand -hex 32)"

  kubectl create secret generic "${BYTEBASE_METADATA_CREDENTIALS_SECRET}" \
    -n "${BYTEBASE_NAMESPACE}" \
    --from-literal=username="${BYTEBASE_METADATA_DATABASE_USER}" \
    --from-literal=password="${password}" \
    --dry-run=client \
    -o yaml | kubectl apply -f - >/dev/null

  log_info "已创建 Bytebase metadata DB 凭证 Secret: ${BYTEBASE_NAMESPACE}/${BYTEBASE_METADATA_CREDENTIALS_SECRET}"
}

ensure_bytebase_metadata_url_secret() {
  local database_url="$1"

  kubectl create secret generic "${BYTEBASE_METADATA_URL_SECRET}" \
    -n "${BYTEBASE_NAMESPACE}" \
    --from-literal="${BYTEBASE_METADATA_URL_SECRET_KEY}=${database_url}" \
    --dry-run=client \
    -o yaml | kubectl apply -f - >/dev/null

  log_info "已同步 Bytebase metadata DB URL Secret: ${BYTEBASE_NAMESPACE}/${BYTEBASE_METADATA_URL_SECRET}"
}

ensure_bytebase_metadata_bootstrap_secret() {
  local password="$1"
  local secret_name="${BYTEBASE_METADATA_BOOTSTRAP_JOB_NAME}-credentials"

  kubectl create secret generic "${secret_name}" \
    -n "${PLATFORM_NAMESPACE}" \
    --from-literal=username="${BYTEBASE_METADATA_DATABASE_USER}" \
    --from-literal=password="${password}" \
    --dry-run=client \
    -o yaml | kubectl apply -f - >/dev/null

  printf '%s\n' "${secret_name}"
}

wait_for_job() {
  local namespace="$1"
  local job_name="$2"
  local timeout="$3"

  if ! kubectl wait --for=condition=Complete "job/${job_name}" -n "${namespace}" --timeout="${timeout}"; then
    log_warn "Job ${namespace}/${job_name} 未完成，输出最近日志。"
    kubectl logs "job/${job_name}" -n "${namespace}" --tail=120 || true
    return 1
  fi
}

ensure_bytebase_control_plane_metadata_database() {
  local password
  local database_url
  local bootstrap_secret

  if [[ "${BYTEBASE_ENABLED}" != "true" ]]; then
    return
  fi

  ensure_namespace "${BYTEBASE_NAMESPACE}"

  if [[ -n "${BYTEBASE_METADATA_DATABASE_URL}" ]]; then
    ensure_bytebase_metadata_url_secret "${BYTEBASE_METADATA_DATABASE_URL}"
    log_info "Bytebase 使用外部 metadata DB 覆盖配置。"
    return
  fi

  ensure_bytebase_metadata_credentials_secret
  password="$(get_secret_value "${BYTEBASE_NAMESPACE}" "${BYTEBASE_METADATA_CREDENTIALS_SECRET}" password)"
  bootstrap_secret="$(ensure_bytebase_metadata_bootstrap_secret "${password}")"

  kubectl delete job "${BYTEBASE_METADATA_BOOTSTRAP_JOB_NAME}" \
    -n "${PLATFORM_NAMESPACE}" \
    --ignore-not-found=true \
    --wait=true >/dev/null

  cat <<EOF | kubectl apply -f - >/dev/null
apiVersion: batch/v1
kind: Job
metadata:
  name: ${BYTEBASE_METADATA_BOOTSTRAP_JOB_NAME}
  namespace: ${PLATFORM_NAMESPACE}
  labels:
    app.kubernetes.io/managed-by: juanie-bootstrap
    app.kubernetes.io/component: bytebase-metadata
spec:
  backoffLimit: 1
  ttlSecondsAfterFinished: 300
  template:
    metadata:
      labels:
        app.kubernetes.io/component: bytebase-metadata
    spec:
      restartPolicy: Never
      containers:
        - name: psql
          image: ${BYTEBASE_METADATA_BOOTSTRAP_IMAGE}
          imagePullPolicy: IfNotPresent
          env:
            - name: PGHOST
              value: "${PLATFORM_DATABASE_HOST}"
            - name: PGPORT
              value: "${PLATFORM_DATABASE_PORT}"
            - name: PGUSER
              value: "${PLATFORM_DATABASE_USER}"
            - name: PGPASSWORD
              valueFrom:
                secretKeyRef:
                  name: ${PLATFORM_DATABASE_PASSWORD_SECRET}
                  key: ${PLATFORM_DATABASE_PASSWORD_SECRET_KEY}
            - name: BYTEBASE_DB
              value: "${BYTEBASE_METADATA_DATABASE_NAME}"
            - name: BYTEBASE_USER
              valueFrom:
                secretKeyRef:
                  name: ${bootstrap_secret}
                  key: username
            - name: BYTEBASE_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: ${bootstrap_secret}
                  key: password
          command:
            - /bin/sh
            - -ec
          args:
            - |
              psql -v ON_ERROR_STOP=1 \
                -v dbname="\${BYTEBASE_DB}" \
                -v dbuser="\${BYTEBASE_USER}" \
                -v dbpass="\${BYTEBASE_PASSWORD}" <<'SQL'
              SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'dbuser', :'dbpass')
              WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'dbuser')\gexec

              SELECT format('ALTER ROLE %I LOGIN PASSWORD %L', :'dbuser', :'dbpass')\gexec

              SELECT format('CREATE DATABASE %I OWNER %I', :'dbname', :'dbuser')
              WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'dbname')\gexec

              ALTER DATABASE :"dbname" OWNER TO :"dbuser";
              \connect :dbname
              GRANT ALL PRIVILEGES ON DATABASE :"dbname" TO :"dbuser";
              GRANT ALL ON SCHEMA public TO :"dbuser";
              ALTER SCHEMA public OWNER TO :"dbuser";
              SQL
EOF

  if ! wait_for_job "${PLATFORM_NAMESPACE}" "${BYTEBASE_METADATA_BOOTSTRAP_JOB_NAME}" "${BYTEBASE_METADATA_WAIT_TIMEOUT}"; then
    kubectl delete secret "${bootstrap_secret}" -n "${PLATFORM_NAMESPACE}" --ignore-not-found=true >/dev/null
    return 1
  fi
  kubectl delete secret "${bootstrap_secret}" -n "${PLATFORM_NAMESPACE}" --ignore-not-found=true >/dev/null

  database_url="postgresql://${BYTEBASE_METADATA_DATABASE_USER}:${password}@${PLATFORM_DATABASE_HOST}:${PLATFORM_DATABASE_PORT}/${BYTEBASE_METADATA_DATABASE_NAME}?sslmode=disable"
  ensure_bytebase_metadata_url_secret "${database_url}"
  log_info "已准备 Bytebase control-plane metadata DB: ${PLATFORM_DATABASE_HOST}/${BYTEBASE_METADATA_DATABASE_NAME}"
}

create_bytebase_post_renderer() {
  local path
  path="${TMPDIR:-/tmp}/juanie-bytebase-post-renderer-$$"

  cat >"${path}" <<EOF
#!/usr/bin/env bash
awk '
  \$0 == "kind: StatefulSet" { in_statefulset=1; print; next }
  \$0 == "---" { in_statefulset=0; print; next }
  in_statefulset && \$0 ~ /^  replicas: [0-9]+$/ {
    print "  replicas: ${BYTEBASE_REPLICAS}"
    next
  }
  { print }
'
EOF
  chmod +x "${path}"
  printf '%s\n' "${path}"
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
  summary_namespaces=("${PLATFORM_NAMESPACE}" "${CERT_MANAGER_NAMESPACE}" "${ARGO_ROLLOUTS_NAMESPACE}")
  if [[ "${ARGOCD_ENABLED}" == "true" ]]; then
    summary_namespaces+=("${ARGOCD_NAMESPACE}")
  fi
  if [[ "${CNPG_ENABLED}" == "true" ]]; then
    summary_namespaces+=("${CNPG_NAMESPACE}")
  fi
  if [[ "${EXTERNAL_SECRETS_ENABLED}" == "true" ]]; then
    summary_namespaces+=("${EXTERNAL_SECRETS_NAMESPACE}")
  fi
  if [[ "${BYTEBASE_ENABLED}" == "true" ]]; then
    summary_namespaces+=("${BYTEBASE_NAMESPACE}")
  fi

  kubectl get ns "${summary_namespaces[@]}" >/dev/null
  kubectl get pods -n "${CERT_MANAGER_NAMESPACE}"
  if [[ "${ARGOCD_ENABLED}" == "true" ]]; then
    kubectl get pods -n "${ARGOCD_NAMESPACE}"
  fi
  kubectl get pods -n "${ARGO_ROLLOUTS_NAMESPACE}"
  if [[ "${CNPG_ENABLED}" == "true" ]]; then
    kubectl get pods -n "${CNPG_NAMESPACE}"
  fi
  if [[ "${EXTERNAL_SECRETS_ENABLED}" == "true" ]]; then
    kubectl get pods -n "${EXTERNAL_SECRETS_NAMESPACE}"
  fi
  if [[ "${BYTEBASE_ENABLED}" == "true" ]]; then
    kubectl get pods -n "${BYTEBASE_NAMESPACE}"
    log_info "Bytebase URL: $(bytebase_public_url)"
    log_info "Bytebase replicas: ${BYTEBASE_REPLICAS}。按需启动: deploy/k8s/scripts/bytebase-on-demand.sh start"
    log_info "需要在 Juanie UI 暴露入口时，再设置 BYTEBASE_ENABLED=true 和 BYTEBASE_URL=$(bytebase_public_url)"
  fi
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

resolve_chart_refs

log_section "添加 Helm 仓库"
helm_repo_update_required='false'

if ! is_local_chart_ref "${CERT_MANAGER_CHART_REF}"; then
  helm_repo_add jetstack https://charts.jetstack.io
  helm_repo_update_required='true'
fi

if { [[ "${ARGOCD_ENABLED}" == "true" ]] && ! is_local_chart_ref "${ARGOCD_CHART_REF}"; } || ! is_local_chart_ref "${ARGO_ROLLOUTS_CHART_REF}"; then
  helm_repo_add argo https://argoproj.github.io/argo-helm
  helm_repo_update_required='true'
fi

if [[ "${CNPG_ENABLED}" == "true" ]] && ! is_local_chart_ref "${CNPG_CHART_REF}"; then
  helm_repo_add cnpg https://cloudnative-pg.github.io/charts
  helm_repo_update_required='true'
fi

if [[ "${EXTERNAL_SECRETS_ENABLED}" == "true" ]] && ! is_local_chart_ref "${EXTERNAL_SECRETS_CHART_REF}"; then
  helm_repo_add external-secrets https://charts.external-secrets.io
  helm_repo_update_required='true'
fi

if [[ "${BYTEBASE_ENABLED}" == "true" ]] && ! is_local_chart_ref "${BYTEBASE_CHART_REF}"; then
  helm_repo_add bytebase https://bytebase.github.io/bytebase
  helm_repo_update_required='true'
fi

if [[ "$(gateway_https_enabled)" == "true" ]] && ! is_local_chart_ref "${DNSPOD_WEBHOOK_CHART_REF}"; then
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
cert_manager_args=()
if [[ -n "${CERT_MANAGER_IMAGE_REPOSITORY}" ]]; then
  cert_manager_args+=(--set "image.repository=${CERT_MANAGER_IMAGE_REPOSITORY}")
fi
if [[ -n "${CERT_MANAGER_WEBHOOK_IMAGE_REPOSITORY}" ]]; then
  cert_manager_args+=(--set "webhook.image.repository=${CERT_MANAGER_WEBHOOK_IMAGE_REPOSITORY}")
fi
if [[ -n "${CERT_MANAGER_CAINJECTOR_IMAGE_REPOSITORY}" ]]; then
  cert_manager_args+=(--set "cainjector.image.repository=${CERT_MANAGER_CAINJECTOR_IMAGE_REPOSITORY}")
fi
helm_upgrade_install \
  cert-manager \
  "${CERT_MANAGER_CHART_REF}" \
  "${CERT_MANAGER_NAMESPACE}" \
  "${INFRA_DIR}/cert-manager/values.yaml" \
  "${CERT_MANAGER_CHART_VERSION}" \
  "${cert_manager_args[@]}"
wait_for_labeled_deployments "${CERT_MANAGER_NAMESPACE}" app.kubernetes.io/instance=cert-manager

dnspod_secret_ready='false'

if [[ "$(gateway_https_enabled)" == "true" ]]; then
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
  if ensure_dnspod_secret; then
    dnspod_secret_ready='true'
  fi
  apply_rendered_manifest "${INFRA_DIR}/cert-manager/cluster-issuer.yaml"
else
  log_info "Gateway HTTPS listener 已关闭，跳过 DNSPod webhook 与 ClusterIssuer。"
fi

if [[ "${EXTERNAL_SECRETS_ENABLED}" == "true" ]]; then
  log_section "安装 External Secrets Operator"
  external_secrets_args=()
  if [[ -n "${EXTERNAL_SECRETS_IMAGE_REPOSITORY}" ]]; then
    external_secrets_args+=(
      --set "image.repository=${EXTERNAL_SECRETS_IMAGE_REPOSITORY}"
      --set "webhook.image.repository=${EXTERNAL_SECRETS_IMAGE_REPOSITORY}"
      --set "certController.image.repository=${EXTERNAL_SECRETS_IMAGE_REPOSITORY}"
    )
  fi
  if [[ -n "${EXTERNAL_SECRETS_IMAGE_TAG}" ]]; then
    external_secrets_args+=(
      --set "image.tag=${EXTERNAL_SECRETS_IMAGE_TAG}"
      --set "webhook.image.tag=${EXTERNAL_SECRETS_IMAGE_TAG}"
      --set "certController.image.tag=${EXTERNAL_SECRETS_IMAGE_TAG}"
    )
  fi
  helm_upgrade_install \
    external-secrets \
    "${EXTERNAL_SECRETS_CHART_REF}" \
    "${EXTERNAL_SECRETS_NAMESPACE}" \
    "${INFRA_DIR}/external-secrets/values.yaml" \
    "${EXTERNAL_SECRETS_CHART_VERSION}" \
    "${external_secrets_args[@]}"
  wait_for_labeled_deployments "${EXTERNAL_SECRETS_NAMESPACE}" app.kubernetes.io/instance=external-secrets
else
  log_info "External Secrets Operator 已关闭，跳过安装。"
fi

if [[ "${ARGOCD_ENABLED}" == "true" ]]; then
  log_section "安装 Argo CD"
  argocd_args=()
  if [[ -n "${ARGOCD_IMAGE_REPOSITORY}" ]]; then
    argocd_args+=(--set "global.image.repository=${ARGOCD_IMAGE_REPOSITORY}")
  fi
  if [[ -n "${ARGOCD_REDIS_IMAGE_REPOSITORY}" ]]; then
    argocd_args+=(--set "redis.image.repository=${ARGOCD_REDIS_IMAGE_REPOSITORY}")
  fi
  if [[ -n "${ARGOCD_REDIS_IMAGE_TAG}" ]]; then
    argocd_args+=(--set "redis.image.tag=${ARGOCD_REDIS_IMAGE_TAG}")
  fi
  helm_upgrade_install \
    argocd \
    "${ARGOCD_CHART_REF}" \
    "${ARGOCD_NAMESPACE}" \
    "${INFRA_DIR}/argocd/values.yaml" \
    "${ARGOCD_CHART_VERSION}" \
    "${argocd_args[@]}"
  wait_for_labeled_statefulsets "${ARGOCD_NAMESPACE}" app.kubernetes.io/instance=argocd
  wait_for_labeled_deployments "${ARGOCD_NAMESPACE}" app.kubernetes.io/instance=argocd
  ensure_argocd_project
  ensure_argocd_repo_secret
else
  log_info "Argo CD 已关闭，子应用发布由 Juanie worker 直接写入 K8s/Argo Rollouts。"
fi

log_section "安装 Argo Rollouts"
argo_rollouts_args=()
if [[ -n "${ARGO_ROLLOUTS_IMAGE_REGISTRY}" ]]; then
  argo_rollouts_args+=(--set "controller.image.registry=${ARGO_ROLLOUTS_IMAGE_REGISTRY}")
fi
if [[ -n "${ARGO_ROLLOUTS_IMAGE_REPOSITORY}" ]]; then
  argo_rollouts_args+=(--set "controller.image.repository=${ARGO_ROLLOUTS_IMAGE_REPOSITORY}")
fi
if [[ -n "${ARGO_ROLLOUTS_IMAGE_TAG}" ]]; then
  argo_rollouts_args+=(--set "controller.image.tag=${ARGO_ROLLOUTS_IMAGE_TAG}")
fi
helm_upgrade_install \
  argo-rollouts \
  "${ARGO_ROLLOUTS_CHART_REF}" \
  "${ARGO_ROLLOUTS_NAMESPACE}" \
  "${INFRA_DIR}/argo-rollouts/values.yaml" \
  "${ARGO_ROLLOUTS_CHART_VERSION}" \
  "${argo_rollouts_args[@]}"
wait_for_labeled_deployments "${ARGO_ROLLOUTS_NAMESPACE}" app.kubernetes.io/instance=argo-rollouts

if [[ "${CNPG_ENABLED}" == "true" ]]; then
  log_section "安装 CloudNativePG"
  cnpg_args=()
  if [[ -n "${CNPG_IMAGE_REPOSITORY}" ]]; then
    cnpg_args+=(--set "image.repository=${CNPG_IMAGE_REPOSITORY}")
  fi
  if [[ -n "${CNPG_IMAGE_TAG}" ]]; then
    cnpg_args+=(--set "image.tag=${CNPG_IMAGE_TAG}")
  fi
  helm_upgrade_install \
    cloudnative-pg \
    "${CNPG_CHART_REF}" \
    "${CNPG_NAMESPACE}" \
    "${INFRA_DIR}/cloudnative-pg/values.yaml" \
    "${CNPG_CHART_VERSION}" \
    "${cnpg_args[@]}"
  wait_for_labeled_deployments "${CNPG_NAMESPACE}" app.kubernetes.io/instance=cloudnative-pg
else
  log_info "CloudNativePG 已关闭，跳过安装。"
fi

if [[ "${BYTEBASE_ENABLED}" == "true" ]]; then
  log_section "安装 Bytebase"
  ensure_bytebase_resource_budget
  ensure_bytebase_control_plane_metadata_database

  bytebase_args=(
    --set-string "bytebase.option.external-url=$(bytebase_public_url)"
    --set-string "bytebase.option.externalPg.existingPgURLSecret=${BYTEBASE_METADATA_URL_SECRET}"
    --set-string "bytebase.option.externalPg.existingPgURLSecretKey=${BYTEBASE_METADATA_URL_SECRET_KEY}"
    --set-string "global.azure.images.bytebase.registry=${BYTEBASE_IMAGE_REGISTRY}"
    --set-string "global.azure.images.bytebase.image=${BYTEBASE_IMAGE_REPOSITORY}"
    --set-string "global.azure.images.bytebase.tag=${BYTEBASE_IMAGE_VERSION}"
    --set "bytebase.version=${BYTEBASE_IMAGE_VERSION}"
  )

  if helm_supports_executable_post_renderer; then
    bytebase_post_renderer="$(create_bytebase_post_renderer)"
    helm_upgrade_install \
      bytebase \
      "${BYTEBASE_CHART_REF}" \
      "${BYTEBASE_NAMESPACE}" \
      "${INFRA_DIR}/bytebase/values.yaml" \
      "${BYTEBASE_CHART_VERSION}" \
      "${bytebase_args[@]}" \
      --post-renderer "${bytebase_post_renderer}"
    rm -f "${bytebase_post_renderer}"
  else
    log_warn "当前 Helm 不支持可执行文件式 post-renderer，改用 no-wait 安装后立即 scale。"
    helm_upgrade_install_no_wait \
      bytebase \
      "${BYTEBASE_CHART_REF}" \
      "${BYTEBASE_NAMESPACE}" \
      "${INFRA_DIR}/bytebase/values.yaml" \
      "${BYTEBASE_CHART_VERSION}" \
      "${bytebase_args[@]}"
    kubectl scale statefulset bytebase -n "${BYTEBASE_NAMESPACE}" --replicas="${BYTEBASE_REPLICAS}"
  fi

  if (( BYTEBASE_REPLICAS > 0 )); then
    if ! wait_for_statefulset "${BYTEBASE_NAMESPACE}" bytebase; then
      wait_for_labeled_statefulsets "${BYTEBASE_NAMESPACE}" app.kubernetes.io/instance=bytebase
    fi
  else
    log_info "Bytebase 已安装为按需模式，StatefulSet replicas=0。"
  fi
else
  log_info "Bytebase 数据库控制台已关闭，跳过安装。"
fi

log_section "应用平台网关与证书资源"
apply_rendered_manifest "${INFRA_DIR}/gateway/namespace.yaml"
apply_gateway_manifest
apply_bytebase_route

if [[ "$(gateway_https_enabled)" == "true" ]]; then
  apply_rendered_manifest "${INFRA_DIR}/gateway/certificate.yaml"
else
  log_info "Gateway HTTPS listener 已关闭，跳过平台 wildcard Certificate。"
fi

if [[ "$(gateway_https_enabled)" == "true" && "${dnspod_secret_ready}" == "true" ]]; then
  log_section "等待 wildcard 证书就绪"
  wait_for_certificate
elif [[ "$(gateway_https_enabled)" == "true" ]]; then
  log_warn "由于 dnspod-secret 未创建，已跳过 wildcard 证书等待。"
fi

show_summary
