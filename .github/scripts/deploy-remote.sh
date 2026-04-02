#!/usr/bin/env bash

set -euo pipefail

SCHEMA_JOB="juanie-schema-sync-$(printf '%s' "$WEB_IMAGE_TAG" | cut -d- -f2 | cut -c1-7)"

show_failure() {
  local kind="$1"
  local name="$2"
  kubectl describe "$kind" "$name" -n juanie || true
  kubectl get pods -n juanie -o wide || true
  kubectl get events -n juanie --sort-by=.metadata.creationTimestamp | tail -n 60 || true
}

echo "Checking GHCR pull secret..."
kubectl get secret ghcr-pull-secret -n juanie >/dev/null
echo "Checking deployment baseline resources..."
kubectl get configmap juanie-config -n juanie >/dev/null
kubectl get secret juanie-secret -n juanie >/dev/null

echo "Running schema sync job..."
kubectl delete job "${SCHEMA_JOB}" -n juanie --ignore-not-found=true
kubectl wait --for=delete job/"${SCHEMA_JOB}" -n juanie --timeout=120s || true

cat <<EOF | kubectl apply -f -
apiVersion: batch/v1
kind: Job
metadata:
  name: ${SCHEMA_JOB}
  namespace: juanie
  labels:
    app.kubernetes.io/name: juanie
    app.kubernetes.io/component: schema-sync
spec:
  backoffLimit: 0
  ttlSecondsAfterFinished: 600
  template:
    metadata:
      labels:
        app.kubernetes.io/name: juanie
        app.kubernetes.io/component: schema-sync
    spec:
      restartPolicy: Never
      serviceAccountName: juanie
      imagePullSecrets:
        - name: ghcr-pull-secret
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        fsGroup: 1001
      initContainers:
        - name: wait-for-postgres
          image: busybox:1.36
          command: ['sh', '-c', 'until nc -z postgres 5432; do sleep 2; done']
      containers:
        - name: schema-sync
          image: ${MIGRATE_IMAGE}
          imagePullPolicy: IfNotPresent
          envFrom:
            - configMapRef:
                name: juanie-config
            - secretRef:
                name: juanie-secret
          securityContext:
            allowPrivilegeEscalation: false
            capabilities:
              drop: ["ALL"]
EOF

if ! kubectl wait --for=condition=complete job/"${SCHEMA_JOB}" -n juanie --timeout=45m; then
  show_failure job "${SCHEMA_JOB}"
  kubectl logs job/"${SCHEMA_JOB}" -n juanie --tail=200 || true
  exit 1
fi

kubectl logs job/"${SCHEMA_JOB}" -n juanie --tail=120 || true

echo "Deploying Helm release..."
helm upgrade --install juanie "${CHART_DIR}" \
  --namespace juanie \
  --create-namespace \
  --reset-values \
  -f "${CHART_DIR}/values-prod.yaml" \
  --set images.web.repository="${IMAGE_REPOSITORY}" \
  --set images.web.tag="${WEB_IMAGE_TAG}" \
  --set images.worker.repository="${IMAGE_REPOSITORY}" \
  --set images.worker.tag="${WORKER_IMAGE_TAG}" \
  --set images.migrate.repository="${IMAGE_REPOSITORY}" \
  --set images.migrate.tag="${MIGRATE_IMAGE_TAG}" \
  --set-string imagePullSecrets[0]=ghcr-pull-secret

for deployment in juanie-web juanie-worker juanie-scheduler; do
  echo "Waiting for ${deployment} rollout..."
  if ! kubectl rollout status deployment/"${deployment}" -n juanie --timeout=20m; then
    show_failure deployment "${deployment}"
    exit 1
  fi
done

rm -rf "$(dirname "${CHART_DIR}")"
echo "Deployment finished."
