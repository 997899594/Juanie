#!/usr/bin/env bash

set -euo pipefail

SSH_OPTS="-o ServerAliveInterval=30 -o ServerAliveCountMax=10 -o TCPKeepAlive=yes"
IMAGE_PULL_SECRET_NAME="${DEPLOY_REGISTRY_PULL_SECRET_NAME:?DEPLOY_REGISTRY_PULL_SECRET_NAME is required}"
IMAGE_REPOSITORY="${DEPLOY_REGISTRY:?DEPLOY_REGISTRY is required}/${IMAGE_NAME:?IMAGE_NAME is required}"
WEB_IMAGE_TAG="web-${GITHUB_SHA}"
WORKER_IMAGE_TAG="worker-${GITHUB_SHA}"
MIGRATE_IMAGE_TAG="migrate-${GITHUB_SHA}"
REMOTE_DIR="/tmp/juanie-deploy-${GITHUB_SHA}"
SOURCE_DIR="${REMOTE_DIR}/source"
CHART_DIR="${SOURCE_DIR}/deploy/k8s/charts/juanie"

encode_env() {
  printf '%s' "$1" | base64 | tr -d '\n'
}

ssh ${SSH_OPTS} "${SERVER_USER:?SERVER_USER is required}@${SERVER_HOST:?SERVER_HOST is required}" \
  "DEPLOY_REGISTRY_B64='$(encode_env "${DEPLOY_REGISTRY}")' IMAGE_REPOSITORY_B64='$(encode_env "${IMAGE_REPOSITORY}")' WEB_IMAGE_TAG_B64='$(encode_env "${WEB_IMAGE_TAG}")' WORKER_IMAGE_TAG_B64='$(encode_env "${WORKER_IMAGE_TAG}")' MIGRATE_IMAGE_TAG_B64='$(encode_env "${MIGRATE_IMAGE_TAG}")' IMAGE_PULL_SECRET_NAME_B64='$(encode_env "${IMAGE_PULL_SECRET_NAME}")' REGISTRY_USERNAME_B64='$(encode_env "${DEPLOY_REGISTRY_USERNAME:?DEPLOY_REGISTRY_USERNAME is required}")' REGISTRY_PASSWORD_B64='$(encode_env "${DEPLOY_REGISTRY_PASSWORD:?DEPLOY_REGISTRY_PASSWORD is required}")' SOURCE_DIR_B64='$(encode_env "${SOURCE_DIR}")' CHART_DIR_B64='$(encode_env "${CHART_DIR}")' bash -s" \
  < .github/scripts/deploy-remote.sh
