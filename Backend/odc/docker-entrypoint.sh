#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting Django application...${NC}"

# Function to wait for database
wait_for_db() {
    echo -e "${YELLOW}⏳ Waiting for database to be ready...${NC}"
    
    while ! python manage.py check --database default > /dev/null 2>&1; do
        echo -e "${YELLOW}⏳ Database is unavailable - sleeping for 2 seconds...${NC}"
        sleep 2
    done
    
    echo -e "${GREEN}✅ Database is ready!${NC}"
}

# Function to run migrations
run_migrations() {
    echo -e "${YELLOW}📝 Running database migrations...${NC}"
    
    python manage.py makemigrations --noinput
    python manage.py migrate --noinput
    
    echo -e "${GREEN}✅ Migrations completed successfully!${NC}"
}

# Function to collect static files
collect_static() {
    echo -e "${YELLOW}📦 Collecting static files...${NC}"
    
    python manage.py collectstatic --noinput --clear || {
        echo -e "${YELLOW}⚠️ Static files collection failed or not configured. Continuing...${NC}"
    }
    
    echo -e "${GREEN}✅ Static files collected!${NC}"
}

# Function to create superuser if specified
create_superuser() {
    if [ "$DJANGO_SUPERUSER_USERNAME" ] && [ "$DJANGO_SUPERUSER_EMAIL" ] && [ "$DJANGO_SUPERUSER_PASSWORD" ]; then
        echo -e "${YELLOW}👤 Creating superuser...${NC}"
        
        python manage.py shell << EOF
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(username='$DJANGO_SUPERUSER_USERNAME').exists():
    User.objects.create_superuser('$DJANGO_SUPERUSER_USERNAME', '$DJANGO_SUPERUSER_EMAIL', '$DJANGO_SUPERUSER_PASSWORD')
    print('Superuser created successfully!')
else:
    print('Superuser already exists!')
EOF
        echo -e "${GREEN}✅ Superuser setup completed!${NC}"
    fi
}

# Main execution
main() {
    echo -e "${GREEN}🐳 Django Docker Entrypoint${NC}"
    echo -e "${GREEN}================================${NC}"
    
    # Wait for database to be ready
    wait_for_db
    
    # Run migrations
    run_migrations
    
    # Collect static files
    collect_static
    
    # Create superuser if environment variables are set
    create_superuser
    
    echo -e "${GREEN}🎉 Setup completed! Starting server...${NC}"
    echo -e "${GREEN}================================${NC}"
    
    # Execute the main command (CMD from Dockerfile)
    exec "$@"
}

# Run main function with all arguments
main "$@"
