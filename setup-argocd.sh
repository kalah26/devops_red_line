#!/bin/bash

# Deploy DevOps Red Line Application to ArgoCD
echo "🚀 Setting up DevOps Red Line in ArgoCD..."

# Check if ArgoCD is available
if ! kubectl get namespace argocd &> /dev/null; then
    echo "❌ ArgoCD namespace not found. Please install ArgoCD first."
    echo "Installation command: kubectl create namespace argocd && kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml"
    exit 1
fi

# Get current repository URL
REPO_URL=$(git config --get remote.origin.url)
if [ -z "$REPO_URL" ]; then
    echo "❌ Could not determine repository URL. Please set it manually in the application files."
    exit 1
fi

echo "📍 Using repository: $REPO_URL"

# Update repository URLs in application manifests
echo "🔄 Updating repository URLs..."
sed -i "s|https://github.com/kalah26/devops_red_line.git|$REPO_URL|g" argocd/application-dev.yml
sed -i "s|https://github.com/kalah26/devops_red_line.git|$REPO_URL|g" argocd/application-prod.yml

# Create ArgoCD project
echo "📁 Creating ArgoCD project..."
kubectl apply -f argocd/project.yml

# Create development application
echo "🛠️  Creating development application..."
kubectl apply -f argocd/application-dev.yml

# Ask if user wants to create production application
read -p "Do you want to create the production application? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🏭 Creating production application..."
    kubectl apply -f argocd/application-prod.yml
else
    echo "⏭️  Skipping production application creation."
fi

echo ""
echo "✅ ArgoCD setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Access ArgoCD UI:"
echo "   kubectl port-forward svc/argocd-server -n argocd 8080:443"
echo ""
echo "2. Get admin password:"
echo "   kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d"
echo ""
echo "3. Visit: https://localhost:8080"
echo ""
echo "4. Applications created:"
echo "   - devops-red-line-dev (auto-sync enabled)"
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "   - devops-red-line-prod (manual sync)"
fi
echo ""
echo "5. Check application status:"
echo "   kubectl get applications -n argocd"
