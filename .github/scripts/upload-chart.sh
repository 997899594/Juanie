#!/usr/bin/env bash

set -euo pipefail

SSH_OPTS="-o ServerAliveInterval=30 -o ServerAliveCountMax=10 -o TCPKeepAlive=yes"
CHART_ARCHIVE="/tmp/juanie-chart-${GITHUB_SHA}.tgz"
REMOTE_DIR="/tmp/juanie-deploy-${GITHUB_SHA}"

tar czf "$CHART_ARCHIVE" -C deploy/k8s/charts juanie
ssh ${SSH_OPTS} "${SERVER_USER:?SERVER_USER is required}@${SERVER_HOST:?SERVER_HOST is required}" \
  "rm -rf '${REMOTE_DIR}' && mkdir -p '${REMOTE_DIR}'"
scp ${SSH_OPTS} "$CHART_ARCHIVE" "${SERVER_USER}@${SERVER_HOST}:${REMOTE_DIR}/chart.tgz"
ssh ${SSH_OPTS} "${SERVER_USER}@${SERVER_HOST}" \
  "tar xzf '${REMOTE_DIR}/chart.tgz' -C '${REMOTE_DIR}'"
