#!/bin/bash

# Build script for email monitor Docker container

set -e

echo "Building Email Monitor Docker Container..."

# Build the Docker image
docker build -t email-monitor:latest .

echo "Docker image built successfully!"

# Tag for different environments
docker tag email-monitor:latest email-monitor:v1.0.0

echo "Available images:"
docker images | grep email-monitor

echo ""
echo "To run with Docker Compose:"
echo "  docker-compose up -d"
echo ""
echo "To run standalone:"
echo "  docker run -d --name email-monitor \\"
echo "    -e SMTP_HOST=smtp.gmail.com \\"
echo "    -e SMTP_PORT=587 \\"
echo "    -e SMTP_USER=your-email@gmail.com \\"
echo "    -e SMTP_PASSWORD=your-app-password \\"
echo "    -e MAIL_PROTOCOL=imap \\"
echo "    -e MAIL_HOST=imap.gmail.com \\"
echo "    -e MAIL_PORT=993 \\"
echo "    -e MAIL_USER=your-email@gmail.com \\"
echo "    -e MAIL_PASSWORD=your-app-password \\"
echo "    -e MAIL_FROM=your-email@gmail.com \\"
echo "    -e MAIL_TO=your-email@gmail.com \\"
echo "    -e KUMA_ENABLED=true \\"
echo "    -e KUMA_SERVER=https://your-uptime-kuma.com \\"
echo "    -e KUMA_IDENTIFIER=your-monitor-id \\"
echo "    email-monitor:latest"