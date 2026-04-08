#!/usr/bin/env bash

set -euo pipefail

mkdir -p ~/.ssh
printf '%s\n' "${SSH_PRIVATE_KEY:?SSH_PRIVATE_KEY is required}" > ~/.ssh/id_ed25519
chmod 600 ~/.ssh/id_ed25519
touch ~/.ssh/known_hosts
chmod 600 ~/.ssh/known_hosts

cat > ~/.ssh/config <<EOF
Host ${SERVER_HOST:?SERVER_HOST is required}
  HostName ${SERVER_HOST}
  IdentityFile ~/.ssh/id_ed25519
  IdentitiesOnly yes
  ServerAliveInterval 30
  ServerAliveCountMax 10
  TCPKeepAlive yes
  ConnectTimeout 20
  StrictHostKeyChecking accept-new
  UserKnownHostsFile ~/.ssh/known_hosts
EOF

chmod 600 ~/.ssh/config
