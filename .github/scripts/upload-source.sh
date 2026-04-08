#!/usr/bin/env bash

set -euo pipefail

SSH_OPTS="-o ServerAliveInterval=30 -o ServerAliveCountMax=10 -o TCPKeepAlive=yes"
SOURCE_ARCHIVE="/tmp/juanie-source-${GITHUB_SHA}.tgz"
REMOTE_DIR="/root/juanie-deploy-${GITHUB_SHA}"

git archive --format=tar.gz --output="${SOURCE_ARCHIVE}" HEAD

ssh ${SSH_OPTS} "${SERVER_USER:?SERVER_USER is required}@${SERVER_HOST:?SERVER_HOST is required}" \
  "rm -rf '${REMOTE_DIR}' && mkdir -p '${REMOTE_DIR}/source'"
scp ${SSH_OPTS} "${SOURCE_ARCHIVE}" "${SERVER_USER}@${SERVER_HOST}:${REMOTE_DIR}/source.tgz"
ssh ${SSH_OPTS} "${SERVER_USER}@${SERVER_HOST}" \
  "tar xzf '${REMOTE_DIR}/source.tgz' -C '${REMOTE_DIR}/source'"
