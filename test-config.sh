#!/bin/bash

echo "🧪 Testing DevOps Red Line Configuration"
echo "========================================"

# Test base configuration
echo ""
echo "📋 Testing Base Configuration..."
if kubectl kustomize manifests/base/ > /tmp/base-test.yaml; then
    echo "✅ Base configuration is valid"
    echo "   Resources: $(grep -c '^kind:' /tmp/base-test.yaml) manifests generated"
else
    echo "❌ Base configuration failed"
    exit 1
fi

# Test development overlay
echo ""
echo "🔧 Testing Development Overlay..."
if kubectl kustomize manifests/overlays/development/ > /tmp/dev-test.yaml; then
    echo "✅ Development overlay is valid"
    
    # Check if DEBUG is set to True
    if grep -q 'DEBUG: "True"' /tmp/dev-test.yaml; then
        echo "   ✅ DEBUG mode enabled for development"
    else
        echo "   ⚠️  DEBUG mode not found in development config"
    fi
    
    # Check if dev image tags are used
    if grep -q 'newTag: dev' /tmp/dev-test.yaml || grep -q 'image:.*:dev' /tmp/dev-test.yaml; then
        echo "   ✅ Development image tags configured"
    else
        echo "   ⚠️  Development image tags not found"
    fi
else
    echo "❌ Development overlay failed"
    exit 1
fi

# Test production overlay
echo ""
echo "🚀 Testing Production Overlay..."
if kubectl kustomize manifests/overlays/production/ > /tmp/prod-test.yaml; then
    echo "✅ Production overlay is valid"
    
    # Check if DEBUG is set to False
    if grep -q 'DEBUG: "False"' /tmp/prod-test.yaml; then
        echo "   ✅ DEBUG mode disabled for production"
    else
        echo "   ⚠️  DEBUG mode configuration not found in production"
    fi
    
    # Check replica counts
    FRONTEND_REPLICAS=$(grep -A 5 'name: front-app' /tmp/prod-test.yaml | grep 'replicas:' | awk '{print $2}')
    BACKEND_REPLICAS=$(grep -A 5 'name: backend' /tmp/prod-test.yaml | grep 'replicas:' | awk '{print $2}' | head -1)
    
    echo "   📊 Production replicas: Frontend($FRONTEND_REPLICAS), Backend($BACKEND_REPLICAS)"
else
    echo "❌ Production overlay failed"
    exit 1
fi

# Environment variables test
echo ""
echo "🔐 Testing Environment Variables..."

# Check ConfigMaps
BACKEND_CONFIG=$(grep -A 20 'name: backend-config' /tmp/dev-test.yaml | grep -c ': ')
FRONTEND_CONFIG=$(grep -A 20 'name: frontend-config' /tmp/dev-test.yaml | grep -c ': ')

echo "   📊 Backend config variables: $BACKEND_CONFIG"
echo "   📊 Frontend config variables: $FRONTEND_CONFIG"

# Check Secrets
if grep -q 'name: django-secret' /tmp/dev-test.yaml && grep -q 'name: postgres-credentials' /tmp/dev-test.yaml; then
    echo "   ✅ Required secrets are configured"
else
    echo "   ⚠️  Some secrets may be missing"
fi

# ArgoCD compatibility test
echo ""
echo "🔄 Testing ArgoCD Compatibility..."
if grep -q 'argocd.argoproj.io/sync-wave' /tmp/dev-test.yaml; then
    echo "   ✅ ArgoCD sync waves configured"
else
    echo "   ⚠️  ArgoCD sync waves not found"
fi

# Ingress test
echo ""
echo "🌐 Testing Ingress Configuration..."
if grep -q 'kind: Ingress' /tmp/dev-test.yaml; then
    HOST=$(grep -A 10 'kind: Ingress' /tmp/dev-test.yaml | grep 'host:' | awk '{print $2}')
    echo "   ✅ Ingress configured for host: $HOST"
    
    # Check paths
    if grep -q 'path: /' /tmp/dev-test.yaml && grep -q 'path: /api' /tmp/dev-test.yaml; then
        echo "   ✅ Frontend (/) and Backend (/api) paths configured"
    else
        echo "   ⚠️  Ingress paths may not be properly configured"
    fi
else
    echo "   ⚠️  Ingress configuration not found"
fi

echo ""
echo "🎉 Configuration Test Complete!"
echo ""
echo "Next Steps:"
echo "  1. Update repository URLs in argocd/*.yml files"
echo "  2. Build and push updated Docker images"
echo "  3. Deploy to your cluster using ArgoCD or kubectl"
echo ""
echo "Quick Deploy Commands:"
echo "  # Development:"
echo "  kubectl apply -k manifests/overlays/development/"
echo ""
echo "  # Production:"
echo "  kubectl apply -k manifests/overlays/production/"

# Cleanup
rm -f /tmp/base-test.yaml /tmp/dev-test.yaml /tmp/prod-test.yaml
