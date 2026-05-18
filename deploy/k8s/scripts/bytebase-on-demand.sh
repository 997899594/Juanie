#!/usr/bin/env bash

set -euo pipefail

BYTEBASE_NAMESPACE="${BYTEBASE_NAMESPACE:-bytebase}"
BYTEBASE_STATEFULSET="${BYTEBASE_STATEFULSET:-bytebase}"
BYTEBASE_REPLICAS="${BYTEBASE_REPLICAS:-1}"
BYTEBASE_HOSTNAME="${BYTEBASE_HOSTNAME:-bytebase.juanie.art}"
BYTEBASE_START_RESOURCE_CHECK_ENABLED="${BYTEBASE_START_RESOURCE_CHECK_ENABLED:-true}"
BYTEBASE_START_MIN_AVAILABLE_MEMORY_MIB="${BYTEBASE_START_MIN_AVAILABLE_MEMORY_MIB:-1200}"

log_info() {
  echo "[INFO] $1"
}

log_warn() {
  echo "[WARN] $1" >&2
}

log_error() {
  echo "[ERROR] $1" >&2
}

require_statefulset() {
  if ! kubectl get statefulset "${BYTEBASE_STATEFULSET}" -n "${BYTEBASE_NAMESPACE}" >/dev/null 2>&1; then
    log_error "未找到 Bytebase StatefulSet: ${BYTEBASE_NAMESPACE}/${BYTEBASE_STATEFULSET}"
    log_error "先运行: BYTEBASE_ENABLED=true BYTEBASE_REPLICAS=0 bash deploy/k8s/scripts/init-server.sh"
    exit 1
  fi
}

read_meminfo_mib() {
  local key="$1"
  awk -v key="${key}:" '$1 == key { printf "%d\n", int($2 / 1024); found = 1 } END { if (!found) exit 1 }' /proc/meminfo
}

ensure_start_budget() {
  local available_mib

  if [[ "${BYTEBASE_START_RESOURCE_CHECK_ENABLED}" != "true" ]]; then
    log_warn "Bytebase 启动资源检查已关闭。"
    return
  fi

  available_mib="$(read_meminfo_mib MemAvailable)"
  if (( available_mib < BYTEBASE_START_MIN_AVAILABLE_MEMORY_MIB )); then
    log_error "当前可用内存 ${available_mib}MiB，不满足 Bytebase 启动最低 ${BYTEBASE_START_MIN_AVAILABLE_MEMORY_MIB}MiB。"
    log_error "先停止不需要的业务 Pod、扩容节点，或显式设置 BYTEBASE_START_RESOURCE_CHECK_ENABLED=false。"
    exit 1
  fi
}

start_bytebase() {
  require_statefulset
  ensure_start_budget
  kubectl scale statefulset "${BYTEBASE_STATEFULSET}" -n "${BYTEBASE_NAMESPACE}" --replicas="${BYTEBASE_REPLICAS}"
  kubectl rollout status "statefulset/${BYTEBASE_STATEFULSET}" -n "${BYTEBASE_NAMESPACE}" --timeout=10m
  log_info "Bytebase 已启动: https://${BYTEBASE_HOSTNAME}"
}

stop_bytebase() {
  require_statefulset
  kubectl scale statefulset "${BYTEBASE_STATEFULSET}" -n "${BYTEBASE_NAMESPACE}" --replicas=0
  log_info "Bytebase 已停止，metadata DB 保留。"
}

status_bytebase() {
  require_statefulset
  kubectl get statefulset "${BYTEBASE_STATEFULSET}" -n "${BYTEBASE_NAMESPACE}"
  kubectl get pods -n "${BYTEBASE_NAMESPACE}" -l app=bytebase || true
}

case "${1:-status}" in
  start)
    start_bytebase
    ;;
  stop)
    stop_bytebase
    ;;
  status)
    status_bytebase
    ;;
  *)
    log_error "用法: $0 start|stop|status"
    exit 1
    ;;
esac
