#!/bin/bash

# Generate Django Secret Key Script

generate_secret() {
    python3 -c "
import secrets
import string

# Generate a secure secret key
alphabet = string.ascii_letters + string.digits + '!@#$%^&*(-_=+)'
secret_key = 'django-secret-' + ''.join(secrets.choice(alphabet) for _ in range(50))
print(secret_key)
"
}

echo "🔐 Django Secret Key Generator"
echo "==============================="

SECRET_KEY=$(generate_secret)

echo ""
echo "Generated Secret Key:"
echo "$SECRET_KEY"
echo ""

# Create Kubernetes secret
echo "Creating Kubernetes secret..."
cat <<EOF > manifests/django-secret.yml
# Django Secret Key
apiVersion: v1
kind: Secret
metadata:
  name: django-secret
  annotations:
    argocd.argoproj.io/sync-wave: "-1"
type: Opaque
stringData:
  secret-key: "$SECRET_KEY"
EOF

echo "✅ Django secret updated in manifests/django-secret.yml"
echo ""
echo "🔄 Don't forget to:"
echo "   1. Commit the updated secret to git (if using GitOps)"
echo "   2. Apply the secret: kubectl apply -f manifests/django-secret.yml"
echo "   3. Restart the backend deployment to pick up the new secret"
