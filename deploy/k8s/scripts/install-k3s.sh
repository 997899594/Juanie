#!/usr/bin/env bash

set -euo pipefail

K3S_VERSION="${K3S_VERSION:-v1.30.6+k3s1}"
K3S_INSTALL_URL="${K3S_INSTALL_URL:-https://rancher-mirror.rancher.cn/k3s/k3s-install.sh}"
K3S_INSTALL_MIRROR="${K3S_INSTALL_MIRROR:-cn}"
K3S_SYSTEM_DEFAULT_REGISTRY="${K3S_SYSTEM_DEFAULT_REGISTRY:-registry.cn-hangzhou.aliyuncs.com}"
K3S_PAUSE_IMAGE="${K3S_PAUSE_IMAGE:-${K3S_SYSTEM_DEFAULT_REGISTRY}/rancher/mirrored-pause:3.6}"
K3S_DISABLE_COMPONENTS="${K3S_DISABLE_COMPONENTS:-traefik,servicelb}"
K3S_WRITE_KUBECONFIG_MODE="${K3S_WRITE_KUBECONFIG_MODE:-0644}"
K3S_REGISTRY_MIRROR_ENDPOINTS="${K3S_REGISTRY_MIRROR_ENDPOINTS:-}"
K3S_REINSTALL="${K3S_REINSTALL:-false}"
K3S_DRY_RUN="${K3S_DRY_RUN:-false}"
K3S_WAIT_TIMEOUT="${K3S_WAIT_TIMEOUT:-10m}"
K3S_NODE_IP="${K3S_NODE_IP:-}"
K3S_NETWORK_PROFILE="${K3S_NETWORK_PROFILE:-flannel-nodeport}"

CILIUM_VERSION="${CILIUM_VERSION:-1.19.3}"
CILIUM_HELM_REPO_URL="${CILIUM_HELM_REPO_URL:-https://helm.cilium.io}"
CILIUM_CHART_REF="${CILIUM_CHART_REF:-cilium/cilium}"
CILIUM_NAMESPACE="${CILIUM_NAMESPACE:-kube-system}"
CILIUM_OPERATOR_REPLICAS="${CILIUM_OPERATOR_REPLICAS:-1}"
CILIUM_GATEWAY_API_VERSION="${CILIUM_GATEWAY_API_VERSION:-v1.4.0}"
CILIUM_GATEWAY_API_URL="${CILIUM_GATEWAY_API_URL:-https://github.com/kubernetes-sigs/gateway-api/releases/download/${CILIUM_GATEWAY_API_VERSION}/standard-install.yaml}"
CILIUM_IMAGE_REPOSITORY="${CILIUM_IMAGE_REPOSITORY:-}"
CILIUM_OPERATOR_IMAGE_REPOSITORY="${CILIUM_OPERATOR_IMAGE_REPOSITORY:-}"
CILIUM_ENVOY_IMAGE_REPOSITORY="${CILIUM_ENVOY_IMAGE_REPOSITORY:-}"
CILIUM_GATEWAY_HOST_NETWORK_ENABLED="${CILIUM_GATEWAY_HOST_NETWORK_ENABLED:-true}"

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

require_command() {
  local command_name="$1"
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    log_error "缺少必要命令: ${command_name}"
    exit 1
  fi
}

require_root() {
  if [[ "$(id -u)" != "0" ]]; then
    log_error "请使用 root 运行，K3s 需要写入 /etc/rancher/k3s 与 systemd。"
    exit 1
  fi
}

is_cilium_profile() {
  [[ "${K3S_NETWORK_PROFILE}" == "cilium-gateway" ]]
}

is_local_chart_ref() {
  local chart_ref="$1"
  [[ "${chart_ref}" == /* || "${chart_ref}" == ./* || "${chart_ref}" == ../* || "${chart_ref}" == *.tgz ]]
}

is_oci_chart_ref() {
  local chart_ref="$1"
  [[ "${chart_ref}" == oci://* ]]
}

validate_network_profile() {
  case "${K3S_NETWORK_PROFILE}" in
    flannel-nodeport | cilium-gateway)
      return
      ;;
    *)
      log_error "未知 K3s 网络 profile: ${K3S_NETWORK_PROFILE}"
      log_error "可选值: flannel-nodeport, cilium-gateway"
      exit 1
      ;;
  esac
}

detect_node_ip() {
  if [[ -n "${K3S_NODE_IP}" ]]; then
    printf '%s\n' "${K3S_NODE_IP}"
    return
  fi

  local detected_ip
  detected_ip="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for (i=1; i<=NF; i++) if ($i == "src") {print $(i+1); exit}}')"
  if [[ -z "${detected_ip}" ]]; then
    detected_ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  fi

  if [[ -z "${detected_ip}" ]]; then
    log_error "无法自动识别节点 IP，请设置 K3S_NODE_IP。"
    exit 1
  fi

  printf '%s\n' "${detected_ip}"
}

is_cgroup_v1() {
  [[ "$(uname -s)" == "Linux" ]] || return 1
  [[ -f /sys/fs/cgroup/cgroup.controllers ]] && return 1
  return 0
}

cleanup_cilium_links() {
  if ! is_cilium_profile; then
    return
  fi

  local link_name
  for link_name in cilium_host cilium_net cilium_vxlan; do
    if [[ "${K3S_DRY_RUN}" == "true" ]]; then
      log_info "dry-run: 将尝试删除历史 Cilium 网络接口 ${link_name}"
      continue
    fi

    ip link delete "${link_name}" >/dev/null 2>&1 || true
  done
}

ensure_clean_existing_k3s() {
  if ! systemctl list-unit-files k3s.service >/dev/null 2>&1 && [[ ! -d /etc/rancher/k3s ]]; then
    return
  fi

  if [[ "${K3S_REINSTALL}" != "true" ]]; then
    log_error "检测到已有 K3s。若确认要重装，请显式设置 K3S_REINSTALL=true 后再运行。"
    exit 1
  fi

  if [[ "${K3S_DRY_RUN}" == "true" ]]; then
    log_info "dry-run: 将执行 /usr/local/bin/k3s-uninstall.sh"
    return
  fi

  if [[ -x /usr/local/bin/k3s-uninstall.sh ]]; then
    /usr/local/bin/k3s-uninstall.sh
    cleanup_cilium_links
  else
    log_error "检测到已有 K3s，但未找到 /usr/local/bin/k3s-uninstall.sh，拒绝继续。"
    exit 1
  fi
}

write_k3s_config() {
  local node_ip="$1"
  local config_dir="/etc/rancher/k3s"
  local disable_list
  local profile_config

  disable_list="$(printf '%s' "${K3S_DISABLE_COMPONENTS}" | tr ',' '\n')"
  if is_cilium_profile; then
    profile_config='
flannel-backend: none
disable-network-policy: true
disable-kube-proxy: true'
  else
    profile_config=''
  fi

  if [[ "${K3S_DRY_RUN}" == "true" ]]; then
    log_info "dry-run: 将写入 ${config_dir}/config.yaml"
    cat <<EOF
disable:
$(printf '%s\n' "${disable_list}" | sed 's/^/  - /')

node-ip: ${node_ip}
advertise-address: ${node_ip}
tls-san:
  - ${node_ip}
write-kubeconfig-mode: "${K3S_WRITE_KUBECONFIG_MODE}"

system-default-registry: ${K3S_SYSTEM_DEFAULT_REGISTRY}
pause-image: ${K3S_PAUSE_IMAGE}
${profile_config}
EOF
    return
  fi

  mkdir -p "${config_dir}"
  cat >"${config_dir}/config.yaml" <<EOF
disable:
$(printf '%s\n' "${disable_list}" | sed 's/^/  - /')

node-ip: ${node_ip}
advertise-address: ${node_ip}
tls-san:
  - ${node_ip}
write-kubeconfig-mode: "${K3S_WRITE_KUBECONFIG_MODE}"

system-default-registry: ${K3S_SYSTEM_DEFAULT_REGISTRY}
pause-image: ${K3S_PAUSE_IMAGE}
${profile_config}
EOF
}

write_registries_config() {
  if [[ -z "${K3S_REGISTRY_MIRROR_ENDPOINTS}" ]]; then
    return
  fi

  local config_dir="/etc/rancher/k3s"
  local endpoint

  if [[ "${K3S_DRY_RUN}" == "true" ]]; then
    log_info "dry-run: 将写入 ${config_dir}/registries.yaml"
    cat <<EOF
mirrors:
  docker.io:
    endpoint:
EOF
    IFS=',' read -ra endpoints <<<"${K3S_REGISTRY_MIRROR_ENDPOINTS}"
    for endpoint in "${endpoints[@]}"; do
      endpoint="$(printf '%s' "${endpoint}" | xargs)"
      [[ -n "${endpoint}" ]] && printf '      - "%s"\n' "${endpoint}"
    done
    return
  fi

  mkdir -p "${config_dir}"
  cat >"${config_dir}/registries.yaml" <<EOF
mirrors:
  docker.io:
    endpoint:
EOF
  IFS=',' read -ra endpoints <<<"${K3S_REGISTRY_MIRROR_ENDPOINTS}"
  for endpoint in "${endpoints[@]}"; do
    endpoint="$(printf '%s' "${endpoint}" | xargs)"
    [[ -n "${endpoint}" ]] && printf '      - "%s"\n' "${endpoint}" >>"${config_dir}/registries.yaml"
  done
}

install_k3s() {
  if [[ "${K3S_DRY_RUN}" == "true" ]]; then
    log_info "dry-run: 将通过 ${K3S_INSTALL_URL} 安装 ${K3S_VERSION}"
    return
  fi

  curl -sfL "${K3S_INSTALL_URL}" | \
    INSTALL_K3S_MIRROR="${K3S_INSTALL_MIRROR}" \
    INSTALL_K3S_VERSION="${K3S_VERSION}" \
    sh -
}

configure_kubectl() {
  export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
}

install_gateway_api_crds() {
  if ! is_cilium_profile; then
    return
  fi

  log_section "安装 Gateway API CRDs"
  if [[ "${K3S_DRY_RUN}" == "true" ]]; then
    log_info "dry-run: kubectl apply --server-side -f ${CILIUM_GATEWAY_API_URL}"
    return
  fi

  kubectl apply --server-side -f "${CILIUM_GATEWAY_API_URL}"
}

install_cilium() {
  if ! is_cilium_profile; then
    return
  fi

  log_section "安装 Cilium"
  local helm_args=(
    --namespace "${CILIUM_NAMESPACE}"
    --wait
    --timeout "${K3S_WAIT_TIMEOUT}"
    --set kubeProxyReplacement=true
    --set k8sServiceHost="${1}"
    --set k8sServicePort=6443
    --set gatewayAPI.enabled=true
    --set gatewayAPI.hostNetwork.enabled="${CILIUM_GATEWAY_HOST_NETWORK_ENABLED}"
    --set l7Proxy=true
    --set operator.replicas="${CILIUM_OPERATOR_REPLICAS}"
  )

  if ! is_local_chart_ref "${CILIUM_CHART_REF}" && [[ -n "${CILIUM_VERSION}" ]]; then
    helm_args+=(--version "${CILIUM_VERSION}")
  fi

  if [[ -n "${CILIUM_IMAGE_REPOSITORY}" ]]; then
    helm_args+=(--set "image.repository=${CILIUM_IMAGE_REPOSITORY}")
  fi
  if [[ -n "${CILIUM_OPERATOR_IMAGE_REPOSITORY}" ]]; then
    helm_args+=(--set "operator.image.repository=${CILIUM_OPERATOR_IMAGE_REPOSITORY}")
  fi
  if [[ -n "${CILIUM_ENVOY_IMAGE_REPOSITORY}" ]]; then
    helm_args+=(--set "envoy.image.repository=${CILIUM_ENVOY_IMAGE_REPOSITORY}")
  fi

  if [[ "${K3S_DRY_RUN}" == "true" ]]; then
    cat <<EOF
dry-run: helm repo add cilium ${CILIUM_HELM_REPO_URL}
dry-run: helm upgrade --install cilium ${CILIUM_CHART_REF} \\
  --namespace ${CILIUM_NAMESPACE} \\
  --version ${CILIUM_VERSION} \\
  --set kubeProxyReplacement=true \\
  --set k8sServiceHost=<node-ip> \\
  --set k8sServicePort=6443 \\
  --set gatewayAPI.enabled=true \\
  --set gatewayAPI.hostNetwork.enabled=${CILIUM_GATEWAY_HOST_NETWORK_ENABLED} \\
  --set l7Proxy=true \\
  --set operator.replicas=${CILIUM_OPERATOR_REPLICAS}
EOF
    if [[ -n "${CILIUM_IMAGE_REPOSITORY}${CILIUM_OPERATOR_IMAGE_REPOSITORY}${CILIUM_ENVOY_IMAGE_REPOSITORY}" ]]; then
      log_info "dry-run: 将使用自定义 Cilium 镜像仓库覆盖。"
    fi
    return
  fi

  if ! is_local_chart_ref "${CILIUM_CHART_REF}" && ! is_oci_chart_ref "${CILIUM_CHART_REF}"; then
    helm repo add cilium "${CILIUM_HELM_REPO_URL}" >/dev/null 2>&1 || \
      helm repo add cilium "${CILIUM_HELM_REPO_URL}" --force-update >/dev/null
    helm repo update cilium >/dev/null
  fi

  helm upgrade --install cilium "${CILIUM_CHART_REF}" \
    "${helm_args[@]}"
}

wait_for_cilium() {
  if ! is_cilium_profile || [[ "${K3S_DRY_RUN}" == "true" ]]; then
    return
  fi

  log_section "等待 Cilium 就绪"
  kubectl rollout status daemonset/cilium -n "${CILIUM_NAMESPACE}" --timeout="${K3S_WAIT_TIMEOUT}"
  kubectl rollout status deployment/cilium-operator -n "${CILIUM_NAMESPACE}" --timeout="${K3S_WAIT_TIMEOUT}"
  kubectl get gatewayclass cilium
}

wait_for_cluster() {
  if [[ "${K3S_DRY_RUN}" == "true" ]]; then
    return
  fi

  configure_kubectl

  log_section "等待 K3s 节点就绪"
  kubectl wait --for=condition=Ready nodes --all --timeout="${K3S_WAIT_TIMEOUT}"

  log_section "等待 kube-system 基础 Pod 就绪"
  kubectl wait --for=condition=Ready pods --all -n kube-system --timeout="${K3S_WAIT_TIMEOUT}"
}

show_summary() {
  if [[ "${K3S_DRY_RUN}" == "true" ]]; then
    return
  fi

  log_section "K3s 安装完成"
  kubectl get nodes -o wide
  kubectl get pods -A -o wide
  ss -tulpen | grep -E ':80|:443|:6443|:10250|:8472|:31080' || true
}

main() {
  validate_network_profile
  require_command curl
  if [[ -z "${K3S_NODE_IP}" || ("${K3S_DRY_RUN}" != "true" && "${K3S_NETWORK_PROFILE}" == "cilium-gateway") ]]; then
    require_command ip
  fi

  if [[ "${K3S_DRY_RUN}" != "true" ]]; then
    require_root
    require_command systemctl
    if is_cilium_profile; then
      require_command helm
      require_command kubectl
    fi
  fi

  local node_ip
  node_ip="$(detect_node_ip)"

  log_section "Juanie K3s Host Bootstrap"
  log_info "K3s version: ${K3S_VERSION}"
  log_info "node-ip: ${node_ip}"
  log_info "system-default-registry: ${K3S_SYSTEM_DEFAULT_REGISTRY}"
  log_info "pause-image: ${K3S_PAUSE_IMAGE}"
  log_info "disabled components: ${K3S_DISABLE_COMPONENTS}"
  log_info "network profile: ${K3S_NETWORK_PROFILE}"
  if is_cilium_profile; then
    log_info "Cilium version: ${CILIUM_VERSION}"
    log_info "Gateway API CRDs: ${CILIUM_GATEWAY_API_URL}"
  fi

  if is_cgroup_v1; then
    log_warn "检测到 cgroup v1；当前默认 K3s 版本固定为 ${K3S_VERSION}，用于兼容 Rocky Linux 8 这类老内核宿主机。"
  fi

  ensure_clean_existing_k3s
  write_k3s_config "${node_ip}"
  write_registries_config
  install_k3s
  configure_kubectl
  install_gateway_api_crds
  install_cilium "${node_ip}"
  wait_for_cilium
  wait_for_cluster
  show_summary
}

main "$@"
