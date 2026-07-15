#!/usr/bin/env bash

juanie_base_url="${JUANIE_BASE_URL:-https://juanie.art}"
juanie_oidc_audience="${JUANIE_OIDC_AUDIENCE:-juanie-ci}"

require_juanie_identity_env() {
  local name="$1"
  if [ -z "${!name:-}" ]; then
    echo "${name} is required" >&2
    return 1
  fi
}

acquire_ci_oidc_token() {
  case "${JUANIE_PROVIDER:-}" in
    github)
      require_juanie_identity_env ACTIONS_ID_TOKEN_REQUEST_URL
      require_juanie_identity_env ACTIONS_ID_TOKEN_REQUEST_TOKEN
      local separator='?'
      [[ "$ACTIONS_ID_TOKEN_REQUEST_URL" == *'?'* ]] && separator='&'
      curl -fsSL \
        -H "Authorization: Bearer ${ACTIONS_ID_TOKEN_REQUEST_TOKEN}" \
        "${ACTIONS_ID_TOKEN_REQUEST_URL}${separator}audience=${juanie_oidc_audience}" |
        jq -er '.value'
      ;;
    gitlab|gitlab-self-hosted)
      require_juanie_identity_env JUANIE_OIDC_TOKEN
      printf '%s' "$JUANIE_OIDC_TOKEN"
      ;;
    *)
      echo "Unsupported JUANIE_PROVIDER: ${JUANIE_PROVIDER:-unset}" >&2
      return 1
      ;;
  esac
}

acquire_juanie_ci_token() {
  require_juanie_identity_env JUANIE_REPOSITORY
  require_juanie_identity_env JUANIE_RELEASE_REF
  require_juanie_identity_env JUANIE_SOURCE_SHA
  require_juanie_identity_env JUANIE_EXTERNAL_RUN_ID

  local oidc_token
  local payload
  oidc_token="$(acquire_ci_oidc_token)"
  payload="$(
    printf '%s' "$oidc_token" | jq -Rsc \
      --arg repository "$JUANIE_REPOSITORY" \
      --arg ref "$JUANIE_RELEASE_REF" \
      --arg sha "$JUANIE_SOURCE_SHA" \
      --arg externalRunId "$JUANIE_EXTERNAL_RUN_ID" \
      '{idToken: ., repository: $repository, ref: $ref, sha: $sha, externalRunId: $externalRunId}'
  )"

  printf '%s' "$payload" | curl -fsSL -X POST "${juanie_base_url}/api/auth/ci/exchange" \
    -H 'Content-Type: application/json' \
    --data-binary @- |
    jq -er '.token'
}

juanie_api_json() {
  local method="$1"
  local path="$2"
  local payload="${3:-}"
  local token
  token="$(acquire_juanie_ci_token)"

  if [ -n "$payload" ]; then
    curl -fsSL -X "$method" "${juanie_base_url}${path}" \
      -H 'Content-Type: application/json' \
      -H "Authorization: Bearer ${token}" \
      -d "$payload"
    return
  fi

  curl -fsSL -X "$method" "${juanie_base_url}${path}" \
    -H 'Content-Type: application/json' \
    -H "Authorization: Bearer ${token}"
}
