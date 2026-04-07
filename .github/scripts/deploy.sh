#!/usr/bin/env bash

set -euo pipefail

SSH_OPTS="-o ServerAliveInterval=30 -o ServerAliveCountMax=10 -o TCPKeepAlive=yes"

IMAGE_REPOSITORY="${DEPLOY_REGISTRY:?DEPLOY_REGISTRY is required}/${IMAGE_NAME:?IMAGE_NAME is required}"
WEB_IMAGE="${IMAGE_REPOSITORY}:web-${GITHUB_SHA}"
WORKER_IMAGE="${IMAGE_REPOSITORY}:worker-${GITHUB_SHA}"

ssh ${SSH_OPTS} "${SERVER_USER:?SERVER_USER is required}@${SERVER_HOST:?SERVER_HOST is required}" \
  "WEB_IMAGE='${WEB_IMAGE}' WORKER_IMAGE='${WORKER_IMAGE}' bash -s" \
  < .github/scripts/deploy-remote.sh
