#!/bin/bash

# Deploy DevOps Red Line Application to Kubernetes
echo "🚀 Deploying DevOps Red Line Application..."

# Apply database resources first
echo "📊 Deploying database components..."
kubectl apply -f manifests/database/postgres-secret.yml
kubectl apply -f manifests/database/postgres-pvc.yml
kubectl apply -f manifests/database/deployment.yml

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
kubectl wait --for=condition=ready pod -l app=postgres --timeout=300s

# Deploy backend
echo "🔧 Deploying backend..."
kubectl apply -f manifests/backend/deployment.yml

# Wait for backend to be ready
echo "⏳ Waiting for backend to be ready..."
kubectl wait --for=condition=ready pod -l app=backend --timeout=300s

# Deploy frontend
echo "🎨 Deploying frontend..."
kubectl apply -f manifests/frontend/deployment.yml

# Wait for frontend to be ready
echo "⏳ Waiting for frontend to be ready..."
kubectl wait --for=condition=ready pod -l app=front-app --timeout=300s

# Deploy ingress
echo "🌐 Deploying ingress..."
kubectl apply -f manifests/ingress.yml

echo "✅ Deployment complete!"
echo ""
echo "📋 Application Status:"
kubectl get pods,svc,ingress

echo ""
echo "🌐 Access your application:"
echo "Add this to your /etc/hosts file:"
echo "$(kubectl get ingress devops-red-line-ingress -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo 'INGRESS_IP') devops-red-line.local"
echo ""
echo "Then visit: http://devops-red-line.local"
echo "API endpoint: http://devops-red-line.local/api"
