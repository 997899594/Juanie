#!/usr/bin/env bash

set -euo pipefail

SSH_OPTS=(
  -o ServerAliveInterval=30
  -o ServerAliveCountMax=10
  -o TCPKeepAlive=yes
  -o ConnectTimeout=20
)
IMAGE_REGISTRY="${IMAGE_REGISTRY:?IMAGE_REGISTRY is required}"
IMAGE_REPOSITORY="${IMAGE_REPOSITORY:?IMAGE_REPOSITORY is required}"
FULL_IMAGE_REPOSITORY="${IMAGE_REGISTRY}/${IMAGE_REPOSITORY}"
WEB_IMAGE_TAG="web-${GITHUB_SHA}"
WORKER_IMAGE_TAG="worker-${GITHUB_SHA}"
REMOTE_DIR="/root/juanie-deploy-${GITHUB_SHA}"
REMOTE_CHART_ARCHIVE="${REMOTE_DIR}/juanie-chart.tgz"
REMOTE_DEPLOY_SCRIPT="${REMOTE_DIR}/deploy-remote.sh"
LOCAL_CHART_ARCHIVE="$(mktemp /tmp/juanie-chart-${GITHUB_SHA}.XXXXXX.tgz)"

trap 'rm -f "${LOCAL_CHART_ARCHIVE}"' EXIT

encode_env() {
  printf '%s' "$1" | base64 | tr -d '\n'
}

retry() {
  local attempts="$1"
  shift

  local attempt=1
  local delay=5

  until "$@"; do
    if (( attempt >= attempts )); then
      return 1
    fi

    sleep "${delay}"
    attempt=$((attempt + 1))
  done
}

tar -czf "${LOCAL_CHART_ARCHIVE}" -C deploy/k8s/charts juanie

retry 6 ssh "${SSH_OPTS[@]}" "${SERVER_USER:?SERVER_USER is required}@${SERVER_HOST:?SERVER_HOST is required}" \
  "rm -rf '${REMOTE_DIR}' && mkdir -p '${REMOTE_DIR}'"
retry 6 scp "${SSH_OPTS[@]}" "${LOCAL_CHART_ARCHIVE}" \
  "${SERVER_USER}@${SERVER_HOST}:${REMOTE_CHART_ARCHIVE}"
retry 6 scp "${SSH_OPTS[@]}" ".github/scripts/deploy-remote.sh" \
  "${SERVER_USER}@${SERVER_HOST}:${REMOTE_DEPLOY_SCRIPT}"

retry 6 ssh "${SSH_OPTS[@]}" "${SERVER_USER:?SERVER_USER is required}@${SERVER_HOST:?SERVER_HOST is required}" \
  "IMAGE_REGISTRY_B64='$(encode_env "${IMAGE_REGISTRY}")' FULL_IMAGE_REPOSITORY_B64='$(encode_env "${FULL_IMAGE_REPOSITORY}")' WEB_IMAGE_TAG_B64='$(encode_env "${WEB_IMAGE_TAG}")' WORKER_IMAGE_TAG_B64='$(encode_env "${WORKER_IMAGE_TAG}")' REMOTE_DIR_B64='$(encode_env "${REMOTE_DIR}")' bash '${REMOTE_DEPLOY_SCRIPT}'"
