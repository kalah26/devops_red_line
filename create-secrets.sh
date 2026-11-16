#!/bin/bash
# Create the Kubernetes secrets the app needs, without committing them to git.
# Usage: POSTGRES_PASSWORD=... ./create-secrets.sh [namespace]
set -euo pipefail

NAMESPACE="${1:-default}"
: "${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD}"
POSTGRES_USER="${POSTGRES_USER:-odc}"
POSTGRES_DB="${POSTGRES_DB:-odcdb}"
DJANGO_SECRET_KEY="${DJANGO_SECRET_KEY:-$(python3 -c 'import secrets; print(secrets.token_urlsafe(50))')}"

kubectl -n "$NAMESPACE" create secret generic postgres-credentials \
  --from-literal=POSTGRES_USER="$POSTGRES_USER" \
  --from-literal=POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
  --from-literal=POSTGRES_DB="$POSTGRES_DB" \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl -n "$NAMESPACE" create secret generic django-secret \
  --from-literal=secret-key="$DJANGO_SECRET_KEY" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "✅ Secrets created in namespace '$NAMESPACE'"
