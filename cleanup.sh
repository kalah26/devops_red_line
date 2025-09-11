#!/bin/bash

# Cleanup DevOps Red Line Application from Kubernetes
echo "🧹 Cleaning up DevOps Red Line Application..."

# Remove ingress
echo "🌐 Removing ingress..."
kubectl delete -f manifests/ingress.yml --ignore-not-found=true

# Remove frontend
echo "🎨 Removing frontend..."
kubectl delete -f manifests/frontend/deployment.yml --ignore-not-found=true

# Remove backend
echo "🔧 Removing backend..."
kubectl delete -f manifests/backend/deployment.yml --ignore-not-found=true

# Remove database (keep PVC for data persistence)
echo "📊 Removing database..."
kubectl delete -f manifests/database/deployment.yml --ignore-not-found=true

# Optionally remove secrets and PVC (uncomment if you want to delete data)
# echo "⚠️  Removing secrets and persistent data..."
# kubectl delete -f manifests/database/postgres-secret.yml --ignore-not-found=true
# kubectl delete -f manifests/database/postgres-pvc.yml --ignore-not-found=true

echo "✅ Cleanup complete!"
echo ""
echo "📋 Remaining resources (PVC and secrets preserved):"
kubectl get pvc,secret | grep -E "(postgres|devops)"
