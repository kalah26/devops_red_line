# DevOps Red Line - ArgoCD Deployment

This project is configured for GitOps deployment using ArgoCD with Kustomize overlays for different environments.

## 📁 Project Structure

```
manifests/
├── kustomization.yml           # Base Kustomization
├── ingress.yml                 # Ingress configuration
├── backend/                    # Backend manifests
├── frontend/                   # Frontend manifests  
├── database/                   # Database manifests
└── overlays/
    ├── development/            # Dev environment overlay
    └── production/             # Prod environment overlay

argocd/
├── project.yml                 # ArgoCD Project
├── application.yml             # Basic Application (deprecated)
├── application-dev.yml         # Development Application
└── application-prod.yml        # Production Application
```

## 🚀 Deployment Steps

### 1. Prerequisites
- ArgoCD installed in your cluster
- NGINX Ingress controller available
- Git repository accessible by ArgoCD

### 2. Update Repository URLs
Update the `repoURL` in all ArgoCD application manifests:
- `argocd/application-dev.yml`
- `argocd/application-prod.yml`

Replace `https://github.com/kalah26/devops_red_line.git` with your actual repository URL.

### 3. Deploy ArgoCD Project
```bash
kubectl apply -f argocd/project.yml
```

### 4. Deploy Applications

#### Development Environment (Auto-sync enabled)
```bash
kubectl apply -f argocd/application-dev.yml
```

#### Production Environment (Manual sync)
```bash
kubectl apply -f argocd/application-prod.yml
```

### 5. Access ArgoCD UI
```bash
# Port forward to ArgoCD server
kubectl port-forward svc/argocd-server -n argocd 8080:443

# Get admin password
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
```

Visit: https://localhost:8080

## 🔄 Sync Waves

The deployment uses sync waves for proper ordering:

- **Wave -1**: Secrets
- **Wave 0**: PVCs
- **Wave 1**: Database (Deployment + Service)
- **Wave 2**: Backend (Deployment + Service)  
- **Wave 3**: Frontend (Deployment + Service)
- **Wave 4**: Ingress

## 🌍 Environments

### Development
- **Namespace**: `default`
- **Replicas**: 1 for all services
- **Image Tags**: `dev`
- **Auto-sync**: Enabled
- **Branch**: `develop`

### Production
- **Namespace**: `devops-red-line-prod`
- **Replicas**: Frontend (3), Backend (2), Database (1)
- **Image Tags**: `v2`, `latest`
- **Auto-sync**: Disabled (manual deployment)
- **Branch**: `main`

## 🔧 Manual Operations

### Force Sync an Application
```bash
argocd app sync devops-red-line-dev
```

### Check Application Status
```bash
argocd app get devops-red-line-dev
```

### Rollback to Previous Version
```bash
argocd app rollback devops-red-line-dev
```

## 🏗️ Image Updates

### Development
Push to develop branch with image tag `dev` - auto-deploys.

### Production  
1. Update image tags in `manifests/overlays/production/kustomization.yml`
2. Commit to main branch
3. Manually sync in ArgoCD UI or CLI

## 🌐 Access Applications

### Development
- Frontend: `http://devops-red-line.local`
- Backend API: `http://devops-red-line.local/api`

### Production
- Frontend: `http://devops-red-line-prod.local` (update ingress host)
- Backend API: `http://devops-red-line-prod.local/api`

## 📊 Monitoring

Check application health in ArgoCD UI:
- Resource status
- Sync status  
- Application events
- Resource events

## 🔍 Troubleshooting

### Application Out of Sync
```bash
argocd app diff devops-red-line-dev
argocd app sync devops-red-line-dev
```

### Check Resource Status
```bash
kubectl get pods,svc,ingress -n default
kubectl describe pod <pod-name> -n default
```

### View ArgoCD Application Events
```bash
kubectl describe application devops-red-line-dev -n argocd
```
