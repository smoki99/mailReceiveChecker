# Email Monitor - Docker & Kubernetes Ready

A containerized email delivery monitoring tool with Uptime Kuma integration, designed for Docker and Kubernetes deployments.

## Features

- ✅ **Containerized**: Ready for Docker and Kubernetes
- ✅ **Environment Variables**: Full configuration via environment variables or .env file
- ✅ **Local Development**: Easy setup with .env file support
- ✅ **Health Checks**: Built-in health monitoring
- ✅ **Uptime Kuma Integration**: Push monitoring support
- ✅ **Multi-Protocol**: SMTP, IMAP, and POP3 support
- ✅ **Resource Efficient**: Optimized Alpine Linux base
- ✅ **Security**: Non-root user, minimal attack surface

## Quick Start - Local Development

### 1. Setup Environment

```bash
# Clone the repository
git clone <repository>
cd email-monitor

# Install dependencies
npm install

# Create your environment file from template
npm run setup
# OR manually:
cp .env.temp .env
```

### 2. Configure Your Settings

Edit the `.env` file with your actual credentials:

```bash
# Example Gmail configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-gmail-app-password

MAIL_PROTOCOL=imap
MAIL_HOST=imap.gmail.com
MAIL_PORT=993
MAIL_USER=your-email@gmail.com
MAIL_PASSWORD=your-gmail-app-password
MAIL_FROM=your-email@gmail.com
MAIL_TO=your-email@gmail.com

# Optional: Uptime Kuma
KUMA_ENABLED=true
KUMA_SERVER=https://your-uptime-kuma.com
KUMA_IDENTIFIER=your-monitor-id
```

### 3. Run Locally

```bash
# Production mode
npm start

# Development mode (with debug output)
npm run dev

# Single test
npm test
```

## Quick Start - Docker

### Docker Compose (Recommended)

```bash
# Copy and edit the environment variables
cp docker-compose.yml docker-compose.override.yml
# Edit docker-compose.override.yml with your settings

# Run
docker-compose up -d

# View logs
docker-compose logs -f email-monitor
```

### Standalone Docker

```bash
docker run -d --name email-monitor \
  --env-file .env \
  email-monitor:latest
```

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `SMTP_HOST` | SMTP server hostname | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP server port | `587` |
| `SMTP_USER` | SMTP username | `your-email@gmail.com` |
| `SMTP_PASSWORD` | SMTP password/app password | `your-app-password` |
| `MAIL_PROTOCOL` | Mail protocol (imap/pop3) | `imap` |
| `MAIL_HOST` | Mail server hostname | `imap.gmail.com` |
| `MAIL_PORT` | Mail server port | `993` |
| `MAIL_USER` | Mail username | `your-email@gmail.com` |
| `MAIL_PASSWORD` | Mail password/app password | `your-app-password` |
| `MAIL_FROM` | Sender email address | `your-email@gmail.com` |
| `MAIL_TO` | Recipient email address | `your-email@gmail.com` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SMTP_SECURE` | Use SSL for SMTP | `false` |
| `MAIL_TLS` | Use TLS for mail | `true` |
| `SEND_INTERVAL` | Test interval (minutes) | `5` |
| `RECEIVE_TIMEOUT` | Check timeout (minutes) | `1` |
| `RETRIES` | Email check retries | `3` |
| `KUMA_ENABLED` | Enable Uptime Kuma | `true` |
| `KUMA_SERVER` | Uptime Kuma server URL | - |
| `KUMA_IDENTIFIER` | Push monitor identifier | - |
| `NODE_ENV` | Environment mode | `production` |
| `DEBUG` | Enable debug output | `false` |

## Gmail Setup

1. **Enable 2-Factor Authentication** on your Google account

2. **Generate App Password**:
   - Go to [Google Account Security](https://myaccount.google.com/security)
   - Select "2-Step Verification" → "App passwords"
   - Choose "Mail" and generate password
   - Use this password in your configuration

3. **Configuration Example**:
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-16-char-app-password

MAIL_PROTOCOL=imap
MAIL_HOST=imap.gmail.com
MAIL_PORT=993
MAIL_USER=your-email@gmail.com
MAIL_PASSWORD=your-16-char-app-password
```

## Uptime Kuma Setup

1. **Create Push Monitor** in Uptime Kuma:
   - Monitor Type: "Push"
   - Friendly Name: "Email Delivery Monitor"
   - Copy the push URL: `https://your-server.com/api/push/IDENTIFIER`

2. **Configure Environment Variables**:
```bash
KUMA_ENABLED=true
KUMA_SERVER=https://your-server.com
KUMA_IDENTIFIER=IDENTIFIER
```

## Development

### Scripts

```bash
npm start          # Run in production mode
npm run dev        # Run in development mode with debug
npm test           # Run single test
npm run setup      # Create .env from template
```

### Debug Mode

Enable detailed logging:

```bash
# Environment variable
DEBUG=true npm start

# Or in .env file
DEBUG=true
NODE_ENV=development
```

### File Structure

```
email-monitor/
├── .env                    # Your configuration (git ignored)
├── .env.temp              # Configuration template
├── .gitignore             # Git ignore rules
├── package.json           # Dependencies and scripts
├── email-monitor.js       # Main application
├── healthcheck.js         # Health check script
├── test.js               # Test runner
├── Dockerfile            # Docker configuration
├── docker-compose.yml    # Docker Compose setup
├── kubernetes-deployment.yaml  # Kubernetes manifests
└── config/               # Runtime configuration directory
    └── config.json       # Generated config file
```

## Docker Deployment

### Build Image

```bash
npm run docker:build
```

### Run with Docker Compose

```bash
npm run docker:run
npm run docker:logs
npm run docker:stop
```

## Kubernetes Deployment

```bash
# Create namespace
kubectl create namespace monitoring

# Deploy
kubectl apply -f kubernetes-deployment.yaml

# Check status
kubectl get pods -n monitoring
kubectl logs -f deployment/email-monitor -n monitoring
```

## Troubleshooting

### Common Issues

1. **"Missing required config field"**
   - Check your .env file has all required variables
   - Verify variable names match exactly (case sensitive)

2. **SMTP Authentication Failed**
   - Use app passwords for Gmail (not regular password)
   - Check username and password are correct

3. **Email Not Found**
   - Increase `RECEIVE_TIMEOUT` if network is slow
   - Check spam/junk folders
   - Verify mail server settings

4. **Uptime Kuma Connection Failed**
   - Check `KUMA_SERVER` URL (include https://)
   - Verify `KUMA_IDENTIFIER` is correct
   - Test URL manually in browser

### Debug Steps

1. **Enable Debug Mode**:
```bash
DEBUG=true NODE_ENV=development npm start
```

2. **Check Configuration**:
```bash
# The app will log configuration summary in debug mode
npm run dev
```

3. **Test Single Email**:
```bash
npm test
```

4. **Check Docker Logs**:
```bash
docker logs email-monitor
```

## Security

- ✅ Passwords stored in .env (git ignored)
- ✅ Non-root container user
- ✅ Minimal Alpine base image
- ✅ No sensitive data in logs
- ✅ TLS/SSL support

## Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/name`
3. Make changes and test locally: `npm run dev`
4. Test with Docker: `npm run docker:build && npm run docker:run`
5. Submit pull request

## License

MIT License - see LICENSE file for details.