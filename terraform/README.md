
# Terraform Kubernetes Application

This project provisions a PostgreSQL database, a backend API, and a frontend app using Terraform and Kubernetes.

## Requirements

- Terraform >= 1.3
- Access to a Kubernetes cluster (via `~/.kube/config`)
- kubectl configured

## Structure

- `main.tf`: Sets up the Kubernetes provider and namespace.
- `secrets.tf`: Creates secrets for PostgreSQL authentication.
- `pvc.tf`: PersistentVolumeClaim for PostgreSQL storage.
- `postgres.tf`: PostgreSQL Deployment and Service.
- `backend.tf`: Backend Deployment and NodePort Service.
- `frontend.tf`: Frontend Deployment and NodePort Service.

## How to Use

```bash
terraform init
terraform apply
```

## Access Services

- **Backend**: `NodeIP:30519`
- **Frontend**: `NodeIP:30517`
- **PostgreSQL**: Internal access only via Kubernetes service `database:5432`

---
