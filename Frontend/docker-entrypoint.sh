#!/bin/bash

# Generate runtime environment configuration for React app

# Create the env-config.js file with environment variables
cat <<EOF > /usr/share/nginx/html/env-config.js
window._env_ = {
  REACT_APP_API_URL: "${REACT_APP_API_URL:-/api}",
  REACT_APP_DEBUG: "${REACT_APP_DEBUG:-false}",
  REACT_APP_ENV: "${REACT_APP_ENV:-production}"
};
EOF

echo "Environment configuration generated:"
cat /usr/share/nginx/html/env-config.js

# Start nginx
exec nginx -g 'daemon off;'
