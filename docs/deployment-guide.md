# EdgeAI Deployment Guide

## Prerequisites

- Docker and Docker Compose v2+
- Git access to the repository
- A server with at least 1 GB RAM

## Quick Start

```bash
git clone --no-checkout <repo-url> EdgeAI && cd EdgeAI
git sparse-checkout init --no-cone
git sparse-checkout set '/*' '!CLAUDE.md' '!docs/'
git checkout

cp .env.example .env
# Edit .env with your values (see Configuration below)
docker compose up -d
```

The application will be available at `http://<server-ip>:3000`.

## Configuration

Copy `.env.example` to `.env` and set the following variables:

| Variable | Required | Default | Description |
|---|---|---|---|
| `SECRET_KEY` | Yes | - | Random string for JWT signing. Generate with `openssl rand -hex 32` |
| `ADMIN_PASSWORD` | Yes | - | Password for the bootstrap admin account |
| `ADMIN_USERNAME` | No | `admin` | Username for the bootstrap admin account |
| `DATABASE_URL` | No | `sqlite+aiosqlite:////app/data/edgeai.db` | Database connection string |

The admin account is created automatically on first startup. Changing `ADMIN_USERNAME` or `ADMIN_PASSWORD` after initial setup has no effect -- use the in-app password change instead.

## Architecture

```
Client :3000 --> nginx (frontend container)
                   |
                   |--> static files (React SPA)
                   |--> /api/* proxy --> uvicorn :8000 (backend container)
                                            |
                                            |--> SQLite (./data/edgeai.db)
                                            |--> RAGFlow API (external)
                                            |--> OpenAI-compatible APIs (external)
```

- **Frontend container**: nginx serves the React build and reverse-proxies `/api/` to the backend
- **Backend container**: FastAPI with uvicorn, connects to SQLite and external AI providers
- **Data volume**: `./data` is mounted into the backend container for SQLite persistence

## Building and Running

### Production (Docker Compose)

```bash
# Start
docker compose up -d

# Rebuild after code changes
docker compose up -d --build

# View logs
docker compose logs -f
docker compose logs -f backend   # backend only

# Stop
docker compose down
```

### Custom Port

Edit `docker-compose.yml` to change the published port:

```yaml
frontend:
  ports:
    - "8080:80"   # change 3000 to your preferred port
```

### Development (without Docker)

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
SECRET_KEY=dev ADMIN_PASSWORD=admin uvicorn app.main:app --reload  # :8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev   # :5173, proxies /api to :8000
```

## Data and Backups

### Database

SQLite database is stored at `./data/edgeai.db` on the host (mounted as `/app/data/edgeai.db` in the container). WAL mode is enabled for concurrent reads.

### Backup

```bash
# Stop writes for a consistent backup (optional but recommended)
docker compose stop backend
cp ./data/edgeai.db ./data/edgeai.db.bak
cp ./data/edgeai.db-wal ./data/edgeai.db-wal.bak 2>/dev/null
docker compose start backend
```

Or use SQLite's online backup without stopping the service:

```bash
docker compose exec backend python -c "
import sqlite3
src = sqlite3.connect('/app/data/edgeai.db')
dst = sqlite3.connect('/app/data/backup.db')
src.backup(dst)
dst.close()
src.close()
"
cp ./data/backup.db ~/edgeai-backup-$(date +%Y%m%d).db
```

### Restore

```bash
docker compose down
cp /path/to/backup.db ./data/edgeai.db
docker compose up -d
```

## Schema Migrations

There is no automatic migration system. When upgrading to a version that adds new database columns, apply the `ALTER TABLE` statements manually:

```bash
docker compose exec backend python -c "
import sqlite3
conn = sqlite3.connect('/app/data/edgeai.db')
conn.execute('ALTER TABLE <table> ADD COLUMN <column> <type> DEFAULT <value>')
conn.commit()
conn.close()
"
```

Check the release notes or git log for required schema changes before upgrading.

## SSE Streaming

The nginx config includes headers required for Server-Sent Events streaming:

- `proxy_buffering off` -- disables response buffering
- `proxy_cache off` -- prevents caching of streamed responses
- `Connection ''` -- clears the Connection header for SSE
- `proxy_read_timeout 300s` -- allows long-running streaming responses

If you place a reverse proxy (e.g., Cloudflare, AWS ALB) in front of the application, ensure it also disables response buffering for `/api/` routes.

## Reverse Proxy (HTTPS)

To add HTTPS, place a reverse proxy in front of the frontend container. Example with nginx on the host:

```nginx
server {
    listen 443 ssl;
    server_name edgeai.example.com;

    ssl_certificate /etc/ssl/certs/edgeai.crt;
    ssl_certificate_key /etc/ssl/private/edgeai.key;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE support
        proxy_set_header Connection '';
        proxy_http_version 1.1;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 300s;
    }
}
```

## Troubleshooting

### Backend won't start

Check that `SECRET_KEY` is set:
```bash
docker compose logs backend | head -20
```

### Streaming responses are truncated

Ensure no intermediate proxy is buffering responses. Check that SSE headers are preserved end-to-end.

### Database locked errors

SQLite WAL mode supports concurrent reads but only one writer. If you see "database is locked" errors under heavy write load, consider reducing concurrent users per integration or switching to PostgreSQL.

### Container rebuilds are slow

Use Docker BuildKit for faster rebuilds:
```bash
DOCKER_BUILDKIT=1 docker compose build
```
