# Docker build and deployment guide for Agentable

## Quick Start

### Production Build

```bash
# Build the Docker image
docker build -t agentable:latest .

# Run with docker-compose
docker-compose up -d
```

### Development Build with Local PostgreSQL

```bash
# Run development environment with hot-reload
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f app
```

## Setup Instructions

### 1. Environment Variables

Create a `.env.docker` file based on `.env.docker.example`:

```bash
cp .env.docker.example .env.docker
```

Then edit `.env.docker` with your credentials:
- Auth0 domain and credentials
- API keys (Anthropic, OpenAI)
- Database URL (Neon PostgreSQL)
- Application secrets

### 2. For Production (Using Neon)

```bash
# Copy your .env.local variables to .env.docker
# Make sure DATABASE_URL points to Neon

docker-compose up -d
```

### 3. For Local Development (With PostgreSQL)

```bash
# Use the dev compose file
docker-compose -f docker-compose.dev.yml up -d

# Wait for the database to be ready, then apply migrations
docker-compose -f docker-compose.dev.yml exec app pnpm db:push

# View logs
docker-compose -f docker-compose.dev.yml logs -f
```

## Images & Containers

### Production Image
- **Size**: ~500MB (optimized multi-stage build)
- **Base**: Node.js 22 Alpine
- **User**: Non-root (nextjs)
- **Health Check**: Enabled
- **Restart Policy**: unless-stopped

### Development Setup
- **Services**: Next.js app + PostgreSQL
- **Hot Reload**: Enabled via volume mounts
- **Database**: PostgreSQL 16 Alpine
- **Network**: agentable-dev-network

## Common Commands

### View logs
```bash
# Production
docker-compose logs -f app

# Development
docker-compose -f docker-compose.dev.yml logs -f app
```

### Stop containers
```bash
# Production
docker-compose down

# Development
docker-compose -f docker-compose.dev.yml down
```

### Rebuild image
```bash
docker-compose build --no-cache
```

### Access PostgreSQL (dev only)
```bash
docker-compose -f docker-compose.dev.yml exec postgres psql -U postgres -d agentable
```

### Push migrations (dev)
```bash
docker-compose -f docker-compose.dev.yml exec app pnpm db:push
```

## Environment Variables

### Required for Production
- `DATABASE_URL` - PostgreSQL connection string (Neon)
- `ANTHROPIC_API_KEY` - For Claude API calls
- `OPENAI_API_KEY` - For GPT API calls
- `AUTH0_DOMAIN` - Auth0 tenant domain
- `CLIENT_ID` - Auth0 application client ID
- `CLIENT_SECRET` - Auth0 application client secret
- `API_KEY_SECRET` - 32-byte hex secret for session signing

### Optional
- `DEV_USER_ID` - Fallback user ID (default: "demo")
- `NODE_ENV` - Set to "production"
- `NEXT_TELEMETRY_DISABLED` - Disable Next.js telemetry

## Port Mappings

| Service | Port | Description |
|---------|------|-------------|
| Next.js App | 3000 | Main application |
| PostgreSQL | 5432 | Database (dev only) |

## Volumes (Development)

- `.:/app` - Application source code
- `/app/node_modules` - Node modules (excluded from sync)
- `/app/.next` - Next.js build cache (excluded from sync)
- `postgres_data_dev` - PostgreSQL data persistence

## Health Checks

Both production and development setups include health checks:
- **Interval**: 30 seconds
- **Timeout**: 3-10 seconds
- **Retries**: 3-5
- **Start Period**: 5-40 seconds

## Troubleshooting

### Container won't start
```bash
docker-compose logs app
```

### Database connection failed
- Verify `DATABASE_URL` is correct
- For dev: ensure PostgreSQL container is running (`docker-compose ps`)
- Check network connectivity: `docker network ls`

### Auth0 not working in Docker
- Verify callback URLs in Auth0 include `http://localhost:3000/api/auth/callback`
- Check `AUTH0_DOMAIN`, `CLIENT_ID`, `CLIENT_SECRET` are correct

### Port already in use
```bash
# Change port in docker-compose.yml
# Example: map 8000 to 3000
ports:
  - "8000:3000"
```

### High memory usage
- Reduce build cache: `docker image prune`
- Stop unused containers: `docker-compose down`
- Use production build (smaller than dev)
