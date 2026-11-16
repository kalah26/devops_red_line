#!/bin/bash
# Rotate the Django secret key in the cluster (never written to git).
# Usage: ./generate-django-secret.sh [namespace]
set -euo pipefail

NAMESPACE="${1:-default}"
SECRET_KEY=$(python3 -c 'import secrets; print(secrets.token_urlsafe(50))')

kubectl -n "$NAMESPACE" create secret generic django-secret \
  --from-literal=secret-key="$SECRET_KEY" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "✅ django-secret updated in namespace '$NAMESPACE'"
echo "🔄 Restart the backend to pick it up: kubectl -n $NAMESPACE rollout restart deployment/backend"
