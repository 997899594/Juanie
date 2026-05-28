#!/usr/bin/env bash
set -euo pipefail

: "${JUANIE_TOKEN:?JUANIE_TOKEN is required}"
: "${JUANIE_RELEASE_ID:?JUANIE_RELEASE_ID is required}"
: "${JUANIE_REPOSITORY:?JUANIE_REPOSITORY is required}"
: "${JUANIE_RELEASE_SERVICES_JSON:?JUANIE_RELEASE_SERVICES_JSON is required}"
: "${JUANIE_BASE_URL:=https://juanie.art}"

deliverables_file="${JUANIE_DELIVERABLES_FILE:-.juanie-deliverables.json}"

ruby <<'RUBY' > "$deliverables_file"
require 'json'
require 'yaml'

config = YAML.load_file('juanie.yaml') || {}
deliverables = Array(config['deliverables'])

result = deliverables.flat_map do |deliverable|
  source = deliverable.dig('source', 'service').to_s.strip
  raise "deliverable #{deliverable['name']} must declare source.service" if source.empty?

  Array(deliverable['variants']).map do |variant|
    extract = variant['extract'] || {}
    from = extract['from'].to_s.strip
    if from.empty?
      raise "deliverable #{deliverable['name']} variant #{variant['name']} must declare extract.from"
    end

    {
      name: deliverable['name'],
      type: deliverable['type'],
      sourceService: source,
      variant: {
        name: variant['name'],
        platform: variant['platform'] || variant.dig('package', 'platform') || 'any',
        extract: {
          from: from,
          to: extract['to'] || '.',
        },
        package: {
          format: variant.dig('package', 'format') || 'tgz',
        },
        checks: Array(variant['checks']),
      },
    }
  end
end

puts JSON.generate(result)
RUBY

if [ "$(jq 'length' "$deliverables_file")" -eq 0 ]; then
  echo "No delivery artifacts configured"
  exit 0
fi

mkdir -p .juanie/deliverables

while IFS= read -r deliverable; do
  name="$(jq -r '.name' <<<"$deliverable")"
  kind="$(jq -r '.type' <<<"$deliverable")"
  source_service="$(jq -r '.sourceService' <<<"$deliverable")"
  variant="$(jq -r '.variant.name' <<<"$deliverable")"
  platform="$(jq -r '.variant.platform // "any"' <<<"$deliverable")"
  format="$(jq -r '.variant.package.format // "tgz"' <<<"$deliverable")"
  extract_from="$(jq -r '.variant.extract.from' <<<"$deliverable")"
  extract_to="$(jq -r '.variant.extract.to // "."' <<<"$deliverable")"

  image="$(jq -r --arg name "$source_service" '.[] | select(.name == $name) | .image' <<<"$JUANIE_RELEASE_SERVICES_JSON")"
  if [ -z "$image" ] || [ "$image" = "null" ]; then
    echo "No built image found for deliverable source service: ${source_service}"
    exit 1
  fi

  digest="$(docker buildx imagetools inspect "$image" --format '{{json .Manifest}}' | jq -r '.digest // empty')"
  if [ -z "$digest" ] || [ "$digest" = "null" ]; then
    if [ "$platform" = "any" ]; then
      digest="$(docker buildx imagetools inspect "$image" --raw | jq -r '.manifests[0].digest // .digest // empty')"
    else
      os="${platform%%/*}"
      architecture="${platform#*/}"
      architecture="${architecture%%/*}"
      digest="$(
        docker buildx imagetools inspect "$image" --raw |
          jq -r --arg os "$os" --arg architecture "$architecture" \
            '.manifests[]? | select(.platform.os == $os and .platform.architecture == $architecture) | .digest' |
          head -n 1
      )"
    fi
  fi
  if [ -z "$digest" ] || [ "$digest" = "null" ]; then
    echo "Unable to resolve image digest for ${image}"
    exit 1
  fi

  image_ref="${image%@*}@${digest}"
  safe_name="$(printf '%s' "$name" | tr -cs 'A-Za-z0-9_.-' '-')"
  safe_variant="$(printf '%s' "$variant" | tr -cs 'A-Za-z0-9_.-' '-')"
  safe_platform="$(printf '%s' "$platform" | tr -cs 'A-Za-z0-9_.-' '-')"
  stage=".juanie/deliverables/${safe_name}-${safe_variant}-${safe_platform}/stage"
  archive_base=".juanie/deliverables/${safe_name}-${safe_variant}-${safe_platform}"

  rm -rf "$archive_base"
  mkdir -p "$stage"

  if [ "$platform" = "any" ]; then
    container_id="$(docker create "$image_ref")"
  else
    container_id="$(docker create --platform "$platform" "$image_ref")"
  fi
  trap 'docker rm -f "$container_id" >/dev/null 2>&1 || true' EXIT
  mkdir -p "$stage/$extract_to"
  docker cp "${container_id}:${extract_from}" "$stage/$extract_to"
  docker rm -f "$container_id" >/dev/null
  trap - EXIT

  if [ -z "$(find "$stage" -mindepth 1 -print -quit)" ]; then
    echo "Extracted artifact stage is empty: ${name}/${variant}"
    exit 1
  fi

  export JUANIE_ARTIFACT_STAGE="$PWD/$stage"
  checks="$(jq -r '.variant.checks // [] | .[].command' <<<"$deliverable")"
  while IFS= read -r check_command; do
    [ -z "$check_command" ] && continue
    bash -lc "$check_command"
  done <<< "$checks"

  mkdir -p "$archive_base"
  case "$format" in
    tgz|tar.gz)
      archive="${archive_base}/${safe_name}-${safe_variant}-${safe_platform}.tar.gz"
      tar -czf "$archive" -C "$stage" .
      ;;
    zip)
      archive="${archive_base}/${safe_name}-${safe_variant}-${safe_platform}.zip"
      (cd "$stage" && zip -qr "$OLDPWD/$archive" .)
      ;;
    *)
      echo "Unsupported managed delivery artifact format: ${format}"
      exit 1
      ;;
  esac

  checksum="$(sha256sum "$archive" | awk '{print $1}')"
  size_bytes="$(wc -c < "$archive" | tr -d ' ')"
  upload_payload="$(
    jq -cn \
      --arg repository "$JUANIE_REPOSITORY" \
      --arg releaseId "$JUANIE_RELEASE_ID" \
      --arg name "$name" \
      --arg variant "$variant" \
      --arg platform "$platform" \
      --arg format "$format" \
      '{
        repository: $repository,
        releaseId: $releaseId,
        name: $name,
        variant: $variant,
        platform: $platform,
        format: $format,
        contentType: "application/octet-stream"
      }'
  )"
  upload_response="$(
    curl -fsSL -X POST "${JUANIE_BASE_URL}/api/artifacts/uploads" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer ${JUANIE_TOKEN}" \
      -d "$upload_payload"
  )"
  upload_url="$(jq -r '.upload.uploadUrl' <<<"$upload_response")"
  artifact_uri="$(jq -r '.upload.uri' <<<"$upload_response")"

  curl -fsSL -X PUT "$upload_url" \
    -H "Content-Type: application/octet-stream" \
    --upload-file "$archive"

  register_payload="$(
    jq -cn \
      --arg repository "$JUANIE_REPOSITORY" \
      --arg kind "$kind" \
      --arg name "$name" \
      --arg variant "$variant" \
      --arg platform "$platform" \
      --arg format "$format" \
      --arg uri "$artifact_uri" \
      --arg checksum "sha256:${checksum}" \
      --arg sourceService "$source_service" \
      --arg sourceImageUri "$image" \
      --arg sourceImageDigest "$digest" \
      --arg sourceImagePlatform "$platform" \
      --argjson sizeBytes "$size_bytes" \
      '{
        repository: $repository,
        artifacts: [
          {
            kind: $kind,
            name: $name,
            variant: $variant,
            platform: $platform,
            format: $format,
            uri: $uri,
            checksum: $checksum,
            sizeBytes: $sizeBytes,
            sourceService: $sourceService,
            sourceImageUri: $sourceImageUri,
            sourceImageDigest: $sourceImageDigest,
            sourceImagePlatform: $sourceImagePlatform
          }
        ]
      }'
  )"

  curl -fsSL -X POST "${JUANIE_BASE_URL}/api/releases/${JUANIE_RELEASE_ID}/artifacts" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${JUANIE_TOKEN}" \
    -d "$register_payload"
done < <(jq -c '.[]' "$deliverables_file")
