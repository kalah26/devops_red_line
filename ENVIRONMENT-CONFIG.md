# Environment Variables Configuration

This document describes all environment variables used in the DevOps Red Line application.

## 🗄️ Database Configuration (Secrets)

### PostgreSQL Credentials (`postgres-credentials` secret)
| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `POSTGRES_USER` | PostgreSQL username | `odc` | Yes |
| `POSTGRES_PASSWORD` | PostgreSQL password | `odc123` | Yes |
| `POSTGRES_DB` | PostgreSQL database name | `odcdb` | Yes |

## 🔧 Backend Configuration (ConfigMap: `backend-config`)

### Django Settings
| Variable | Description | Default | Environment |
|----------|-------------|---------|-------------|
| `DEBUG` | Django debug mode | `False` | `True` (dev), `False` (prod) |
| `ALLOWED_HOSTS` | Django allowed hosts | `*` | `*` (dev), `domain.com` (prod) |
| `DJANGO_SECRET_KEY` | Django secret key | Generated | Required (from secret) |

### Database Connection
| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DB_ENGINE` | Database engine | `django.db.backends.postgresql` | Yes |
| `DB_HOST` | Database host | `database` | Yes |
| `DB_PORT` | Database port | `5432` | Yes |

### CORS Settings
| Variable | Description | Default | Notes |
|----------|-------------|---------|-------|
| `CORS_ALLOW_ALL_ORIGINS` | Allow all CORS origins | `True` | Should be `False` in production |

### Internationalization
| Variable | Description | Default |
|----------|-------------|---------|
| `LANGUAGE_CODE` | Default language | `en-us` |
| `TIME_ZONE` | Default timezone | `UTC` |
| `USE_I18N` | Enable internationalization | `True` |
| `USE_TZ` | Enable timezone support | `True` |

## 🎨 Frontend Configuration (ConfigMap: `frontend-config`)

### API Configuration
| Variable | Description | Default | Environment |
|----------|-------------|---------|-------------|
| `REACT_APP_API_URL` | Backend API URL | `/api` | Environment-specific |
| `REACT_APP_ENV` | Application environment | `production` | `development`/`production` |
| `REACT_APP_DEBUG` | Debug logging | `false` | `true` (dev), `false` (prod) |

## 🚀 Environment-Specific Values

### Development Environment
```yaml
# Backend
DEBUG: "True"
ALLOWED_HOSTS: "*"

# Frontend  
REACT_APP_API_URL: "http://devops-red-line.local/api"
REACT_APP_ENV: "development"
REACT_APP_DEBUG: "true"
```

### Production Environment
```yaml
# Backend
DEBUG: "False" 
ALLOWED_HOSTS: "devops-red-line-prod.example.com,localhost"

# Frontend
REACT_APP_API_URL: "https://devops-red-line-prod.example.com/api"
REACT_APP_ENV: "production"
REACT_APP_DEBUG: "false"
```

## 🔧 Configuration Management

### 1. Update ConfigMaps
```bash
# Edit development config
kubectl edit configmap backend-config -n default

# Edit production config  
kubectl edit configmap backend-config -n devops-red-line-prod
```

### 2. Update Secrets
```bash
# Generate new Django secret
./generate-django-secret.sh

# Update database credentials
kubectl edit secret postgres-credentials -n default
```

### 3. Apply Changes
```bash
# Restart deployments to pick up new config
kubectl rollout restart deployment/backend -n default
kubectl rollout restart deployment/front-app -n default
```

## 🛡️ Security Best Practices

### Secrets Management
- ✅ Use Kubernetes Secrets for sensitive data
- ✅ Generate unique Django secret keys
- ⚠️ Consider external secret management (Vault, Sealed Secrets)
- ⚠️ Rotate secrets regularly

### Environment Separation  
- ✅ Different configs per environment
- ✅ Production uses stronger security settings
- ✅ Debug mode disabled in production
- ✅ Specific allowed hosts in production

### CORS Configuration
- ⚠️ Production should not allow all origins
- ✅ Configure specific allowed origins for frontend domain
- ✅ Use HTTPS in production

## 🔄 Runtime Configuration (Frontend)

The frontend supports runtime environment variable injection:

### Build-time Variables
Set during `docker build` or CI/CD pipeline.

### Runtime Variables  
Set during container startup via `docker-entrypoint.sh`:

```bash
# Container environment variables are injected at runtime
docker run -e REACT_APP_API_URL="https://api.example.com" frontend:latest
```

### Configuration Loading Order
1. Runtime variables (`window._env_`)
2. Build-time variables (`process.env`)  
3. Fallback defaults

## 📋 Troubleshooting

### Backend Issues
```bash
# Check backend environment variables
kubectl exec -it deployment/backend -- env | grep -E "(DEBUG|DB_|DJANGO_)"

# Check backend logs
kubectl logs deployment/backend -f
```

### Frontend Issues  
```bash
# Check frontend environment variables
kubectl exec -it deployment/front-app -- cat /usr/share/nginx/html/env-config.js

# Check frontend logs
kubectl logs deployment/front-app -f
```

### Database Connection
```bash
# Test database connectivity
kubectl exec -it deployment/backend -- python manage.py dbshell

# Check database service
kubectl get svc database
```
